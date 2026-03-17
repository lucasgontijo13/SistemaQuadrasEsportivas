begin;

alter table public.perfis
  add column if not exists cep text,
  add column if not exists rua text,
  add column if not exists numero text;

update public.solicitacoes_aula_experimental
set status = 'pendente'
where status = 'em_contato';

alter table public.solicitacoes_aula_experimental
  drop constraint if exists solicitacoes_aula_experimental_status_check;

alter table public.solicitacoes_aula_experimental
  add constraint solicitacoes_aula_experimental_status_check
  check (
    status = any (
      array[
        'pendente'::text,
        'aguardando_aceite_professor'::text,
        'agendado'::text,
        'aprovada_para_matricula'::text,
        'faltou'::text,
        'cancelado'::text,
        'nao_vai_continuar'::text,
        'matricula_em_andamento'::text
      ]
    )
  );

commit;
