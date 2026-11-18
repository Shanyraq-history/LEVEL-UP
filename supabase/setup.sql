-- LEVEL UP: Supabase деректер базасын баптау.
-- Supabase → SQL Editor → New query → осы файлды толық қойып → Run.

-- 1. Пайдаланушылар профилі
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  login text unique not null,
  full_name text not null default '',
  grp text not null default '',
  role text not null default 'student' check (role in ('student','curator')),
  created_at timestamptz not null default now()
);

create or replace function public.is_curator() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'curator');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, login, full_name, grp)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'login', split_part(new.email, '@', 1))),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'grp', '')
  );
  insert into public.progress (user_id) values (new.id);
  return new;
end $$;

-- 2. Мазмұн
create table if not exists public.subjects (
  id text primary key default substr(md5(random()::text), 1, 10),
  name text not null,
  ord int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  descr text not null default '',
  subject text references public.subjects on delete set null,
  section text not null default '',
  date date not null,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  subject text references public.subjects on delete cascade,
  section text not null,
  title text not null,
  descr text not null default '',
  link text not null default '',
  file_path text,
  file_name text,
  created_at timestamptz not null default now()
);
create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  subject text references public.subjects on delete cascade,
  title text not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  subject text references public.subjects on delete cascade,
  title text not null,
  questions jsonb not null default '[]',
  created_at timestamptz not null default now()
);
-- Әр оқушының прогресі: тапсырмалар, чек-листтер, тесттер
create table if not exists public.progress (
  user_id uuid primary key references public.profiles on delete cascade,
  data jsonb not null default '{"tasks":{},"checks":{},"tests":{}}',
  updated_at timestamptz not null default now()
);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Қолжетімділік ережелері (RLS)
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.tasks enable row level security;
alter table public.materials enable row level security;
alter table public.checklists enable row level security;
alter table public.tests enable row level security;
alter table public.progress enable row level security;

-- Профиль: өзін немесе куратор көреді; оқушы тек атын/тобын өзгерте алады (рөлін емес)
create policy "profiles read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_curator());
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles curator" on public.profiles for all to authenticated using (public.is_curator()) with check (public.is_curator());
revoke update on public.profiles from authenticated;
grant update (full_name, grp) on public.profiles to authenticated;

-- Пәндер мен материалдар: бәрі оқиды, тек куратор өзгертеді
create policy "subjects read" on public.subjects for select to authenticated using (true);
create policy "subjects curator" on public.subjects for all to authenticated using (public.is_curator()) with check (public.is_curator());
create policy "materials read" on public.materials for select to authenticated using (true);
create policy "materials curator" on public.materials for all to authenticated using (public.is_curator()) with check (public.is_curator());
create policy "checklists read" on public.checklists for select to authenticated using (true);
create policy "checklists curator" on public.checklists for all to authenticated using (public.is_curator()) with check (public.is_curator());
create policy "tests read" on public.tests for select to authenticated using (true);
create policy "tests curator" on public.tests for all to authenticated using (public.is_curator()) with check (public.is_curator());

-- Тапсырмалар: оқушы тек жарияланғанды көреді
create policy "tasks read" on public.tasks for select to authenticated using (published or public.is_curator());
create policy "tasks curator" on public.tasks for all to authenticated using (public.is_curator()) with check (public.is_curator());

-- Прогресс: оқушы өзінікін жазады, куратор бәрін көреді
create policy "progress read" on public.progress for select to authenticated using (user_id = auth.uid() or public.is_curator());
create policy "progress insert own" on public.progress for insert to authenticated with check (user_id = auth.uid());
create policy "progress update own" on public.progress for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4. Файлдар: дәлелдер (жабық) және материал файлдары
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('materials', 'materials', false) on conflict (id) do nothing;

create policy "proofs upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "proofs read" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_curator()));
create policy "proofs delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "materials files read" on storage.objects for select to authenticated using (bucket_id = 'materials');
create policy "materials files curator" on storage.objects for all to authenticated
  using (bucket_id = 'materials' and public.is_curator()) with check (bucket_id = 'materials' and public.is_curator());

-- 5. Бастапқы пәндер
insert into public.subjects (id, name, ord) values
  ('informatics', 'Информатика', 1),
  ('math', 'Математика', 2),
  ('mathlit', 'Математикалық сауаттылық', 3),
  ('history', 'Қазақстан тарихы', 4)
on conflict (id) do nothing;

-- 6. КУРАТОРДЫ ТАҒАЙЫНДАУ (сайтта тіркелгеннен кейін бөлек іске қосыңыз):
-- update public.profiles set role = 'curator' where login = 'сіздің_логиніңіз';
