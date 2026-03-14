begin;

alter table public.solicitacoes_aula_experimental
  add column if not exists professor_origem_transferencia_id uuid,
  add column if not exists ultimo_contato_whatsapp_em timestamp with time zone;

alter table public.solicitacoes_aula_experimental
  drop constraint if exists solicitacoes_aula_experimental_professor_origem_transferencia_id_fkey;

alter table public.solicitacoes_aula_experimental
  add constraint solicitacoes_aula_experimental_professor_origem_transferencia_id_fkey
  foreign key (professor_origem_transferencia_id) references public.perfis(id);

create index if not exists solicitacoes_aula_experimental_professor_origem_transferencia_idx
  on public.solicitacoes_aula_experimental(professor_origem_transferencia_id);

create index if not exists solicitacoes_aula_experimental_ultimo_contato_whatsapp_idx
  on public.solicitacoes_aula_experimental(ultimo_contato_whatsapp_em);

commit;
