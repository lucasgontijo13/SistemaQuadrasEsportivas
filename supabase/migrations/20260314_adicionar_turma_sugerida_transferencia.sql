begin;

alter table public.solicitacoes_aula_experimental
  add column if not exists turma_sugerida_id integer;

alter table public.solicitacoes_aula_experimental
  drop constraint if exists solicitacoes_aula_experimental_turma_sugerida_id_fkey;

alter table public.solicitacoes_aula_experimental
  add constraint solicitacoes_aula_experimental_turma_sugerida_id_fkey
  foreign key (turma_sugerida_id) references public.turmas(id);

create index if not exists solicitacoes_aula_experimental_turma_sugerida_idx
  on public.solicitacoes_aula_experimental(turma_sugerida_id);

commit;
