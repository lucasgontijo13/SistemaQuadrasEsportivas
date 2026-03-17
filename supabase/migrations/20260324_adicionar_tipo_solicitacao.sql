alter table public.solicitacoes_aula_experimental
add column if not exists tipo_solicitacao text not null default 'experimental';

update public.solicitacoes_aula_experimental
set tipo_solicitacao = 'experimental'
where tipo_solicitacao is null;

alter table public.solicitacoes_aula_experimental
drop constraint if exists solicitacoes_aula_experimental_tipo_solicitacao_check;

alter table public.solicitacoes_aula_experimental
add constraint solicitacoes_aula_experimental_tipo_solicitacao_check
check (tipo_solicitacao = any (array['experimental'::text, 'matricula'::text]));
