alter table public.matriculas
  add column if not exists ultima_recusa_professor_id uuid,
  add column if not exists ultima_recusa_observacao text,
  add column if not exists ultima_recusa_em timestamp with time zone;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matriculas_ultima_recusa_professor_id_fkey'
  ) then
    alter table public.matriculas
      add constraint matriculas_ultima_recusa_professor_id_fkey
      foreign key (ultima_recusa_professor_id)
      references public.perfis(id);
  end if;
end $$;
