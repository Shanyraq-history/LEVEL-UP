-- Куратор оқушыны толық өшіре алады: аккаунты, профилі, прогресі және өз тапсырмалары жойылады.
-- Supabase → SQL Editor → New query → осыны қойып → Run (бір рет).
create or replace function public.delete_student(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_curator() then raise exception 'Тек куратор өшіре алады'; end if;
  if not exists (select 1 from public.profiles where id = uid and role = 'student') then raise exception 'Оқушы табылмады'; end if;
  delete from auth.users where id = uid;
end $$;
revoke execute on function public.delete_student(uuid) from public, anon;
grant execute on function public.delete_student(uuid) to authenticated;

drop policy if exists "proofs delete curator" on storage.objects;
create policy "proofs delete curator" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and public.is_curator());
