begin;

alter table public.turmas
  add column if not exists professor_id uuid;

update public.turmas as turma
set professor_id = perfil.id
from public.perfis as perfil
where perfil.tipo = 'professor'
  and lower(trim(perfil.nome)) = lower(trim(turma.professor))
  and turma.professor_id is null;

alter table public.turmas
  drop constraint if exists turmas_professor_id_fkey;

alter table public.turmas
  add constraint turmas_professor_id_fkey
  foreign key (professor_id) references public.perfis(id);

create index if not exists turmas_professor_id_idx
  on public.turmas(professor_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'solicitacoes_aula_experimental'
      and column_name = 'professor_id'
  ) then
    alter table public.solicitacoes_aula_experimental
      rename column professor_id to professor_preferido_id;
  end if;
end $$;

alter table public.solicitacoes_aula_experimental
  add column if not exists professor_responsavel_id uuid;

update public.solicitacoes_aula_experimental
set professor_responsavel_id = professor_preferido_id
where professor_responsavel_id is null;

alter table public.solicitacoes_aula_experimental
  drop constraint if exists solicitacoes_aula_experimental_professor_id_fkey;

alter table public.solicitacoes_aula_experimental
  drop constraint if exists solicitacoes_aula_experimental_professor_preferido_id_fkey;

alter table public.solicitacoes_aula_experimental
  drop constraint if exists solicitacoes_aula_experimental_professor_responsavel_id_fkey;

alter table public.solicitacoes_aula_experimental
  add constraint solicitacoes_aula_experimental_professor_preferido_id_fkey
  foreign key (professor_preferido_id) references public.perfis(id);

alter table public.solicitacoes_aula_experimental
  add constraint solicitacoes_aula_experimental_professor_responsavel_id_fkey
  foreign key (professor_responsavel_id) references public.perfis(id);

alter table public.solicitacoes_aula_experimental
  drop constraint if exists solicitacoes_aula_experimental_status_check;

alter table public.solicitacoes_aula_experimental
  add constraint solicitacoes_aula_experimental_status_check
  check (
    status = any (
      array[
        'pendente'::text,
        'aguardando_aceite_professor'::text,
        'em_contato'::text,
        'agendado'::text
      ]
    )
  );

create index if not exists solicitacoes_aula_experimental_professor_preferido_idx
  on public.solicitacoes_aula_experimental(professor_preferido_id);

create index if not exists solicitacoes_aula_experimental_professor_responsavel_idx
  on public.solicitacoes_aula_experimental(professor_responsavel_id);

create or replace function public.validar_referencia_professor()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'turmas' then
    if new.professor_id is null then
      raise exception 'Toda turma precisa de um professor responsável.';
    end if;

    if not exists (
      select 1
      from public.perfis
      where id = new.professor_id
        and tipo = 'professor'
    ) then
      raise exception 'A turma só pode referenciar perfis do tipo professor.';
    end if;
  else
    if new.professor_preferido_id is not null and not exists (
      select 1
      from public.perfis
      where id = new.professor_preferido_id
        and tipo = 'professor'
    ) then
      raise exception 'O professor preferido precisa ser um perfil do tipo professor.';
    end if;

    if new.professor_responsavel_id is not null and not exists (
      select 1
      from public.perfis
      where id = new.professor_responsavel_id
        and tipo = 'professor'
    ) then
      raise exception 'O professor responsável precisa ser um perfil do tipo professor.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_referencia_professor_turmas on public.turmas;
create trigger validar_referencia_professor_turmas
before insert or update on public.turmas
for each row
execute function public.validar_referencia_professor();

drop trigger if exists validar_referencia_professor_solicitacoes on public.solicitacoes_aula_experimental;
create trigger validar_referencia_professor_solicitacoes
before insert or update on public.solicitacoes_aula_experimental
for each row
execute function public.validar_referencia_professor();

commit;
