-- Тапсырмаға дедлайн (күн + уақыт) және тіркемелер (сілтемелер, PDF/файлдар).
-- Supabase → SQL Editor → New query → осыны қойып → Run (бір рет).
alter table public.tasks
  add column if not exists deadline timestamptz,
  add column if not exists attachments jsonb not null default '[]';
