alter table public.matriculas
add column if not exists data_inicio date;

alter table public.solicitacoes_aula_experimental
add column if not exists data_aula_experimental date;
