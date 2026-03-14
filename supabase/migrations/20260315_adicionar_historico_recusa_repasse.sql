alter table public.solicitacoes_aula_experimental
add column if not exists ultima_recusa_repasse_por_id uuid references public.perfis(id),
add column if not exists ultima_recusa_repasse_observacao text,
add column if not exists ultima_recusa_repasse_em timestamp with time zone;
