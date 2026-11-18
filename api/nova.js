// NOVA: LEVEL UP AI көмекшісі (Vercel serverless function, Google Gemini API).
// Кілттер тек Vercel → Settings → Environment Variables ішінде сақталады:
//   GEMINI_API_KEY (міндетті), NOVA_MODEL (міндетті емес, әдепкі gemini-2.5-flash), NOVA_DAILY_LIMIT (әдепкі 30).

export const config = { maxDuration: 60 };

const SB_URL = process.env.SUPABASE_URL || 'https://ficyroterazopwcgcmat.supabase.co';
const SB_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_YrTjjteuFy5kMQWy7LLvZA_AdCnipBe';
const MODEL = process.env.NOVA_MODEL || 'gemini-2.5-flash';
const LIMIT = Math.max(1, parseInt(process.env.NOVA_DAILY_LIMIT || '30', 10) || 30);

const SYSTEM = `Сен — NOVA, LEVEL UP оқу платформасының мейірімді робот-көмекшісісің. Оқушылар ҰБТ-ға (140 балл мақсаты) дайындалып жатыр: Информатика, Математика, Математикалық сауаттылық, Қазақстан тарихы.

Қалай сөйлейсің:
- Әрқашан қазақ тілінде, жылы, қарапайым, шынайы адамдай сөйле. Қысқа жаз: әдетте 2–6 сөйлем, қажет болса қысқа тізім.
- Оқушы амандасса, амандас та, жағдайын сұра ("Қалайсың? Бүгін қай пәнмен айналысып жатырсың?").
- Оқу сұрағына: түсіндір, мысал келтір, бірақ тапсырманың дайын жауабын бірден берме — алдымен ойлануға бағытта, қадам-қадаммен көмектес. Оқушы өзі шығарып көрген соң тексеруге көмектес.
- Нақты дерек керек болса (күн, сан, ереже, ҰБТ туралы жаңалық), Google іздеуі арқылы тексер. Пән бойынша материалды алдымен https://zetix.kz/ сайтынан ізде (мысалы: site:zetix.kz тақырып). Қай дереккөзден алғаныңды қысқа айт.
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
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'not_configured', text: 'NOVA-ның «миы» әлі қосылмаған. Куратор баптауды аяқтаған соң сөйлесе аламыз 🙂' });

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
  const sys = SYSTEM + (name ? `\n\nСөйлесіп отырған адамның аты: ${name}.${profile.role === 'curator' ? ' Бұл — куратор.' : ''}` : '');
  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const call = withSearch => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents,
      ...(withSearch ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
    }),
  });

  try {
    let r = await call(true);
    if (r.status === 400) r = await call(false); // іздеу қолжетімсіз болса, іздеусіз жауап береді
    if (r.status === 429) return res.status(429).json({ error: 'busy', text: 'Қазір сұрақ көп (тегін лимит). Бір минуттан соң қайта жазшы.' });
    if (r.status === 401 || r.status === 403) return res.status(503).json({ error: 'key', text: 'NOVA кілті жарамсыз. Куратор Vercel баптауын тексеруі керек.' });
    if (!r.ok){ console.error('nova gemini', r.status, (await r.text()).slice(0, 300)); return res.status(500).json({ error: 'server', text: 'Байланыс үзілді. Сәлден кейін қайталап көр.' }); }
    const data = await r.json();
    const cand = (data.candidates || [])[0] || {};
    const text = ((cand.content && cand.content.parts) || []).map(p => p.text || '').join('').trim();
    if (!text && (data.promptFeedback?.blockReason || cand.finishReason === 'SAFETY'))
      return res.status(200).json({ text: 'Бұл сұраққа жауап бере алмаймын. Егер саған қиын болып тұрса, сенімді ересекке (ата-ана, куратор, мектеп психологы) айт немесе 150 сенім телефонына хабарлас (тегін, тәулік бойы). Қауіп төнсе — 112.', used, limit: LIMIT });
    return res.status(200).json({ text: text || 'Кешір, жауап құрастыра алмадым. Қайта сұрап көрші.', used, limit: LIMIT });
  } catch (e) {
    console.error('nova', e && e.message);
    return res.status(500).json({ error: 'server', text: 'Байланыс үзілді. Сәлден кейін қайталап көр.' });
  }
}
