-- LEVEL UP: Информатика пәніне «Терминология» бөлімін қосу (84 термин + флеш-карталар).
-- Терминдер сайттың өзінде (info-terms.js), сондықтан тек бөлімді тіркейміз. Қайта іске қосуға болады.
update public.subjects
set sections = coalesce(sections, '[
  {"id":"analysis","name":"Нұсқа талдау","kind":"mat"},
  {"id":"checklists","name":"Чек-листтер","kind":"check"},
  {"id":"books","name":"Кітаптар","kind":"mat"},
  {"id":"practicum","name":"Практикум","kind":"mat"},
  {"id":"tests","name":"Тесттер","kind":"test"}
]'::jsonb) || '[{"id":"terms","name":"Терминология","kind":"terms"}]'::jsonb
where (id = 'informatics' or name = 'Информатика')
  and not coalesce(sections, '[]'::jsonb) @> '[{"kind":"terms"}]'::jsonb;
