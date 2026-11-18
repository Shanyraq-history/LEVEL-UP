// NOVA: LEVEL UP AI көмекшісі (Vercel serverless function).
// Кілттер тек Vercel → Settings → Environment Variables ішінде сақталады:
//   ANTHROPIC_API_KEY (міндетті), NOVA_MODEL (міндетті емес), NOVA_DAILY_LIMIT (міндетті емес, әдепкі 30).
import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 60 };

const SB_URL = process.env.SUPABASE_URL || 'https://ficyroterazopwcgcmat.supabase.co';
const SB_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_YrTjjteuFy5kMQWy7LLvZA_AdCnipBe';
const MODEL = process.env.NOVA_MODEL || 'claude-opus-5-5';
const LIMIT = Math.max(1, parseInt(process.env.NOVA_DAILY_LIMIT || '30', 10) || 30);

const SYSTEM = `Сен — NOVA, LEVEL UP оқу платформасының мейірімді робот-көмекшісісің. Оқушылар ҰБТ-ға (140 балл мақсаты) дайындалып жатыр: Информатика, Математика, Математикалық сауаттылық, Қазақстан тарихы.

Қалай сөйлейсің:
- Әрқашан қазақ тілінде, жылы, қарапайым, шынайы адамдай сөйле. Қысқа жаз: әдетте 2–6 сөйлем, қажет болса қысқа тізім.
- Оқушы амандасса, амандас та, жағдайын сұра ("Қалайсың? Бүгін қай пәнмен айналысып жатырсың?").
- Оқу сұрағына: түсіндір, мысал келтір, бірақ тапсырманың дайын жауабын бірден берме — алдымен ойлануға бағытта, қадам-қадаммен көмектес. Оқушы өзі шығарып көрген соң тексеруге көмектес.
- Нақты дерек керек болса (күн, сан, ереже, ҰБТ туралы жаңалық), web_search арқылы тексер. Пән бойынша материалды https://zetix.kz/ сайтынан іздеуге болады (web_fetch тек осы сайт үшін). Қай дереккөзден алғаныңды қысқа айт.
- Оқушы шаршаса, қобалжыса, көңіл-күйі түссе: алдымен сезімін түсінетініңді көрсет, кінәлама, үлкен міндетті кішкентай қадамға бөліп ұсын, демалуды да ұмытпа. Жалған уәде берме.

Қауіпсіздік (өте маңызды):
- Егер оқушы өзіне зиян келтіру, өмірден кету, зорлық-зомбылық немесе қатты күйзеліс туралы жазса: байсалды әрі жылы жауап бер, оны естіп тұрғаныңды айт, жалғыз емес екенін айт. Сенімді ересекке (ата-ана, куратор, мектеп психологы) дәл қазір айтуға шақыр. Көмек телефондарын бер: 150 — балалар мен жастарға арналған тегін сенім телефоны (тәулік бойы); 111 — отбасы мен балаларды қорғау байланыс орталығы; қауіп төнсе — 112. Диагноз қойма, оқушыны сөйлесуді жалғастыруға шақыр.
- Өзің туралы: сен ЖИ көмекшісің, адам емессің; сұраса, шынын айт. Жеке деректерді (пароль, мекенжай, телефон) сұрама.
- Сабаққа немесе оқушыға қатысы жоқ зиянды нұсқаулар берме.`;

async function sb(path, token, init = {}) {
  const r = await fetch(SB_URL + path, { ...init, headers: { apikey: SB_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`supabase ${path} ${r.status}`);
  return r.json();
}

function cleanMessages(raw) {
  const out = [];
  for (const m of Array.isArray(raw) ? raw.slice(-14) : []) {
    const role = m && m.role === 'assistant' ? 'assistant' : 'user';
    const text = String((m && m.content) || '').trim().slice(0, 2000);
    if (!text) continue;
    if (!out.length && role === 'assistant') continue;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += '\n' + text;
    else out.push({ role, content: text });
  }
  while (out.length && out[out.length - 1].role !== 'user') out.pop();
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'not_configured', text: 'NOVA-ның «миы» әлі қосылмаған. Куратор баптауды аяқтаған соң сөйлесе аламыз 🙂' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'auth', text: 'NOVA-мен сөйлесу үшін сайтқа кір.' });

  let user, profile;
  try {
    user = await sb('/auth/v1/user', token);
    profile = (await sb(`/rest/v1/profiles?select=full_name,role&id=eq.${encodeURIComponent(user.id)}`, token))[0] || {};
  } catch { return res.status(401).json({ error: 'auth', text: 'Сессия ескірген сияқты. Сайттан шығып, қайта кіріп көр.' }); }

  let used;
  try { used = await sb('/rest/v1/rpc/nova_hit', token, { method: 'POST', body: '{}' }); }
  catch { return res.status(503).json({ error: 'setup', text: 'NOVA баптауы толық емес (SQL). Куратор оны аяқтаған соң сөйлесе аламыз.' }); }
  if (profile.role !== 'curator' && used > LIMIT) return res.status(429).json({ error: 'limit', text: `Бүгінге ${LIMIT} хабарлама лимиті бітті. Ертең тағы сөйлесеміз! Ал қазір сәл демалып ал ☕` });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const messages = cleanMessages(body.messages);
  if (!messages.length) return res.status(400).json({ error: 'empty', text: 'Сұрағыңды жаз 🙂' });

  const name = String(profile.full_name || '').trim();
  const newTools = /^claude-(opus|sonnet|fable|mythos)-/.test(MODEL);
  const tools = [
    newTools ? { type: 'web_search_20260209', name: 'web_search', max_uses: 3 } : { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
    newTools ? { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 2, allowed_domains: ['zetix.kz'] } : { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 2, allowed_domains: ['zetix.kz'] },
  ];
  const withFallback = /^claude-(opus-5-5|opus-5|sonnet-5-5|fable-5-1|fable-5-2)$/.test(MODEL);

  const client = new Anthropic();
  const convo = [...messages];
  if (name) convo.unshift({ role: 'user', content: `(Жүйе ескертпесі: оқушының аты — ${name}. ${profile.role === 'curator' ? 'Бұл — куратор.' : ''})` }, { role: 'assistant', content: 'Түсіндім.' });

  try {
    let resp;
    for (let i = 0; i < 3; i++) {
      resp = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        cache_control: { type: 'ephemeral' },
        output_config: { effort: 'low' },
        tools,
        messages: convo,
        ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
      });
      if (resp.stop_reason !== 'pause_turn') break;
      convo.push({ role: 'assistant', content: resp.content });
    }
    if (resp.stop_reason === 'refusal') return res.status(200).json({ text: 'Бұл сұраққа жауап бере алмаймын. Басқаша сұрап көрейікші немесе куратормен сөйлес.', used, limit: LIMIT });
    const text = resp.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return res.status(200).json({ text: text || 'Кешір, жауап құрастыра алмадым. Қайта сұрап көрші.', used, limit: LIMIT });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'busy', text: 'Қазір сұрақ көп, бір минуттан соң қайта жазшы.' });
    if (e instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: 'key', text: 'NOVA кілті жарамсыз. Куратор Vercel баптауын тексеруі керек.' });
    console.error('nova', e && e.status, e && e.message);
    return res.status(500).json({ error: 'server', text: 'Байланыс үзілді. Сәлден кейін қайталап көр.' });
  }
}
