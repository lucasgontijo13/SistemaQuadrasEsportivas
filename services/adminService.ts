import { supabase } from "@/lib/supabase";
import {
  DadosNovoProfessor,
  DadosTurma,
  HorarioQuadra,
  Matricula,
  Perfil,
  ProfessorResumo,
  SolicitacaoAula,
  Turma,
} from "@/types";

const normalizarTelefone = (telefone: string) => telefone.replace(/\D/g, "");
const gerarVariacoesTelefone = (telefone: string) => {
  const telefoneLimpo = normalizarTelefone(telefone);
  const variacoes = new Set<string>();
  const numerosLocais = new Set<string>();

  if (!telefoneLimpo) return [];

  numerosLocais.add(telefoneLimpo);

  if (telefoneLimpo.startsWith("55") && (telefoneLimpo.length === 12 || telefoneLimpo.length === 13)) {
    numerosLocais.add(telefoneLimpo.slice(2));
  }

  numerosLocais.forEach((numero) => {
    variacoes.add(numero);
    variacoes.add(`55${numero}`);
    variacoes.add(`+55${numero}`);

    if (numero.length === 11) {
      variacoes.add(`(${numero.slice(0, 2)}) ${numero.slice(2, 7)}-${numero.slice(7)}`);
      variacoes.add(`+55 (${numero.slice(0, 2)}) ${numero.slice(2, 7)}-${numero.slice(7)}`);
    }

    if (numero.length === 10) {
      variacoes.add(`(${numero.slice(0, 2)}) ${numero.slice(2, 6)}-${numero.slice(6)}`);
      variacoes.add(`+55 (${numero.slice(0, 2)}) ${numero.slice(2, 6)}-${numero.slice(6)}`);
    }
  });

  return Array.from(variacoes);
};

const mensagemErro = (error: unknown) =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : "";

const colunaPerfilSolicitacaoIndisponivel = (error: unknown) => {
  const message = mensagemErro(error).toLowerCase();
  return message.includes("perfil_id") && message.includes("solicitacoes_aula_experimental");
};
const mapaDiaSemana: Record<string, number> = {
  Domingo: 0,
  Segunda: 1,
  "Terça": 2,
  Quarta: 3,
  Quinta: 4,
  Sexta: 5,
  Sábado: 6,
};

const dataCorrespondeAoDiaDaTurma = (data: string, diaSemana: string) => {
  const diaEsperado = mapaDiaSemana[diaSemana];
  if (diaEsperado === undefined) return false;

  const referencia = new Date(`${data}T12:00:00`);
  return !Number.isNaN(referencia.getTime()) && referencia.getDay() === diaEsperado;
};

const dataNaoPodeSerPassado = (data: string) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const referencia = new Date(`${data}T12:00:00`);
  referencia.setHours(0, 0, 0, 0);

  return referencia >= hoje;
};

const statusSolicitacoesAtivas: SolicitacaoAula["status"][] = [
  "pendente",
  "aguardando_aceite_professor",
  "agendado",
  "faltou",
  "aprovada_para_matricula",
];

const statusMatriculasQueOcupamVaga: Matricula["status"][] = [
  "experimental",
  "ativo",
  "aguardando_dados",
  "aguardando_pagamento",
];

const statusMatriculasRegularesAtivas: Matricula["status"][] = [
  "ativo",
  "aguardando_dados",
  "aguardando_pagamento",
];
const statusMatriculasRegularesEmAndamento: Matricula["status"][] = [
  ...statusMatriculasRegularesAtivas,
  "aguardando_aceite_professor",
];

const statusMatriculasExperimentaisReagendaveis: Matricula["status"][] = [
  "experimental",
  "pendente",
];

const perfilTemCadastroCompleto = (
  perfil?: Pick<Perfil, "cpf" | "data_nascimento" | "contato_emergencia" | "cep" | "rua" | "numero"> | null
) =>
  !!perfil?.cpf &&
  !!perfil?.data_nascimento &&
  !!perfil?.contato_emergencia &&
  !!perfil?.cep &&
  !!perfil?.rua &&
  !!perfil?.numero;

const buscarResumoSolicitacao = async (solicitacaoId: string) => {
  const selectComPerfilId =
    "id, perfil_id, professor_preferido_id, professor_responsavel_id, professor_origem_transferencia_id, turma_sugerida_id, ultima_recusa_repasse_por_id, ultima_recusa_repasse_observacao, ultima_recusa_repasse_em, data_aula_experimental, resultado_experimental_em, status";
  const selectLegado =
    "id, professor_preferido_id, professor_responsavel_id, professor_origem_transferencia_id, turma_sugerida_id, ultima_recusa_repasse_por_id, ultima_recusa_repasse_observacao, ultima_recusa_repasse_em, data_aula_experimental, resultado_experimental_em, status";

  let { data, error } = await supabase
    .from("solicitacoes_aula_experimental")
    .select(selectComPerfilId)
    .eq("id", solicitacaoId)
    .maybeSingle();

  if (error && colunaPerfilSolicitacaoIndisponivel(error)) {
    const retry = await supabase
      .from("solicitacoes_aula_experimental")
      .select(selectLegado)
      .eq("id", solicitacaoId)
      .maybeSingle();

    data = retry.data ? { ...retry.data, perfil_id: null } : retry.data;
    error = retry.error;
  }

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solicitação de aula experimental não encontrada.");

  return data as {
    id: string;
    perfil_id: string | null;
    professor_preferido_id: string | null;
    professor_responsavel_id: string | null;
    professor_origem_transferencia_id: string | null;
    turma_sugerida_id: number | null;
    ultima_recusa_repasse_por_id: string | null;
    ultima_recusa_repasse_observacao: string | null;
    ultima_recusa_repasse_em: string | null;
    data_aula_experimental: string | null;
    resultado_experimental_em: string | null;
    status: SolicitacaoAula["status"];
  };
};

const solicitacaoExigeProfessorPreferido = (solicitacao: {
  professor_preferido_id: string | null;
  professor_responsavel_id: string | null;
}) =>
  !!solicitacao.professor_preferido_id &&
  (!solicitacao.professor_responsavel_id ||
    solicitacao.professor_responsavel_id === solicitacao.professor_preferido_id);

const enriquecerProfessor = (
  professorId: string | null | undefined,
  professoresMap: Map<string, ProfessorResumo>
) => {
  const professor = professorId ? professoresMap.get(professorId) || null : null;

  return {
    professor_id: professorId || null,
    professor: professor || null,
  };
};

const enriquecerTurma = (
  turma: {
    id: number;
    dia_semana: string;
    horario: string;
    nivel: string;
    professor_id?: string | null;
    professor?: string | null;
    vagas_totais: number;
    ativa?: boolean | null;
    matriculas?: Matricula[];
  },
  professoresMap: Map<string, ProfessorResumo>
): Turma => ({
  id: turma.id,
  dia_semana: turma.dia_semana,
  horario: turma.horario,
  nivel: turma.nivel,
  vagas_totais: turma.vagas_totais,
  ativa: turma.ativa ?? true,
  matriculas: turma.matriculas || [],
  ...enriquecerProfessor(turma.professor_id, professoresMap),
});

const enriquecerSolicitacao = (
  solicitacao: {
    id: string;
    created_at: string;
    nome_aluno: string;
    perfil_id?: string | null;
    telefone_aluno: string;
    data_nascimento?: string | null;
    horarios_preferencia: string;
    professor_preferido_id?: string | null;
    professor_responsavel_id?: string | null;
    professor_origem_transferencia_id?: string | null;
    turma_sugerida_id?: number | null;
    ultima_recusa_repasse_por_id?: string | null;
    ultima_recusa_repasse_observacao?: string | null;
    ultima_recusa_repasse_em?: string | null;
    data_aula_experimental?: string | null;
    resultado_experimental_em?: string | null;
    status: SolicitacaoAula["status"];
    nivel_experiencia?: string | null;
    ultimo_contato_whatsapp_em?: string | null;
  },
  professoresMap: Map<string, ProfessorResumo>
): SolicitacaoAula => ({
  id: solicitacao.id,
  created_at: solicitacao.created_at,
  nome_aluno: solicitacao.nome_aluno,
  perfil_id: solicitacao.perfil_id || null,
  telefone_aluno: solicitacao.telefone_aluno,
  data_nascimento: solicitacao.data_nascimento || null,
  horarios_preferencia: solicitacao.horarios_preferencia,
  professor_preferido_id: solicitacao.professor_preferido_id || null,
  professor_responsavel_id: solicitacao.professor_responsavel_id || null,
  professor_origem_transferencia_id: solicitacao.professor_origem_transferencia_id || null,
  turma_sugerida_id: solicitacao.turma_sugerida_id || null,
  ultima_recusa_repasse_por_id: solicitacao.ultima_recusa_repasse_por_id || null,
  ultima_recusa_repasse_observacao: solicitacao.ultima_recusa_repasse_observacao || null,
  ultima_recusa_repasse_em: solicitacao.ultima_recusa_repasse_em || null,
  data_aula_experimental: solicitacao.data_aula_experimental || null,
  resultado_experimental_em: solicitacao.resultado_experimental_em || null,
  professor_preferido: solicitacao.professor_preferido_id
    ? professoresMap.get(solicitacao.professor_preferido_id) || null
    : null,
  professor_responsavel: solicitacao.professor_responsavel_id
    ? professoresMap.get(solicitacao.professor_responsavel_id) || null
    : null,
  professor_origem_transferencia: solicitacao.professor_origem_transferencia_id
    ? professoresMap.get(solicitacao.professor_origem_transferencia_id) || null
    : null,
  ultima_recusa_repasse_por: solicitacao.ultima_recusa_repasse_por_id
    ? professoresMap.get(solicitacao.ultima_recusa_repasse_por_id) || null
    : null,
  status: solicitacao.status,
  nivel_experiencia: solicitacao.nivel_experiencia || undefined,
  ultimo_contato_whatsapp_em: solicitacao.ultimo_contato_whatsapp_em || null,
});

async function buscarPerfilAlunoPorWhatsapp(
  telefoneLimpo: string,
  select: string
) {
  const telefonesBusca = gerarVariacoesTelefone(telefoneLimpo);

  const { data, error } = await supabase
    .from("perfis")
    .select(select)
    .in("whatsapp", telefonesBusca)
    .eq("tipo", "aluno")
    .limit(2);

  if (error) throw new Error(error.message);

  const perfis = (data || []) as Array<Record<string, unknown>>;

  if (perfis.length === 0) {
    return null;
  }

  if (perfis.length > 1) {
    throw new Error(
      "Encontramos mais de um aluno com este WhatsApp. Ajuste o cadastro antes de continuar."
    );
  }

  return perfis[0];
}

async function buscarPerfilAlunoPorId(perfilId: string, select: string) {
  const { data, error } = await supabase
    .from("perfis")
    .select(select)
    .eq("id", perfilId)
    .eq("tipo", "aluno")
    .maybeSingle();

  if (error) throw new Error(error.message);

  return (data as Record<string, unknown> | null) || null;
}

async function buscarPerfilAlunoDaSolicitacao(
  solicitacao: { id: string; perfil_id?: string | null },
  telefoneLimpo: string,
  select: string
) {
  if (solicitacao.perfil_id) {
    const perfilPorId = await buscarPerfilAlunoPorId(solicitacao.perfil_id, select);

    if (perfilPorId) {
      return perfilPorId;
    }
  }

  const perfilPorWhatsapp = await buscarPerfilAlunoPorWhatsapp(telefoneLimpo, select);

  if (perfilPorWhatsapp && !solicitacao.perfil_id && typeof perfilPorWhatsapp.id === "string") {
    const { error } = await supabase
      .from("solicitacoes_aula_experimental")
      .update({ perfil_id: perfilPorWhatsapp.id })
      .eq("id", solicitacao.id);

    if (error && !colunaPerfilSolicitacaoIndisponivel(error)) {
      console.error("Não foi possível vincular o perfil à solicitação experimental:", error);
    }
  }

  return perfilPorWhatsapp;
}

export async function verificarPermissaoAdmin(): Promise<{ autorizado: boolean; tipo: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { autorizado: false, tipo: "" };

  const { data: perfil, error } = await supabase
    .from("perfis")
    .select("tipo")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao verificar permissão no perfil:", error);
  }

  const tipoMetadata =
    (typeof session.user.user_metadata?.tipo === "string" && session.user.user_metadata.tipo) ||
    (typeof session.user.app_metadata?.tipo === "string" && session.user.app_metadata.tipo) ||
    (typeof session.user.app_metadata?.role === "string" && session.user.app_metadata.role) ||
    "";

  const tipoPerfil = perfil?.tipo || tipoMetadata || "aluno";

  return {
    autorizado: tipoPerfil === "admin" || tipoPerfil === "professor",
    tipo: tipoPerfil,
  };
}

export async function buscarDadosPainel(
  tipoPerfil: string = "admin",
  perfilId?: string
) {
  const selectPerfilBase =
    "id, nome, email, whatsapp, tipo, nivel, permitir_nova_experimental, data_nascimento, contato_emergencia, sexo, necessidade_especial, objetivo";
  const selectPerfilAdmin = `${selectPerfilBase}, cpf, cep, rua, numero`;
  const selectPerfil = tipoPerfil === "admin" ? selectPerfilAdmin : selectPerfilBase;
  const selectPerfilResumoBase = "id, nome, nivel, whatsapp, data_nascimento, contato_emergencia";
  const selectPerfilResumo =
    tipoPerfil === "admin" ? `${selectPerfilResumoBase}, cpf` : selectPerfilResumoBase;

  const { data: professoresData, error: professoresError } = await supabase
    .from("perfis")
    .select(selectPerfil)
    .eq("tipo", "professor")
    .order("nome", { ascending: true });

  if (professoresError) throw new Error(professoresError.message);

  const professores = (professoresData as Perfil[]) || [];
  const professoresMap = new Map<string, ProfessorResumo>(
    professores.map((professor) => [professor.id, { id: professor.id, nome: professor.nome }])
  );

  const selectTurmasPainel = `
      id,
      dia_semana,
      horario,
      nivel,
      professor_id,
      vagas_totais,
      ativa,
      matriculas (
        id,
        status,
        data_inicio,
        status_pos_aceite,
        professor_indicacao_id,
        ultima_recusa_professor_id,
        ultima_recusa_observacao,
        ultima_recusa_em,
        perfil_id,
        perfis:perfis!matriculas_perfil_id_fkey (
          ${selectPerfilResumo}
        )
      )
    `;

  let turmasQuery = supabase
    .from("turmas")
    .select(selectTurmasPainel)
    .order("id", { ascending: true });

  if (tipoPerfil === "professor" && perfilId) {
    turmasQuery = turmasQuery.eq("professor_id", perfilId);
  }

  const { data: turmasData, error: turmasError } = await turmasQuery;

  if (turmasError) throw new Error(turmasError.message);

  let turmasParaFluxosData = turmasData;

  if (tipoPerfil === "professor") {
    const { data, error } = await supabase
      .from("turmas")
      .select(selectTurmasPainel)
      .order("id", { ascending: true });

    if (error) throw new Error(error.message);
    turmasParaFluxosData = data;
  }

  const turmasVisiveisIds = (
    (turmasData as Array<{ id: number }> | null) || []
  ).map((turma) => turma.id);

  const { data: quadrasData, error: quadrasError } = await supabase
    .from("horarios_quadra")
    .select("*")
    .order("horario_inicio", { ascending: true });

  if (quadrasError) throw new Error(quadrasError.message);

  const selectTurmasMatricula = `
    id,
    dia_semana,
    horario,
    nivel,
    professor_id,
    vagas_totais,
    ativa
  `;
  const selectMatriculas =
    `
      id,
      status,
      data_inicio,
      status_pos_aceite,
      professor_indicacao_id,
      ultima_recusa_professor_id,
      ultima_recusa_observacao,
      ultima_recusa_em,
      perfil_id,
      turma_id,
      perfis:perfis!matriculas_perfil_id_fkey (${selectPerfil}),
      turmas (
        ${selectTurmasMatricula}
      )
    `;

  let matriculasQuery = supabase
    .from("matriculas")
    .select(selectMatriculas)
    .order("id", { ascending: false });

  if (tipoPerfil === "professor" && perfilId) {
    if (turmasVisiveisIds.length === 0) {
      matriculasQuery = matriculasQuery.eq("professor_indicacao_id", perfilId);
    } else {
      const listaTurmas = turmasVisiveisIds.join(",");
      matriculasQuery = matriculasQuery.or(
        `turma_id.in.(${listaTurmas}),professor_indicacao_id.eq.${perfilId}`
      );
    }
  }

  const { data: matriculasData, error: matriculasError } = await matriculasQuery;

  if (matriculasError) throw new Error(matriculasError.message);

  const perfisIdsRelacionados = Array.from(
    new Set(
      (((matriculasData as Array<{ perfil_id: string }> | null) || []).map((matricula) => matricula.perfil_id)).filter(Boolean)
    )
  );

  let alunos: Perfil[] = [];

  if (tipoPerfil === "admin") {
    const { data: alunosData, error: alunosError } = await supabase
      .from("perfis")
      .select(selectPerfil)
      .eq("tipo", "aluno")
      .order("nome", { ascending: true });

    if (alunosError) throw new Error(alunosError.message);
    alunos = (alunosData as Perfil[]) || [];
  } else if (perfisIdsRelacionados.length > 0) {
    const { data: alunosData, error: alunosError } = await supabase
      .from("perfis")
      .select(selectPerfil)
      .eq("tipo", "aluno")
      .in("id", perfisIdsRelacionados)
      .order("nome", { ascending: true });

    if (alunosError) throw new Error(alunosError.message);
    alunos = (alunosData as Perfil[]) || [];
  }

  return {
    turmas:
      ((turmasData as Array<{
        id: number;
        dia_semana: string;
        horario: string;
        nivel: string;
        professor_id?: string | null;
        vagas_totais: number;
        ativa?: boolean | null;
        matriculas?: Matricula[];
      }> | null)?.map((turma) => enriquecerTurma(turma, professoresMap)) || []),
    turmasParaFluxos:
      ((turmasParaFluxosData as Array<{
        id: number;
        dia_semana: string;
        horario: string;
        nivel: string;
        professor_id?: string | null;
        vagas_totais: number;
        ativa?: boolean | null;
        matriculas?: Matricula[];
      }> | null)?.map((turma) => enriquecerTurma(turma, professoresMap)) || []),
    horariosQuadra: (quadrasData as HorarioQuadra[]) || [],
    matriculas:
      ((matriculasData as Array<
        Omit<Matricula, "turmas"> & {
          turmas?: {
            id: number;
            dia_semana: string;
            horario: string;
            nivel: string;
            professor_id?: string | null;
            vagas_totais: number;
            ativa?: boolean | null;
          } | null;
        }
      > | null)?.map((matricula) => ({
        ...matricula,
        turmas: matricula.turmas ? enriquecerTurma({ ...matricula.turmas, matriculas: [] }, professoresMap) : undefined,
      })) || []),
    alunos,
    professores,
  };
}

export async function atualizarTurmasAluno({
  perfilId,
  nivel,
  turmasIds,
  dataInicioPlano,
}: {
  perfilId: string;
  nivel: string;
  turmasIds: number[];
  dataInicioPlano: string;
}) {
  if (!perfilId) throw new Error("Aluno não identificado para atualização.");

  const turmasUnicas = [...new Set(turmasIds)];

  const { error: perfilError } = await supabase
    .from("perfis")
    .update({ nivel })
    .eq("id", perfilId);

  if (perfilError) throw new Error(perfilError.message);

  const { data: matriculasExistentes, error: buscarMatriculasError } = await supabase
    .from("matriculas")
    .select("id, turma_id, status, data_inicio")
    .eq("perfil_id", perfilId);

  if (buscarMatriculasError) throw new Error(buscarMatriculasError.message);

  const matriculasAluno =
    (matriculasExistentes as Array<{
      id: number;
      turma_id: number;
      status: Matricula["status"];
      data_inicio: string | null;
    }>) || [];

  const matriculasRegulares = matriculasAluno.filter(
    (matricula) =>
      !["experimental", "pendente", "aguardando_aceite_professor"].includes(matricula.status)
  );
  const matriculasRegularesAtivas = matriculasRegulares.filter(
    (matricula) => matricula.status !== "inativo"
  );
  const statusBase =
    matriculasRegularesAtivas.find((matricula) =>
      statusMatriculasRegularesAtivas.includes(matricula.status)
    )?.status || "ativo";

  let turmasSelecionadas: Array<{
    id: number;
    dia_semana: string;
    horario: string;
    vagas_totais: number;
    ativa: boolean | null;
  }> = [];

  if (turmasUnicas.length > 0 && !dataInicioPlano) {
    throw new Error("Defina a data de início do plano.");
  }

  if (dataInicioPlano && !dataNaoPodeSerPassado(dataInicioPlano)) {
    throw new Error("Escolha uma data de início igual ou posterior a hoje.");
  }

  if (turmasUnicas.length > 0) {
    const { data, error } = await supabase
      .from("turmas")
      .select("id, dia_semana, horario, vagas_totais, ativa")
      .in("id", turmasUnicas);

    if (error) throw new Error(error.message);
    turmasSelecionadas = (data as typeof turmasSelecionadas) || [];
  }

  const turmasMap = new Map<number, (typeof turmasSelecionadas)[number]>(
    turmasSelecionadas.map((turma) => [turma.id, turma])
  );

  for (const turmaId of turmasUnicas) {
    const turma = turmasMap.get(turmaId);

    if (!turma || turma.ativa === false) {
      throw new Error("Uma das turmas selecionadas não está mais disponível.");
    }

    const { count, error: lotacaoError } = await supabase
      .from("matriculas")
      .select("*", { count: "exact", head: true })
      .eq("turma_id", turmaId)
      .in("status", statusMatriculasQueOcupamVaga)
      .neq("perfil_id", perfilId);

    if (lotacaoError) throw new Error(lotacaoError.message);
    if ((count ?? 0) >= turma.vagas_totais) {
      throw new Error(`A turma de ${turma.dia_semana}, às ${turma.horario.substring(0, 5)} já está lotada.`);
    }
  }

  const matriculasPorTurma = matriculasRegulares.reduce((mapa, matricula) => {
    const lista = mapa.get(matricula.turma_id) || [];
    lista.push(matricula);
    mapa.set(matricula.turma_id, lista);
    return mapa;
  }, new Map<number, typeof matriculasRegulares>());

  for (const turmaId of turmasUnicas) {
    const matriculasDaTurma = matriculasPorTurma.get(turmaId) || [];
    const matriculaPreferencial =
      matriculasDaTurma.find((matricula) => matricula.status !== "inativo") || matriculasDaTurma[0];

    if (matriculaPreferencial) {
      const { error } = await supabase
        .from("matriculas")
        .update({
          status: statusBase,
          data_inicio: dataInicioPlano || null,
          status_pos_aceite: null,
          professor_indicacao_id: null,
          ultima_recusa_professor_id: null,
          ultima_recusa_observacao: null,
          ultima_recusa_em: null,
        })
        .eq("id", matriculaPreferencial.id);

      if (error) throw new Error(error.message);
      continue;
    }

    const { error } = await supabase
      .from("matriculas")
      .insert([{
        perfil_id: perfilId,
        turma_id: turmaId,
        status: statusBase,
        data_inicio: dataInicioPlano || null,
      }]);

    if (error) throw new Error(error.message);
  }

  const matriculasParaInativar = matriculasRegularesAtivas.filter(
    (matricula) => !turmasUnicas.includes(matricula.turma_id)
  );

  for (const matricula of matriculasParaInativar) {
    const { error } = await supabase
      .from("matriculas")
      .update({ status: "inativo" })
      .eq("id", matricula.id);

    if (error) throw new Error(error.message);
  }

  return {
    totalTurmasAtivas: turmasUnicas.length,
    statusAplicado: statusBase,
  };
}

export async function cadastrarNovoProfessor(dados: DadosNovoProfessor) {
  const response = await fetch("/api/professores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(resultado.erro || "Erro ao cadastrar professor");
  }

  return true;
}

export async function excluirProfessor(perfilId: string) {
  const response = await fetch(`/api/professores?id=${perfilId}`, {
    method: "DELETE",
  });

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(resultado.erro || "Erro ao excluir professor.");
  }

  return true;
}

export async function excluirRegistro(tabela: "turmas" | "horarios_quadra" | "matriculas", id: number) {
  const { error } = await supabase.from(tabela).delete().eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}

export async function salvarTurma(dados: DadosTurma, idEdicao: number | null) {
  if (!dados.professor_id) {
    throw new Error("Selecione o professor responsável pela turma.");
  }

  if (idEdicao) {
    const { error } = await supabase.from("turmas").update(dados).eq("id", idEdicao);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("turmas").insert([dados]);
    if (error) throw new Error(error.message);
  }
  return true;
}

export async function salvarQuadra(dados: Partial<HorarioQuadra>, idEdicao: number | null) {
  if (idEdicao) {
    const { error } = await supabase.from("horarios_quadra").update(dados).eq("id", idEdicao);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("horarios_quadra").insert([dados]);
    if (error) throw new Error(error.message);
  }
  return true;
}

export async function efetivarMatricula({
  matriculaId,
  perfilId,
  turmasIds,
  nivel,
  dataInicioPlano,
  solicitacaoId,
  tipoPerfil,
  professorSolicitanteId,
}: {
  matriculaId: number;
  perfilId: string;
  turmasIds: number[];
  nivel: string;
  dataInicioPlano: string;
  solicitacaoId?: string | null;
  tipoPerfil: string;
  professorSolicitanteId?: string | null;
}) {
  if (!perfilId) throw new Error("Aluno não identificado para efetivação.");
  if (turmasIds.length === 0) throw new Error("Selecione pelo menos uma turma para efetivar o aluno.");
  if (!dataInicioPlano) throw new Error("Defina a data de início do plano.");

  const turmasUnicas = [...new Set(turmasIds)];

  if (!dataNaoPodeSerPassado(dataInicioPlano)) {
    throw new Error("Escolha uma data de início igual ou posterior a hoje.");
  }

  const { error: perfilError } = await supabase
    .from("perfis")
    .update({ nivel, permitir_nova_experimental: false })
    .eq("id", perfilId);

  if (perfilError) throw new Error(perfilError.message);

  const { data: perfilAluno, error: perfilAlunoError } = await supabase
    .from("perfis")
    .select("cpf, data_nascimento, contato_emergencia, cep, rua, numero")
    .eq("id", perfilId)
    .maybeSingle();

  if (perfilAlunoError) throw new Error(perfilAlunoError.message);

  const statusDestino: Matricula["status"] = perfilTemCadastroCompleto(
    perfilAluno as Pick<Perfil, "cpf" | "data_nascimento" | "contato_emergencia" | "cep" | "rua" | "numero"> | null
  )
    ? "aguardando_pagamento"
    : "aguardando_dados";

  const { data: matriculasExistentes, error: buscarMatriculasError } = await supabase
    .from("matriculas")
    .select("id, turma_id, status")
    .eq("perfil_id", perfilId);

  if (buscarMatriculasError) throw new Error(buscarMatriculasError.message);

  const matriculas = (matriculasExistentes as Array<{ id: number; turma_id: number; status: Matricula["status"] }>) || [];
  const origem = matriculas.find((matricula) => matricula.id === matriculaId) || null;

  const { data: turmasSelecionadas, error: turmasSelecionadasError } = await supabase
    .from("turmas")
    .select("id, dia_semana, horario, professor_id, ativa, vagas_totais")
    .in("id", turmasUnicas);

  if (turmasSelecionadasError) throw new Error(turmasSelecionadasError.message);

  const turmasMap = new Map<
    number,
    { id: number; dia_semana: string; horario: string; professor_id: string | null; ativa: boolean | null; vagas_totais: number }
  >(
    ((turmasSelecionadas as Array<{ id: number; dia_semana: string; horario: string; professor_id: string | null; ativa: boolean | null; vagas_totais: number }>) || []).map((turma) => [turma.id, turma])
  );

  let totalMatriculasDiretas = 0;
  let totalMatriculasPendentes = 0;

  for (const turmaId of turmasUnicas) {
    const turma = turmasMap.get(turmaId);

    if (!turma || turma.ativa === false) {
      throw new Error("Uma das turmas selecionadas não está mais disponível.");
    }

    const { count, error: lotacaoError } = await supabase
      .from("matriculas")
      .select("*", { count: "exact", head: true })
      .eq("turma_id", turmaId)
      .in("status", statusMatriculasQueOcupamVaga)
      .neq("perfil_id", perfilId);

    if (lotacaoError) throw new Error(lotacaoError.message);
    if ((count ?? 0) >= turma.vagas_totais) {
      throw new Error(`A turma de ${turma.dia_semana}, às ${turma.horario.substring(0, 5)} já está lotada.`);
    }
  }

  for (const turmaId of turmasUnicas) {
    const matriculaDaTurma = matriculas.find((matricula) => matricula.turma_id === turmaId);
    const turma = turmasMap.get(turmaId);

    if (!turma) continue;

    const precisaAceiteOutroProfessor =
      tipoPerfil === "professor" &&
      !!professorSolicitanteId &&
      !!turma.professor_id &&
      turma.professor_id !== professorSolicitanteId;

    const dadosAtualizacao = precisaAceiteOutroProfessor
      ? {
          status: "aguardando_aceite_professor" as Matricula["status"],
          data_inicio: dataInicioPlano,
          status_pos_aceite: statusDestino,
          professor_indicacao_id: professorSolicitanteId,
          ultima_recusa_professor_id: null,
          ultima_recusa_observacao: null,
          ultima_recusa_em: null,
        }
      : {
          status: statusDestino,
          data_inicio: dataInicioPlano,
          status_pos_aceite: null,
          professor_indicacao_id: null,
          ultima_recusa_professor_id: null,
          ultima_recusa_observacao: null,
          ultima_recusa_em: null,
        };

    if (matriculaDaTurma) {
      const { error } = await supabase
        .from("matriculas")
        .update(dadosAtualizacao)
        .eq("id", matriculaDaTurma.id);

      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("matriculas")
        .insert([{ perfil_id: perfilId, turma_id: turmaId, ...dadosAtualizacao }]);

      if (error) throw new Error(error.message);
    }

    if (precisaAceiteOutroProfessor) {
      totalMatriculasPendentes += 1;
    } else {
      totalMatriculasDiretas += 1;
    }
  }

  if (origem && !turmasUnicas.includes(origem.turma_id)) {
    const { error } = await supabase
      .from("matriculas")
      .update({ status: "inativo", status_pos_aceite: null, professor_indicacao_id: null })
      .eq("id", origem.id);

    if (error) throw new Error(error.message);
  }

  if (solicitacaoId) {
    const { error: solicitacaoError } = await supabase
      .from("solicitacoes_aula_experimental")
      .update({
        status: "matricula_em_andamento",
        resultado_experimental_em: new Date().toISOString(),
      })
      .eq("id", solicitacaoId);

    if (solicitacaoError) throw new Error(solicitacaoError.message);
  }

  return {
    totalMatriculasDiretas,
    totalMatriculasPendentes,
    dataInicioPlano,
  };
}

export async function aceitarMatriculaPendenteProfessor(matriculaId: number, professorId: string) {
  const { data: matricula, error } = await supabase
    .from("matriculas")
    .select(`
      id,
      status,
      status_pos_aceite,
      turma_id,
      turmas:turmas!inner (
        id,
        professor_id,
        vagas_totais,
        dia_semana,
        horario
      )
    `)
    .eq("id", matriculaId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!matricula) throw new Error("Matrícula pendente não encontrada.");
  if (matricula.status !== "aguardando_aceite_professor") {
    throw new Error("Esta matrícula não está aguardando aceite.");
  }

  const turma = Array.isArray(matricula.turmas) ? matricula.turmas[0] : matricula.turmas;
  if (!turma || turma.professor_id !== professorId) {
    throw new Error("Você não pode aceitar uma matrícula de outra turma.");
  }

  const { count, error: lotacaoError } = await supabase
    .from("matriculas")
    .select("*", { count: "exact", head: true })
    .eq("turma_id", matricula.turma_id)
    .in("status", statusMatriculasQueOcupamVaga)
    .neq("id", matriculaId);

  if (lotacaoError) throw new Error(lotacaoError.message);
  if ((count ?? 0) >= turma.vagas_totais) {
    throw new Error(`A turma de ${turma.dia_semana}, às ${turma.horario.substring(0, 5)} lotou antes do aceite.`);
  }

  const statusFinal = (matricula.status_pos_aceite as Matricula["status"] | null) || "aguardando_pagamento";
  const { error: updateError } = await supabase
    .from("matriculas")
    .update({
      status: statusFinal,
      status_pos_aceite: null,
      professor_indicacao_id: null,
      ultima_recusa_professor_id: null,
      ultima_recusa_observacao: null,
      ultima_recusa_em: null,
    })
    .eq("id", matriculaId);

  if (updateError) throw new Error(updateError.message);
  return true;
}

export async function recusarMatriculaPendenteProfessor(
  matriculaId: number,
  professorId: string,
  observacao: string
) {
  const { data: matricula, error } = await supabase
    .from("matriculas")
    .select(`
      id,
      status,
      turma_id,
      turmas:turmas!inner (
        id,
        professor_id
      )
    `)
    .eq("id", matriculaId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!matricula) throw new Error("Matrícula pendente não encontrada.");
  if (matricula.status !== "aguardando_aceite_professor") {
    throw new Error("Esta matrícula não está aguardando aceite.");
  }

  const observacaoNormalizada = observacao.trim();
  if (!observacaoNormalizada) {
    throw new Error("Adicione uma observação para recusar esta turma.");
  }

  const turma = Array.isArray(matricula.turmas) ? matricula.turmas[0] : matricula.turmas;
  if (!turma || turma.professor_id !== professorId) {
    throw new Error("Você não pode recusar uma matrícula de outra turma.");
  }

  const { error: updateError } = await supabase
    .from("matriculas")
    .update({
      status: "inativo",
      status_pos_aceite: null,
      ultima_recusa_professor_id: professorId,
      ultima_recusa_observacao: observacaoNormalizada,
      ultima_recusa_em: new Date().toISOString(),
    })
    .eq("id", matriculaId);

  if (updateError) throw new Error(updateError.message);
  return true;
}

export async function atualizarPerfil(perfilId: string, dados: Partial<Perfil>) {
  const { error } = await supabase.from("perfis").update(dados).eq("id", perfilId);
  if (error) throw new Error(error.message);
  return true;
}

export async function atualizarPermissaoNovaExperimental(perfilId: string, permitir: boolean) {
  if (permitir) {
    const { data: matriculaEmAndamento, error: matriculaError } = await supabase
      .from("matriculas")
      .select("id")
      .eq("perfil_id", perfilId)
      .in("status", statusMatriculasRegularesEmAndamento)
      .limit(1)
      .maybeSingle();

    if (matriculaError) throw new Error(matriculaError.message);

    if (matriculaEmAndamento) {
      throw new Error("O aluno ainda tem matrícula em andamento. Remova os horários atuais antes de liberar outra aula experimental.");
    }
  }

  const { error } = await supabase
    .from("perfis")
    .update({ permitir_nova_experimental: permitir })
    .eq("id", perfilId);

  if (error) throw new Error(error.message);
  return true;
}

export async function atualizarMatriculaAluno({
  matriculaId,
  perfilId,
  nivel,
  turmaId,
  dataInicio,
  solicitacaoId,
}: {
  matriculaId: number;
  perfilId: string;
  nivel: string;
  turmaId: number;
  dataInicio: string;
  solicitacaoId?: string | null;
}) {
  if (!perfilId) throw new Error("Aluno não identificado para atualização.");
  if (!turmaId) throw new Error("Selecione a turma do aluno.");
  if (!dataInicio) throw new Error("Escolha a data de início nesta turma.");

  const { data: turma, error: turmaError } = await supabase
    .from("turmas")
    .select("id, dia_semana, horario, vagas_totais, ativa, professor_id")
    .eq("id", turmaId)
    .maybeSingle();

  if (turmaError) throw new Error(turmaError.message);
  if (!turma || turma.ativa === false) {
    throw new Error("A turma selecionada não está disponível.");
  }

  if (!dataCorrespondeAoDiaDaTurma(dataInicio, turma.dia_semana)) {
    throw new Error(`A data escolhida precisa cair em ${turma.dia_semana}.`);
  }

  const { count, error: lotacaoError } = await supabase
    .from("matriculas")
    .select("*", { count: "exact", head: true })
    .eq("turma_id", turmaId)
    .in("status", statusMatriculasQueOcupamVaga)
    .neq("id", matriculaId);

  if (lotacaoError) throw new Error(lotacaoError.message);
  if ((count ?? 0) >= turma.vagas_totais) {
    throw new Error("Essa turma já está lotada. Escolha outro horário.");
  }

  const { error: perfilError } = await supabase
    .from("perfis")
    .update({ nivel })
    .eq("id", perfilId);

  if (perfilError) throw new Error(perfilError.message);

  const { error: matriculaError } = await supabase
    .from("matriculas")
    .update({ turma_id: turmaId, data_inicio: dataInicio })
    .eq("id", matriculaId);

  if (matriculaError) throw new Error(matriculaError.message);

  if (solicitacaoId) {
    const { error: solicitacaoError } = await supabase
      .from("solicitacoes_aula_experimental")
      .update({
        data_aula_experimental: dataInicio,
        professor_responsavel_id: turma.professor_id || null,
      })
      .eq("id", solicitacaoId);

    if (solicitacaoError) throw new Error(solicitacaoError.message);
  }

  return {
    diaSemana: turma.dia_semana,
    horario: turma.horario,
    professorId: turma.professor_id,
    dataInicio,
  };
}

export async function buscarSolicitacoesPendentes(perfilId: string, tipoPerfil: string) {
  const { data: professoresData } = await supabase
    .from("perfis")
    .select("id, nome")
    .eq("tipo", "professor");

  const professoresMap = new Map<string, ProfessorResumo>(
    ((professoresData as ProfessorResumo[]) || []).map((professor) => [professor.id, professor])
  );

  const selectSolicitacoesComPerfil = `
      id,
      created_at,
      nome_aluno,
      perfil_id,
      telefone_aluno,
      horarios_preferencia,
      professor_preferido_id,
      professor_responsavel_id,
      professor_origem_transferencia_id,
      turma_sugerida_id,
      ultima_recusa_repasse_por_id,
      ultima_recusa_repasse_observacao,
      ultima_recusa_repasse_em,
      data_aula_experimental,
      resultado_experimental_em,
      status,
      nivel_experiencia,
      ultimo_contato_whatsapp_em
    `;
  const selectSolicitacoesLegado = `
      id,
      created_at,
      nome_aluno,
      telefone_aluno,
      horarios_preferencia,
      professor_preferido_id,
      professor_responsavel_id,
      professor_origem_transferencia_id,
      turma_sugerida_id,
      ultima_recusa_repasse_por_id,
      ultima_recusa_repasse_observacao,
      ultima_recusa_repasse_em,
      data_aula_experimental,
      resultado_experimental_em,
      status,
      nivel_experiencia,
      ultimo_contato_whatsapp_em
    `;
  let query = supabase
    .from("solicitacoes_aula_experimental")
    .select(selectSolicitacoesComPerfil)
    .in("status", statusSolicitacoesAtivas)
    .order("created_at", { ascending: false });

  if (tipoPerfil === "professor") {
    query = query.or(
      `professor_responsavel_id.eq.${perfilId},and(professor_responsavel_id.is.null,professor_preferido_id.eq.${perfilId}),and(professor_responsavel_id.is.null,professor_preferido_id.is.null)`
    );
  }

  let { data, error } = await query;

  if (error && colunaPerfilSolicitacaoIndisponivel(error)) {
    let queryLegado = supabase
      .from("solicitacoes_aula_experimental")
      .select(selectSolicitacoesLegado)
      .in("status", statusSolicitacoesAtivas)
      .order("created_at", { ascending: false });

    if (tipoPerfil === "professor") {
      queryLegado = queryLegado.or(
        `professor_responsavel_id.eq.${perfilId},and(professor_responsavel_id.is.null,professor_preferido_id.eq.${perfilId}),and(professor_responsavel_id.is.null,professor_preferido_id.is.null)`
      );
    }

    const retry = await queryLegado;

    data =
      (retry.data as Array<Record<string, unknown>> | null)?.map((solicitacao) => ({
        ...solicitacao,
        perfil_id: null,
      })) || null;
    error = retry.error;
  }

  if (error) {
    console.error("Erro ao buscar solicitações:", mensagemErro(error) || error);
    return [];
  }

  const solicitacoesBrutas =
    (data as Array<{
      id: string;
      created_at: string;
      nome_aluno: string;
      perfil_id?: string | null;
      telefone_aluno: string;
      horarios_preferencia: string;
      professor_preferido_id?: string | null;
      professor_responsavel_id?: string | null;
      professor_origem_transferencia_id?: string | null;
      turma_sugerida_id?: number | null;
      ultima_recusa_repasse_por_id?: string | null;
      ultima_recusa_repasse_observacao?: string | null;
      ultima_recusa_repasse_em?: string | null;
      data_aula_experimental?: string | null;
      resultado_experimental_em?: string | null;
      status: SolicitacaoAula["status"];
      nivel_experiencia?: string | null;
      ultimo_contato_whatsapp_em?: string | null;
      data_nascimento?: string | null;
    }> | null) || [];

  const telefonesSolicitacoes = Array.from(
    new Set(
      solicitacoesBrutas
        .map((solicitacao) => normalizarTelefone(solicitacao.telefone_aluno))
        .filter(Boolean)
    )
  );

  const dataNascimentoPorTelefone = new Map<string, string | null>();
  const dataNascimentoPorPerfil = new Map<string, string | null>();
  const perfilIdsSolicitacoes = Array.from(
    new Set(solicitacoesBrutas.map((solicitacao) => solicitacao.perfil_id).filter(Boolean))
  ) as string[];

  if (telefonesSolicitacoes.length > 0 || perfilIdsSolicitacoes.length > 0) {
    const telefonesBusca = Array.from(
      new Set(telefonesSolicitacoes.flatMap((telefone) => gerarVariacoesTelefone(telefone)))
    );

    if (telefonesBusca.length > 0) {
      const { data: perfisPorTelefone, error: perfisPorTelefoneError } = await supabase
        .from("perfis")
        .select("id, whatsapp, data_nascimento")
        .in("whatsapp", telefonesBusca);

      if (perfisPorTelefoneError) {
        throw new Error(perfisPorTelefoneError.message);
      }

      ((perfisPorTelefone as Array<{ id: string; whatsapp: string; data_nascimento: string | null }> | null) || []).forEach(
        (perfil) => {
          dataNascimentoPorPerfil.set(perfil.id, perfil.data_nascimento || null);
          dataNascimentoPorTelefone.set(normalizarTelefone(perfil.whatsapp), perfil.data_nascimento || null);
        }
      );
    }

    if (perfilIdsSolicitacoes.length > 0) {
      const { data: perfisPorId, error: perfisPorIdError } = await supabase
        .from("perfis")
        .select("id, whatsapp, data_nascimento")
        .in("id", perfilIdsSolicitacoes);

      if (perfisPorIdError) {
        throw new Error(perfisPorIdError.message);
      }

      ((perfisPorId as Array<{ id: string; whatsapp: string; data_nascimento: string | null }> | null) || []).forEach(
        (perfil) => {
          dataNascimentoPorPerfil.set(perfil.id, perfil.data_nascimento || null);
          dataNascimentoPorTelefone.set(normalizarTelefone(perfil.whatsapp), perfil.data_nascimento || null);
        }
      );
    }
  }

  return (
    solicitacoesBrutas.map((solicitacao) =>
      enriquecerSolicitacao(
        {
          ...solicitacao,
          data_nascimento:
            (solicitacao.perfil_id && dataNascimentoPorPerfil.get(solicitacao.perfil_id)) ||
            dataNascimentoPorTelefone.get(normalizarTelefone(solicitacao.telefone_aluno)) ||
            null,
        },
        professoresMap
      )
    )
  );
}

export async function assumirSolicitacaoAula(solicitacaoId: string, professorId: string) {
  const solicitacao = await buscarResumoSolicitacao(solicitacaoId);

  if (
    solicitacao.professor_preferido_id &&
    solicitacao.professor_preferido_id !== professorId &&
    !solicitacao.professor_responsavel_id
  ) {
    throw new Error("Esta solicitação foi direcionada para outro professor.");
  }

  if (
    solicitacao.professor_responsavel_id &&
    solicitacao.professor_responsavel_id !== professorId &&
    solicitacao.status !== "aguardando_aceite_professor"
  ) {
    throw new Error("Esta solicitação já está com outro professor responsável.");
  }

  const { error } = await supabase
    .from("solicitacoes_aula_experimental")
    .update({
      professor_responsavel_id: professorId,
      professor_origem_transferencia_id: null,
      turma_sugerida_id: null,
      ultima_recusa_repasse_por_id: null,
      ultima_recusa_repasse_observacao: null,
      ultima_recusa_repasse_em: null,
      status: "pendente",
    })
    .eq("id", solicitacaoId);

  if (error) throw new Error(error.message);
  return true;
}

export async function atualizarResponsavelSolicitacao(
  solicitacaoId: string,
  professorResponsavelId: string | null,
  status: SolicitacaoAula["status"] = "pendente"
) {
  const solicitacao = await buscarResumoSolicitacao(solicitacaoId);

  if (
    solicitacaoExigeProfessorPreferido(solicitacao) &&
    professorResponsavelId &&
    professorResponsavelId !== solicitacao.professor_preferido_id
  ) {
    throw new Error("O aluno escolheu um professor específico. Apenas esse professor pode atender a aula experimental.");
  }

  const professorDestino =
    professorResponsavelId ||
    (solicitacaoExigeProfessorPreferido(solicitacao) ? solicitacao.professor_preferido_id : null);
  const statusDestino =
    solicitacaoExigeProfessorPreferido(solicitacao) && status === "aguardando_aceite_professor"
      ? "pendente"
      : status;

  const { error } = await supabase
    .from("solicitacoes_aula_experimental")
    .update({
      professor_responsavel_id: professorDestino,
      professor_origem_transferencia_id: null,
      turma_sugerida_id: null,
      ultima_recusa_repasse_por_id: null,
      ultima_recusa_repasse_observacao: null,
      ultima_recusa_repasse_em: null,
      status: statusDestino,
    })
    .eq("id", solicitacaoId);

  if (error) throw new Error(error.message);
  return true;
}

export async function aceitarRepasseSolicitacao(solicitacaoId: string, professorId: string) {
  const solicitacao = await buscarResumoSolicitacao(solicitacaoId);
  if (
    solicitacao.professor_responsavel_id !== professorId ||
    solicitacao.status !== "aguardando_aceite_professor"
  ) {
    throw new Error("Esta solicitação não está aguardando o seu aceite.");
  }

  const { error } = await supabase
    .from("solicitacoes_aula_experimental")
    .update({
      professor_responsavel_id: professorId,
      professor_origem_transferencia_id: null,
      ultima_recusa_repasse_por_id: null,
      ultima_recusa_repasse_observacao: null,
      ultima_recusa_repasse_em: null,
      status: "pendente",
    })
    .eq("id", solicitacaoId);

  if (error) throw new Error(error.message);
  return true;
}

export async function recusarRepasseSolicitacao(
  solicitacaoId: string,
  professorId: string,
  observacao: string
) {
  const solicitacao = await buscarResumoSolicitacao(solicitacaoId);
  const observacaoNormalizada = observacao.trim();

  if (
    solicitacao.professor_responsavel_id !== professorId ||
    solicitacao.status !== "aguardando_aceite_professor"
  ) {
    throw new Error("Esta solicitação não está aguardando o seu aceite.");
  }

  if (!observacaoNormalizada) {
    throw new Error("Adicione uma observação para recusar o repasse.");
  }

  const professorRetorno =
    solicitacao.professor_origem_transferencia_id || solicitacao.professor_preferido_id || null;

  const { error } = await supabase
    .from("solicitacoes_aula_experimental")
    .update({
      professor_responsavel_id: professorRetorno,
      professor_origem_transferencia_id: null,
      turma_sugerida_id: null,
      ultima_recusa_repasse_por_id: professorId,
      ultima_recusa_repasse_observacao: observacaoNormalizada,
      ultima_recusa_repasse_em: new Date().toISOString(),
      status: "pendente",
    })
    .eq("id", solicitacaoId);

  if (error) throw new Error(error.message);
  return true;
}

export async function repassarSolicitacaoParaProfessor(
  solicitacaoId: string,
  professorOrigemId: string | null,
  professorDestinoId: string,
  turmaSugeridaId: number | null = null,
  status: SolicitacaoAula["status"] = "aguardando_aceite_professor"
) {
  const solicitacao = await buscarResumoSolicitacao(solicitacaoId);

  const professorOrigem =
    professorOrigemId ||
    solicitacao.professor_responsavel_id ||
    solicitacao.professor_preferido_id ||
    null;

  if (!professorOrigem) {
    throw new Error("Assuma a solicitação antes de transferi-la para outro professor.");
  }

  if (professorOrigem === professorDestinoId) {
    throw new Error("Selecione outro professor para fazer o repasse.");
  }

  const { error } = await supabase
    .from("solicitacoes_aula_experimental")
    .update({
      professor_responsavel_id: professorDestinoId,
      professor_origem_transferencia_id: professorOrigem,
      turma_sugerida_id: turmaSugeridaId,
      ultima_recusa_repasse_por_id: null,
      ultima_recusa_repasse_observacao: null,
      ultima_recusa_repasse_em: null,
      status,
    })
    .eq("id", solicitacaoId);

  if (error) throw new Error(error.message);
  return true;
}

export async function registrarTentativaContatoSolicitacao(solicitacaoId: string) {
  const { error } = await supabase
    .from("solicitacoes_aula_experimental")
    .update({ ultimo_contato_whatsapp_em: new Date().toISOString() })
    .eq("id", solicitacaoId);

  if (error) throw new Error(error.message);
  return true;
}

export async function registrarResultadoAulaExperimental({
  solicitacaoId,
  telefoneAluno,
  resultado,
}: {
  solicitacaoId: string;
  telefoneAluno: string;
  resultado: "aprovada_para_matricula" | "faltou" | "nao_vai_continuar" | "cancelado";
}) {
  const telefoneLimpo = normalizarTelefone(telefoneAluno);
  const solicitacao = await buscarResumoSolicitacao(solicitacaoId);

  const perfil = (await buscarPerfilAlunoDaSolicitacao(solicitacao, telefoneLimpo, "id")) as
    | { id: string }
    | null;
  if (!perfil) {
    throw new Error("Perfil do aluno não encontrado para registrar o resultado da aula experimental.");
  }

  if (resultado === "faltou") {
    const { error: matriculasError } = await supabase
      .from("matriculas")
      .update({ status: "pendente" })
      .eq("perfil_id", perfil.id)
      .eq("status", "experimental");

    if (matriculasError) throw new Error(matriculasError.message);
  }

  if (resultado === "cancelado") {
    const { error: matriculasError } = await supabase
      .from("matriculas")
      .update({
        status: "inativo",
        status_pos_aceite: null,
        professor_indicacao_id: null,
      })
      .eq("perfil_id", perfil.id)
      .in("status", ["experimental", "pendente"]);

    if (matriculasError) throw new Error(matriculasError.message);
  }

  if (resultado === "nao_vai_continuar") {
    const { error: matriculasError } = await supabase
      .from("matriculas")
      .update({ status: "inativo" })
      .eq("perfil_id", perfil.id)
      .in("status", ["experimental", "pendente"]);

    if (matriculasError) throw new Error(matriculasError.message);

    const { error: perfilAtualizacaoError } = await supabase
      .from("perfis")
      .update({ permitir_nova_experimental: false })
      .eq("id", perfil.id);

    if (perfilAtualizacaoError) throw new Error(perfilAtualizacaoError.message);
  }

  if (resultado === "aprovada_para_matricula") {
    const { error: perfilAtualizacaoError } = await supabase
      .from("perfis")
      .update({ permitir_nova_experimental: false })
      .eq("id", perfil.id);

    if (perfilAtualizacaoError) throw new Error(perfilAtualizacaoError.message);
  }

  const { error } = await supabase
    .from("solicitacoes_aula_experimental")
    .update({
      status: resultado,
      resultado_experimental_em: new Date().toISOString(),
    })
    .eq("id", solicitacaoId);

  if (error) throw new Error(error.message);
  return true;
}

export async function agendarAulaExperimental({
  solicitacaoId,
  telefoneAluno,
  turmaId,
  professorResponsavelId,
  dataInicio,
}: {
  solicitacaoId: string;
  telefoneAluno: string;
  turmaId: number;
  professorResponsavelId: string | null;
  dataInicio: string;
}) {
  const telefoneLimpo = normalizarTelefone(telefoneAluno);
  const dataInicioNormalizada = dataInicio;
  const solicitacao = await buscarResumoSolicitacao(solicitacaoId);

  const perfil = (await buscarPerfilAlunoDaSolicitacao(solicitacao, telefoneLimpo, "id, nome")) as
    | { id: string; nome: string }
    | null;
  if (!perfil) {
    throw new Error("Perfil do aluno não encontrado. Essa solicitação pode ser antiga e não estar vinculada a um cadastro válido.");
  }

  const { data: turma, error: turmaError } = await supabase
    .from("turmas")
    .select("id, dia_semana, horario, vagas_totais, ativa, professor_id")
    .eq("id", turmaId)
    .maybeSingle();

  if (turmaError) throw new Error(turmaError.message);
  if (!turma || turma.ativa === false) {
    throw new Error("A turma selecionada não está mais disponível para agendamento.");
  }

  if (!dataInicioNormalizada) {
    throw new Error("Selecione a data em que o aluno começa.");
  }

  if (!dataCorrespondeAoDiaDaTurma(dataInicioNormalizada, turma.dia_semana)) {
    throw new Error(`A data escolhida precisa cair em ${turma.dia_semana}.`);
  }

  if (!dataNaoPodeSerPassado(dataInicioNormalizada)) {
    throw new Error("Escolha uma data de início igual ou posterior a hoje.");
  }

  const solicitacaoExclusiva = solicitacaoExigeProfessorPreferido(solicitacao);
  const professorResponsavelEfetivo =
    solicitacao.professor_responsavel_id || professorResponsavelId || turma.professor_id;

  if (solicitacaoExclusiva && turma.professor_id !== solicitacao.professor_preferido_id) {
    throw new Error("O aluno escolheu um professor específico. Agende apenas em turmas desse professor.");
  }

  if (
    !solicitacaoExclusiva &&
    professorResponsavelEfetivo &&
    turma.professor_id !== professorResponsavelEfetivo
  ) {
    throw new Error("A turma selecionada pertence a outro professor. Faça o repasse antes de concluir o agendamento.");
  }

  const { count, error: lotacaoError } = await supabase
    .from("matriculas")
    .select("*", { count: "exact", head: true })
    .eq("turma_id", turmaId)
    .in("status", statusMatriculasQueOcupamVaga);

  if (lotacaoError) throw new Error(lotacaoError.message);
  if ((count ?? 0) >= turma.vagas_totais) {
    throw new Error("Essa turma acabou de lotar. Escolha outra opção.");
  }

  const { data: matriculaExperimental, error: matriculaError } = await supabase
    .from("matriculas")
    .select("id")
    .eq("perfil_id", perfil.id)
    .in("status", statusMatriculasExperimentaisReagendaveis)
    .limit(1)
    .maybeSingle();

  if (matriculaError) throw new Error(matriculaError.message);

  if (matriculaExperimental) {
    const { error: atualizacaoError } = await supabase
      .from("matriculas")
      .update({ turma_id: turmaId, data_inicio: dataInicioNormalizada, status: "experimental" })
      .eq("id", matriculaExperimental.id);

    if (atualizacaoError) throw new Error(atualizacaoError.message);
  } else {
    const { error: insertError } = await supabase
      .from("matriculas")
      .insert([{ perfil_id: perfil.id, turma_id: turmaId, status: "experimental", data_inicio: dataInicioNormalizada }]);

    if (insertError) throw new Error(insertError.message);
  }

  let { error: solicitacaoError } = await supabase
    .from("solicitacoes_aula_experimental")
    .update({
      status: "agendado",
      perfil_id: perfil.id,
      professor_responsavel_id: professorResponsavelEfetivo,
      professor_origem_transferencia_id: null,
      turma_sugerida_id: null,
      ultima_recusa_repasse_por_id: null,
      ultima_recusa_repasse_observacao: null,
      ultima_recusa_repasse_em: null,
      data_aula_experimental: dataInicioNormalizada,
      resultado_experimental_em: null,
    })
    .eq("id", solicitacaoId);

  if (solicitacaoError && colunaPerfilSolicitacaoIndisponivel(solicitacaoError)) {
    const retry = await supabase
      .from("solicitacoes_aula_experimental")
      .update({
        status: "agendado",
        professor_responsavel_id: professorResponsavelEfetivo,
        professor_origem_transferencia_id: null,
        turma_sugerida_id: null,
        ultima_recusa_repasse_por_id: null,
        ultima_recusa_repasse_observacao: null,
        ultima_recusa_repasse_em: null,
        data_aula_experimental: dataInicioNormalizada,
        resultado_experimental_em: null,
      })
      .eq("id", solicitacaoId);

    solicitacaoError = retry.error;
  }

  if (solicitacaoError) throw new Error(solicitacaoError.message);

  return {
    nomeAluno: perfil.nome,
    diaSemana: turma.dia_semana,
    horario: turma.horario,
    professorId: turma.professor_id,
    dataInicio: dataInicioNormalizada,
  };
}
