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
- Сервер: `api/nova.js` (Vercel function), Google Gemini API (тегін деңгей) + Google іздеуі, zetix.kz.
- Vercel → Settings → Environment Variables: `GEMINI_API_KEY` (міндетті, aistudio.google.com), `GEMINI_MODEL` (әдепкі `gemini-3.8-flash`, табылмаса `gemini-flash-latest`), `NOVA_DAILY_LIMIT` (әдепкі 30).
- Supabase: `supabase/007_nova_usage.sql` бір рет іске қосылуы керек (күндік лимит).
