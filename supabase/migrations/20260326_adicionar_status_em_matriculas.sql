begin;

alter table public.matriculas
  add column if not exists status_em timestamp with time zone;

update public.matriculas
set status_em = coalesce(status_em, created_at, timezone('utc'::text, now()))
where status_em is null;

alter table public.matriculas
  alter column status_em set default timezone('utc'::text, now());

alter table public.matriculas
  alter column status_em set not null;

commit;
