-- LEVEL UP: оқушы профиліне «Кураторың» өрісін қосу + «Баптаулар» бетінен өзгертуге рұқсат.
-- Қайта іске қосуға болады.
alter table public.profiles add column if not exists curator text not null default '';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, login, full_name, grp, curator)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'login', split_part(new.email, '@', 1))),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'grp', ''),
    coalesce(new.raw_user_meta_data->>'curator', '')
  );
  insert into public.progress (user_id) values (new.id);
  return new;
end $$;

grant update (full_name, grp, curator) on public.profiles to authenticated;
