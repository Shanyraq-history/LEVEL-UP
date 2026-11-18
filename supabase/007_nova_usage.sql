-- NOVA чат лимиті: әр пайдаланушы күніне неше хабарлама жібергенін санайды.
-- Supabase → SQL Editor → New query → осыны қойып → Run (бір рет).
create table if not exists public.nova_usage (
  user_id uuid references public.profiles on delete cascade,
  day date not null,
  n int not null default 0,
  primary key (user_id, day)
);
alter table public.nova_usage enable row level security;
create policy "nova usage read" on public.nova_usage for select to authenticated using (user_id = auth.uid() or public.is_curator());

create or replace function public.nova_hit() returns int
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.nova_usage (user_id, day, n) values (auth.uid(), (now() at time zone 'Asia/Almaty')::date, 1)
  on conflict (user_id, day) do update set n = public.nova_usage.n + 1
  returning n into c;
  return c;
end $$;
revoke execute on function public.nova_hit() from public, anon;
grant execute on function public.nova_hit() to authenticated;
