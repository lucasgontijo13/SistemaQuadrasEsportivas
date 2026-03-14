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
  "em_contato",
  "agendado",
  "aprovada_para_matricula",
];

const buscarResumoSolicitacao = async (solicitacaoId: string) => {
  const { data, error } = await supabase
    .from("solicitacoes_aula_experimental")
    .select("id, professor_preferido_id, professor_responsavel_id, professor_origem_transferencia_id, turma_sugerida_id, ultima_recusa_repasse_por_id, ultima_recusa_repasse_observacao, ultima_recusa_repasse_em, data_aula_experimental, resultado_experimental_em, status")
    .eq("id", solicitacaoId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solicitação de aula experimental não encontrada.");

  return data as {
    id: string;
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
  professorLegado: string | null | undefined,
  professoresMap: Map<string, ProfessorResumo>
) => {
  const professor = professorId ? professoresMap.get(professorId) || null : null;

  return {
    professor_id: professorId || null,
    professor: professor || null,
    professor_legado: professorLegado || professor?.nome || null,
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
  ...enriquecerProfessor(turma.professor_id, turma.professor, professoresMap),
});

const enriquecerSolicitacao = (
  solicitacao: {
    id: string;
    created_at: string;
    nome_aluno: string;
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

export async function verificarPermissaoAdmin(): Promise<{ autorizado: boolean; tipo: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { autorizado: false, tipo: "" };

  const { data: perfil } = await supabase
    .from("perfis")
    .select("tipo")
    .eq("id", session.user.id)
    .single();

  return {
    autorizado: perfil?.tipo === "admin" || perfil?.tipo === "professor",
    tipo: perfil?.tipo || "aluno",
  };
}

export async function buscarDadosPainel() {
  const { data: professoresData, error: professoresError } = await supabase
    .from("perfis")
    .select("id, nome, email, whatsapp, tipo, nivel, cpf, data_nascimento, contato_emergencia, sexo, necessidade_especial, objetivo")
    .eq("tipo", "professor")
    .order("nome", { ascending: true });

  if (professoresError) throw new Error(professoresError.message);

  const professores = (professoresData as Perfil[]) || [];
  const professoresMap = new Map<string, ProfessorResumo>(
    professores.map((professor) => [professor.id, { id: professor.id, nome: professor.nome }])
  );

  const { data: turmasData, error: turmasError } = await supabase
    .from("turmas")
    .select(`
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
        perfil_id,
        perfis (
          id,
          nome,
          nivel,
          whatsapp,
          cpf,
          data_nascimento,
          contato_emergencia
        )
      )
    `)
    .order("id", { ascending: true });

  if (turmasError) throw new Error(turmasError.message);

  const { data: quadrasData, error: quadrasError } = await supabase
    .from("horarios_quadra")
    .select("*")
    .order("horario_inicio", { ascending: true });

  if (quadrasError) throw new Error(quadrasError.message);

  const { data: matriculasData, error: matriculasError } = await supabase
    .from("matriculas")
    .select(
      `
        id,
        status,
        data_inicio,
        perfil_id,
        turma_id,
        perfis (*),
        turmas (
          id,
          dia_semana,
          horario,
          nivel,
          professor_id,
          vagas_totais,
          ativa
        )
      `
    )
    .order("id", { ascending: false });

  if (matriculasError) throw new Error(matriculasError.message);

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
    professores,
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
  cadastroCompleto,
  datasInicioPorTurma,
  solicitacaoId,
}: {
  matriculaId: number;
  perfilId: string;
  turmasIds: number[];
  nivel: string;
  cadastroCompleto: boolean;
  datasInicioPorTurma: Record<number, string>;
  solicitacaoId?: string | null;
}) {
  if (!perfilId) throw new Error("Aluno não identificado para efetivação.");
  if (turmasIds.length === 0) throw new Error("Selecione pelo menos uma turma para efetivar o aluno.");

  const statusDestino: Matricula["status"] = cadastroCompleto ? "aguardando_pagamento" : "aguardando_dados";
  const turmasUnicas = [...new Set(turmasIds)];
  const datasInicioMap = new Map<number, string>(
    Object.entries(datasInicioPorTurma).map(([turmaId, dataInicio]) => [Number(turmaId), dataInicio])
  );

  const { error: perfilError } = await supabase
    .from("perfis")
    .update({ nivel })
    .eq("id", perfilId);

  if (perfilError) throw new Error(perfilError.message);

  const { data: matriculasExistentes, error: buscarMatriculasError } = await supabase
    .from("matriculas")
    .select("id, turma_id, status")
    .eq("perfil_id", perfilId);

  if (buscarMatriculasError) throw new Error(buscarMatriculasError.message);

  const matriculas = (matriculasExistentes as Array<{ id: number; turma_id: number; status: Matricula["status"] }>) || [];
  const origem = matriculas.find((matricula) => matricula.id === matriculaId) || null;

  const { data: turmasSelecionadas, error: turmasSelecionadasError } = await supabase
    .from("turmas")
    .select("id, dia_semana")
    .in("id", turmasUnicas);

  if (turmasSelecionadasError) throw new Error(turmasSelecionadasError.message);

  const turmasMap = new Map<number, { id: number; dia_semana: string }>(
    ((turmasSelecionadas as Array<{ id: number; dia_semana: string }>) || []).map((turma) => [turma.id, turma])
  );

  for (const turmaId of turmasUnicas) {
    const turma = turmasMap.get(turmaId);
    const dataInicio = datasInicioMap.get(turmaId);

    if (!turma) {
      throw new Error("Uma das turmas selecionadas não está mais disponível.");
    }

    if (!dataInicio) {
      throw new Error(`Defina a data de início da turma de ${turma.dia_semana}.`);
    }

    if (!dataCorrespondeAoDiaDaTurma(dataInicio, turma.dia_semana)) {
      throw new Error(`A data da turma de ${turma.dia_semana} precisa cair no mesmo dia da semana.`);
    }

    if (!dataNaoPodeSerPassado(dataInicio)) {
      throw new Error("Escolha datas de início iguais ou posteriores a hoje.");
    }
  }

  for (const turmaId of turmasUnicas) {
    const matriculaDaTurma = matriculas.find((matricula) => matricula.turma_id === turmaId);
    const dataInicio = datasInicioMap.get(turmaId) || null;

    if (matriculaDaTurma) {
      const { error } = await supabase
        .from("matriculas")
        .update({ status: statusDestino, data_inicio: dataInicio })
        .eq("id", matriculaDaTurma.id);

      if (error) throw new Error(error.message);
      continue;
    }

    const { error } = await supabase
      .from("matriculas")
      .insert([{ perfil_id: perfilId, turma_id: turmaId, status: statusDestino, data_inicio: dataInicio }]);

    if (error) throw new Error(error.message);
  }

  if (origem && !turmasUnicas.includes(origem.turma_id)) {
    const { error } = await supabase
      .from("matriculas")
      .update({ status: "inativo" })
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

  return true;
}

export async function atualizarPerfil(perfilId: string, dados: Partial<Perfil>) {
  const { error } = await supabase.from("perfis").update(dados).eq("id", perfilId);
  if (error) throw new Error(error.message);
  return true;
}

export async function buscarSolicitacoesPendentes(perfilId: string, tipoPerfil: string) {
  const { data: professoresData } = await supabase
    .from("perfis")
    .select("id, nome")
    .eq("tipo", "professor");

  const professoresMap = new Map<string, ProfessorResumo>(
    ((professoresData as ProfessorResumo[]) || []).map((professor) => [professor.id, professor])
  );

  let query = supabase
    .from("solicitacoes_aula_experimental")
    .select(`
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
    `)
    .in("status", statusSolicitacoesAtivas)
    .order("created_at", { ascending: false });

  if (tipoPerfil === "professor") {
    query = query.or(
      `professor_responsavel_id.eq.${perfilId},and(professor_responsavel_id.is.null,professor_preferido_id.eq.${perfilId}),and(professor_responsavel_id.is.null,professor_preferido_id.is.null)`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar solicitações:", error);
    return [];
  }

  const solicitacoesBrutas =
    (data as Array<{
      id: string;
      created_at: string;
      nome_aluno: string;
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

  if (telefonesSolicitacoes.length > 0) {
    const { data: perfisSolicitacoes, error: perfisSolicitacoesError } = await supabase
      .from("perfis")
      .select("whatsapp, data_nascimento")
      .in("whatsapp", telefonesSolicitacoes);

    if (perfisSolicitacoesError) {
      throw new Error(perfisSolicitacoesError.message);
    }

    ((perfisSolicitacoes as Array<{ whatsapp: string; data_nascimento: string | null }> | null) || []).forEach(
      (perfil) => {
        dataNascimentoPorTelefone.set(normalizarTelefone(perfil.whatsapp), perfil.data_nascimento || null);
      }
    );
  }

  return (
    solicitacoesBrutas.map((solicitacao) =>
      enriquecerSolicitacao(
        {
          ...solicitacao,
          data_nascimento:
            dataNascimentoPorTelefone.get(normalizarTelefone(solicitacao.telefone_aluno)) || null,
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
  resultado: "aprovada_para_matricula" | "faltou" | "nao_vai_continuar";
}) {
  const telefoneLimpo = normalizarTelefone(telefoneAluno);

  const { data: perfil, error: perfilError } = await supabase
    .from("perfis")
    .select("id")
    .eq("whatsapp", telefoneLimpo)
    .maybeSingle();

  if (perfilError) throw new Error(perfilError.message);
  if (!perfil) {
    throw new Error("Perfil do aluno não encontrado para registrar o resultado da aula experimental.");
  }

  if (resultado !== "aprovada_para_matricula") {
    const { error: matriculasError } = await supabase
      .from("matriculas")
      .update({ status: "inativo" })
      .eq("perfil_id", perfil.id)
      .eq("status", "experimental");

    if (matriculasError) throw new Error(matriculasError.message);
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

  const { data: perfil, error: perfilError } = await supabase
    .from("perfis")
    .select("id, nome")
    .eq("whatsapp", telefoneLimpo)
    .maybeSingle();

  if (perfilError) throw new Error(perfilError.message);
  if (!perfil) {
    throw new Error("Perfil do aluno não encontrado. Confirme o WhatsApp cadastrado antes de agendar.");
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
    .neq("status", "inativo");

  if (lotacaoError) throw new Error(lotacaoError.message);
  if ((count ?? 0) >= turma.vagas_totais) {
    throw new Error("Essa turma acabou de lotar. Escolha outra opção.");
  }

  const { data: matriculaExperimental, error: matriculaError } = await supabase
    .from("matriculas")
    .select("id")
    .eq("perfil_id", perfil.id)
    .eq("status", "experimental")
    .limit(1)
    .maybeSingle();

  if (matriculaError) throw new Error(matriculaError.message);

  if (matriculaExperimental) {
    const { error: atualizacaoError } = await supabase
      .from("matriculas")
      .update({ turma_id: turmaId, data_inicio: dataInicioNormalizada })
      .eq("id", matriculaExperimental.id);

    if (atualizacaoError) throw new Error(atualizacaoError.message);
  } else {
    const { error: insertError } = await supabase
      .from("matriculas")
      .insert([{ perfil_id: perfil.id, turma_id: turmaId, status: "experimental", data_inicio: dataInicioNormalizada }]);

    if (insertError) throw new Error(insertError.message);
  }

  const { error: solicitacaoError } = await supabase
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

  if (solicitacaoError) throw new Error(solicitacaoError.message);

  return {
    nomeAluno: perfil.nome,
    diaSemana: turma.dia_semana,
    horario: turma.horario,
    professorId: turma.professor_id,
    dataInicio: dataInicioNormalizada,
  };
}
