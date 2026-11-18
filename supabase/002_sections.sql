-- LEVEL UP: пән ішіндегі бөлімдер және чек-листке PDF тіркеу
alter table public.subjects add column if not exists sections jsonb;
alter table public.checklists add column if not exists section text, add column if not exists file_path text, add column if not exists file_name text;
alter table public.tests add column if not exists section text;
