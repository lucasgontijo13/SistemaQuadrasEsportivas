begin;

alter table public.matriculas
  add column if not exists status_pos_aceite text,
  add column if not exists professor_indicacao_id uuid;

alter table public.matriculas
  drop constraint if exists matriculas_professor_indicacao_id_fkey;

alter table public.matriculas
  add constraint matriculas_professor_indicacao_id_fkey
  foreign key (professor_indicacao_id) references public.perfis(id);

alter table public.matriculas
  drop constraint if exists matriculas_status_pos_aceite_check;

alter table public.matriculas
  add constraint matriculas_status_pos_aceite_check
  check (
    status_pos_aceite is null
    or status_pos_aceite = any (
      array[
        'ativo'::text,
        'aguardando_dados'::text,
        'aguardando_pagamento'::text
      ]
    )
  );

alter table public.matriculas
  drop constraint if exists matriculas_status_check;

alter table public.matriculas
  add constraint matriculas_status_check
  check (
    status = any (
      array[
        'experimental'::text,
        'aguardando_dados'::text,
        'aguardando_pagamento'::text,
        'ativo'::text,
        'inativo'::text,
        'pendente'::text,
        'aguardando_aceite_professor'::text
      ]
    )
  );

create index if not exists matriculas_professor_indicacao_id_idx
  on public.matriculas(professor_indicacao_id);

create index if not exists matriculas_status_idx
  on public.matriculas(status);

commit;
