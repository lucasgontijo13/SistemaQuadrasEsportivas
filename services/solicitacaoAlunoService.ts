import { supabase } from "@/lib/supabase";
import { Matricula, Perfil, SolicitacaoAula } from "@/types";

const STATUS_SOLICITACOES_ATIVAS = [
  "pendente",
  "aguardando_aceite_professor",
  "agendado",
  "faltou",
  "aprovada_para_matricula",
  "matricula_em_andamento",
];

const STATUS_MATRICULAS_REGULARES_ATIVAS = [
  "ativo",
  "aguardando_dados",
  "aguardando_pagamento",
  "aguardando_aceite_professor",
];

const STATUS_MATRICULAS_QUE_ESCONDEM_SOLICITACAO: Matricula["status"][] = [
  "ativo",
  "aguardando_dados",
  "aguardando_pagamento",
];

const ORDEM_DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export type ProfessorSolicitacao = {
  id: string;
  nome: string;
};

export type HorarioSolicitacaoDisponivel = {
  chave: string;
  dia_semana: string;
  horario: string;
  professor_id: string | null;
};

export type ContextoSolicitacoesAluno = {
  logado: boolean;
  perfil: Perfil | null;
  temSolicitacaoAtiva: boolean;
  temMatriculaRegularAtiva: boolean;
  podeSolicitarMatricula: boolean;
  podeSolicitarExperimental: boolean;
  solicitacaoAtiva: SolicitacaoAula | null;
};

const mensagemErro = (error: unknown) =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : "";

const colunaTipoSolicitacaoIndisponivel = (error: unknown) => {
  const message = mensagemErro(error).toLowerCase();
  return message.includes("tipo_solicitacao") && message.includes("solicitacoes_aula_experimental");
};

export async function buscarContextoSolicitacoesAluno(): Promise<ContextoSolicitacoesAluno> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return {
      logado: false,
      perfil: null,
      temSolicitacaoAtiva: false,
      temMatriculaRegularAtiva: false,
      podeSolicitarMatricula: false,
      podeSolicitarExperimental: false,
      solicitacaoAtiva: null,
    };
  }

  const { data: perfilData, error: perfilError } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (perfilError) throw new Error(perfilError.message);

  const perfil = (perfilData as Perfil | null) || null;

  if (!perfil || perfil.tipo !== "aluno") {
    return {
      logado: true,
      perfil,
      temSolicitacaoAtiva: false,
      temMatriculaRegularAtiva: false,
      podeSolicitarMatricula: false,
      podeSolicitarExperimental: false,
      solicitacaoAtiva: null,
    };
  }

  const selectSolicitacaoComTipo = `
    id,
    created_at,
    tipo_solicitacao,
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
    nivel_experiencia
  `;
  const selectSolicitacaoLegado = `
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
    nivel_experiencia
  `;

  const [solicitacaoResponse, matriculaResponse] = await Promise.all([
    supabase
      .from("solicitacoes_aula_experimental")
      .select(selectSolicitacaoComTipo)
      .eq("perfil_id", perfil.id)
      .in("status", STATUS_SOLICITACOES_ATIVAS)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("matriculas")
      .select("id, status")
      .eq("perfil_id", perfil.id)
      .in("status", STATUS_MATRICULAS_REGULARES_ATIVAS)
      .order("created_at", { ascending: false }),
  ]);

  let solicitacaoAtivaRaw = solicitacaoResponse.data as (SolicitacaoAula | null);
  let solicitacaoError = solicitacaoResponse.error;
  const matriculasRegulares = ((matriculaResponse.data as Array<Pick<Matricula, "id" | "status">>) || []);
  const matriculaError = matriculaResponse.error;

  if (solicitacaoError && colunaTipoSolicitacaoIndisponivel(solicitacaoError)) {
    const fallback = await supabase
      .from("solicitacoes_aula_experimental")
      .select(selectSolicitacaoLegado)
      .eq("perfil_id", perfil.id)
      .in("status", STATUS_SOLICITACOES_ATIVAS)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    solicitacaoAtivaRaw = fallback.data
      ? ({ ...(fallback.data as SolicitacaoAula), tipo_solicitacao: "experimental" } as SolicitacaoAula)
      : null;
    solicitacaoError = fallback.error;
  }

  if (solicitacaoError) throw new Error(solicitacaoError.message);
  if (matriculaError) throw new Error(matriculaError.message);

  const idsProfessores = Array.from(
    new Set(
      [
        solicitacaoAtivaRaw?.professor_preferido_id,
        solicitacaoAtivaRaw?.professor_responsavel_id,
        solicitacaoAtivaRaw?.professor_origem_transferencia_id,
        solicitacaoAtivaRaw?.ultima_recusa_repasse_por_id,
      ].filter((id): id is string => !!id)
    )
  );

  let professoresMap = new Map<string, ProfessorSolicitacao>();

  if (idsProfessores.length > 0) {
    const { data: professoresRelacionados, error: professoresError } = await supabase
      .from("perfis")
      .select("id, nome")
      .in("id", idsProfessores);

    if (professoresError) throw new Error(professoresError.message);

    professoresMap = new Map(
      (((professoresRelacionados as ProfessorSolicitacao[]) || []).map((professor) => [professor.id, professor]))
    );
  }

  const solicitacaoAtiva = solicitacaoAtivaRaw
    ? ({
        ...solicitacaoAtivaRaw,
        tipo_solicitacao: solicitacaoAtivaRaw.tipo_solicitacao || "experimental",
        professor_preferido: solicitacaoAtivaRaw.professor_preferido_id
          ? professoresMap.get(solicitacaoAtivaRaw.professor_preferido_id) || null
          : null,
        professor_responsavel: solicitacaoAtivaRaw.professor_responsavel_id
          ? professoresMap.get(solicitacaoAtivaRaw.professor_responsavel_id) || null
          : null,
        professor_origem_transferencia: solicitacaoAtivaRaw.professor_origem_transferencia_id
          ? professoresMap.get(solicitacaoAtivaRaw.professor_origem_transferencia_id) || null
          : null,
        ultima_recusa_repasse_por: solicitacaoAtivaRaw.ultima_recusa_repasse_por_id
          ? professoresMap.get(solicitacaoAtivaRaw.ultima_recusa_repasse_por_id) || null
          : null,
      } as SolicitacaoAula)
    : null;

  const temMatriculaRegularAtiva = matriculasRegulares.length > 0;
  const temMatriculaRegularVisivel = matriculasRegulares.some((matricula) =>
    STATUS_MATRICULAS_QUE_ESCONDEM_SOLICITACAO.includes(matricula.status)
  );
  const solicitacaoAtivaVisivel = temMatriculaRegularVisivel ? null : solicitacaoAtiva;
  const temSolicitacaoAtiva = !!solicitacaoAtivaVisivel;
  const podeSolicitarMatricula = !temSolicitacaoAtiva && !temMatriculaRegularAtiva;
  const podeSolicitarExperimental =
    !!perfil.permitir_nova_experimental && !temSolicitacaoAtiva && !temMatriculaRegularAtiva;

  return {
    logado: true,
    perfil,
    temSolicitacaoAtiva,
    temMatriculaRegularAtiva,
    podeSolicitarMatricula,
    podeSolicitarExperimental,
    solicitacaoAtiva: solicitacaoAtivaVisivel,
  };
}

export async function buscarProfessoresEHorariosSolicitacao(): Promise<{
  professores: ProfessorSolicitacao[];
  horariosDisponiveis: HorarioSolicitacaoDisponivel[];
}> {
  const [{ data: professoresData, error: professoresError }, { data: turmasData, error: turmasError }] =
    await Promise.all([
      supabase.from("perfis").select("id, nome").eq("tipo", "professor"),
      supabase
        .from("turmas")
        .select("dia_semana, horario, professor_id")
        .eq("ativa", true),
    ]);

  if (professoresError) throw new Error(professoresError.message);
  if (turmasError) throw new Error(turmasError.message);

  const horariosUnicos = new Map<string, HorarioSolicitacaoDisponivel>();

  (
    (turmasData as Array<{ dia_semana: string; horario: string; professor_id: string | null }>) || []
  ).forEach((turma) => {
    const horarioFormatado = turma.horario.substring(0, 5);
    const chave = `${turma.professor_id ?? "qualquer"}|${turma.dia_semana}|${horarioFormatado}`;

    if (!horariosUnicos.has(chave)) {
      horariosUnicos.set(chave, {
        chave,
        dia_semana: turma.dia_semana,
        horario: horarioFormatado,
        professor_id: turma.professor_id,
      });
    }
  });

  const horariosDisponiveis = Array.from(horariosUnicos.values()).sort((a, b) => {
    const indiceDiaA = ORDEM_DIAS_SEMANA.indexOf(a.dia_semana);
    const indiceDiaB = ORDEM_DIAS_SEMANA.indexOf(b.dia_semana);

    if (indiceDiaA !== indiceDiaB) {
      return indiceDiaA - indiceDiaB;
    }

    return a.horario.localeCompare(b.horario);
  });

  return {
    professores: ((professoresData as ProfessorSolicitacao[]) || []).sort((a, b) =>
      a.nome.localeCompare(b.nome)
    ),
    horariosDisponiveis,
  };
}
