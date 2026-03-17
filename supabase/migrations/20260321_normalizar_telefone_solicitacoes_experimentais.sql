update public.solicitacoes_aula_experimental
set telefone_aluno = regexp_replace(telefone_aluno, '\D', '', 'g')
where telefone_aluno is not null
  and telefone_aluno <> regexp_replace(telefone_aluno, '\D', '', 'g');
