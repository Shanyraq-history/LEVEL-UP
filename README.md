# LEVEL UP

Куратор мен оқушыларға арналған оқу платформасы: күндік жоспар, пәндер (нұсқа талдау, чек-листтер, кітаптар, практикум, тесттер), дәлел жүктеу, робот-көмекші Робот X.

- `index.html`: бүкіл сайт (статикалық бет, құрастыруды қажет етпейді).
- `config.js`: Supabase жобасының URL мекенжайы мен publishable кілті. Secret / service_role кілтін мұнда ЕШҚАШАН жазбаңыз.
- `supabase/setup.sql`: деректер базасын баптау скрипті (Supabase → SQL Editor → Run).

## Куратор тағайындау
Сайтта тіркелгеннен кейін Supabase SQL Editor-де:

```sql
update public.profiles set role = 'curator' where login = 'сіздің_логиніңіз';
```

## Шығару
Vercel → Add New → Project → осы репозиторийді Import → Deploy. Framework: Other, баптау қажет емес.

## NOVA AI чат
- Сервер: `api/nova.js` (Vercel function), Claude API арқылы жауап береді, web search + zetix.kz.
- Vercel → Settings → Environment Variables: `ANTHROPIC_API_KEY` (міндетті), `NOVA_MODEL` (әдепкі `claude-opus-5-5`), `NOVA_DAILY_LIMIT` (әдепкі 30).
- Supabase: `supabase/007_nova_usage.sql` бір рет іске қосылуы керек (күндік лимит).
