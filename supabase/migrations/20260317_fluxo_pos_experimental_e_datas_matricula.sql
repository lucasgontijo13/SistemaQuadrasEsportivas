begin;

alter table public.solicitacoes_aula_experimental
  add column if not exists resultado_experimental_em timestamp with time zone;

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
        'agendado'::text,
        'aprovada_para_matricula'::text,
        'faltou'::text,
        'nao_vai_continuar'::text,
        'matricula_em_andamento'::text
      ]
    )
  );

create index if not exists solicitacoes_aula_experimental_resultado_experimental_em_idx
  on public.solicitacoes_aula_experimental(resultado_experimental_em);

commit;
