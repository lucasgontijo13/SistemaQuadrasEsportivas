alter table public.solicitacoes_aula_experimental
add column if not exists perfil_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'solicitacoes_aula_experimental_perfil_id_fkey'
  ) then
    alter table public.solicitacoes_aula_experimental
    add constraint solicitacoes_aula_experimental_perfil_id_fkey
    foreign key (perfil_id) references public.perfis(id);
  end if;
end $$;

with solicitacoes_normalizadas as (
  select
    s.id,
    regexp_replace(coalesce(s.telefone_aluno, ''), '\D', '', 'g') as telefone_completo,
    case
      when regexp_replace(coalesce(s.telefone_aluno, ''), '\D', '', 'g') like '55%'
        and length(regexp_replace(coalesce(s.telefone_aluno, ''), '\D', '', 'g')) in (12, 13)
      then substring(regexp_replace(coalesce(s.telefone_aluno, ''), '\D', '', 'g') from 3)
      else regexp_replace(coalesce(s.telefone_aluno, ''), '\D', '', 'g')
    end as telefone_local
  from public.solicitacoes_aula_experimental s
  where s.perfil_id is null
    and s.telefone_aluno is not null
),
perfis_normalizados as (
  select
    p.id as perfil_id,
    regexp_replace(coalesce(p.whatsapp, ''), '\D', '', 'g') as telefone_completo,
    case
      when regexp_replace(coalesce(p.whatsapp, ''), '\D', '', 'g') like '55%'
        and length(regexp_replace(coalesce(p.whatsapp, ''), '\D', '', 'g')) in (12, 13)
      then substring(regexp_replace(coalesce(p.whatsapp, ''), '\D', '', 'g') from 3)
      else regexp_replace(coalesce(p.whatsapp, ''), '\D', '', 'g')
    end as telefone_local
  from public.perfis p
  where p.tipo = 'aluno'
    and p.whatsapp is not null
),
matches_unicos as (
  select
    s.id as solicitacao_id,
    (array_agg(p.perfil_id order by p.perfil_id))[1] as perfil_id,
    count(*) as total_matches
  from solicitacoes_normalizadas s
  join perfis_normalizados p
    on s.telefone_completo = p.telefone_completo
    or s.telefone_completo = p.telefone_local
    or s.telefone_local = p.telefone_completo
    or s.telefone_local = p.telefone_local
  group by s.id
)
update public.solicitacoes_aula_experimental s
set perfil_id = m.perfil_id
from matches_unicos m
where s.id = m.solicitacao_id
  and m.total_matches = 1;
