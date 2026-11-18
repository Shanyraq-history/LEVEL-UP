-- Оқушы өзіне күндік тапсырма қоса алады (куратордың тапсырмалары бұрынғыдай).
-- Оқушының өз тапсырмасын тек өзі және куратор көреді. Рейтингке тек куратордың тапсырмалары есептеледі.
-- Supabase → SQL Editor → New query → осыны қойып → Run (бір рет).
alter table public.tasks add column if not exists owner uuid references auth.users on delete cascade;

drop policy if exists "tasks read" on public.tasks;
create policy "tasks read" on public.tasks for select to authenticated
  using ((published and owner is null) or owner = auth.uid() or public.is_curator());
drop policy if exists "tasks own" on public.tasks;
create policy "tasks own" on public.tasks for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid() and published);

drop policy if exists "materials own upload" on storage.objects;
create policy "materials own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = 'own' and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists "materials own delete" on storage.objects;
create policy "materials own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = 'own' and (storage.foldername(name))[2] = auth.uid()::text);

create or replace function public.daily_rating(d date)
returns table(name text, grp text, points int, me boolean)
language sql security definer stable set search_path = public as $$
  select p.full_name, p.grp,
    (10 * count(t.id) filter (
      where coalesce((pr.data->'tasks'->(t.id::text)->>'done')::boolean, false)
        and jsonb_typeof(pr.data->'tasks'->(t.id::text)->'proofs') = 'array'
        and jsonb_array_length(pr.data->'tasks'->(t.id::text)->'proofs') > 0
    ))::int,
    p.id = auth.uid()
  from public.profiles p
  left join public.progress pr on pr.user_id = p.id
  left join public.tasks t on t.published and t.owner is null and t.date = d
  where p.role = 'student' and auth.uid() is not null
  group by p.id, p.full_name, p.grp;
$$;
