alter table public.perfis
add column if not exists permitir_nova_experimental boolean not null default true;
