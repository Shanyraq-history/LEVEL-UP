-- Күндік рейтинг: әр оқушының бүгінгі баллы (белгі + дәлел = 10 балл).
-- Оқушылар басқалардың тек аты мен баллын көреді, дәлелдері мен прогресі жабық қалады.
-- Supabase → SQL Editor → New query → осыны қойып → Run (бір рет).
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
  left join public.tasks t on t.published and t.date = d
  where p.role = 'student' and auth.uid() is not null
  group by p.id, p.full_name, p.grp;
$$;
revoke execute on function public.daily_rating(date) from public, anon;
grant execute on function public.daily_rating(date) to authenticated;
