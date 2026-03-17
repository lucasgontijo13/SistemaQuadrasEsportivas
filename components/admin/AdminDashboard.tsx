"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, CheckCircle2, Loader2, CalendarDays, Plus, 
  Trash2, X, Clock, MapPin, Edit2, UserCheck, Shield, UserPlus, AlertCircle, AlertTriangle,
  MessageCircle, BellRing, Eye
} from "lucide-react";

import { DadosTurma, Turma, HorarioQuadra, Matricula, Perfil, SolicitacaoAula } from "@/types";
import { 
  verificarPermissaoAdmin, buscarDadosPainel, excluirRegistro, salvarTurma, 
  salvarQuadra, efetivarMatricula, atualizarPerfil, atualizarTurmasAluno, atualizarPermissaoNovaExperimental,
  cadastrarNovoProfessor, excluirProfessor, buscarSolicitacoesPendentes,
  assumirSolicitacaoAula,
  atualizarResponsavelSolicitacao, aceitarRepasseSolicitacao,
  recusarRepasseSolicitacao, repassarSolicitacaoParaProfessor,
  registrarTentativaContatoSolicitacao, agendarAulaExperimental,
  registrarResultadoAulaExperimental, aceitarMatriculaPendenteProfessor, recusarMatriculaPendenteProfessor
} from "@/services/adminService";
import { supabase } from "@/lib/supabase";


const maskPhone = (value: string) => {
  if (!value) return "";
  
  return value
    .replace(/\D/g, "") // Tira tudo que não é número
    .replace(/(\d{2})(\d)/, "($1) $2") // Coloca o parênteses DDD
    .replace(/(\d{5})(\d)/, "$1-$2") // Coloca o hífen depois do 5º dígito
    .replace(/(-\d{4})\d+?$/, "$1"); // Impede de digitar mais que 15 caracteres
};

const normalizarTelefone = (value?: string | null) => value?.replace(/\D/g, "") || "";
const gerarVariacoesTelefone = (telefone?: string | null) => {
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

const mapaDiaSemanaNumero: Record<string, number> = {
  Domingo: 0,
  Segunda: 1,
  "Terça": 2,
  Quarta: 3,
  Quinta: 4,
  Sexta: 5,
  Sábado: 6,
};

const formatarDataISO = (data: Date) => {
  const ano = data.getFullYear();
  const mes = `${data.getMonth() + 1}`.padStart(2, "0");
  const dia = `${data.getDate()}`.padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

const calcularIdade = (dataNascimento?: string | null) => {
  if (!dataNascimento) return null;

  const nascimento = new Date(`${dataNascimento}T12:00:00`);
  if (Number.isNaN(nascimento.getTime())) return null;

  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aindaNaoFezAniversarioNesteAno =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());

  if (aindaNaoFezAniversarioNesteAno) {
    idade -= 1;
  }

  return idade >= 0 ? idade : null;
};

export type AdminSecao = "solicitacoes" | "alunos" | "matriculas" | "turmas" | "aluguel" | "professores";

type AdminDashboardProps = {
  secaoAtiva: AdminSecao;
};

type FiltroAtencaoSolicitacoes = "sem_responsavel" | "aguardando_aceite" | null;
type FiltroCategoriaAlunos = "todos" | "matriculados" | "experimentais" | "inativos";
type FiltroStatusSolicitacoesAdmin = "todos" | "sem_responsavel" | "com_responsavel" | "aguardando_aceite";

const statusSolicitacoesExperimentaisAtivas: SolicitacaoAula["status"][] = [
  "agendado",
  "faltou",
  "aprovada_para_matricula",
];

export default function AdminDashboard({ secaoAtiva }: AdminDashboardProps) {
  const [dadosExtrasAluno, setDadosExtrasAluno] = useState<Perfil | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAula[]>([]);
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);
  const [acessoVerificado, setAcessoVerificado] = useState(false);
  const [modalConfirmacao, setModalConfirmacao] = useState({ aberto: false, titulo: "", mensagem: "", acao: () => {} });
  const [alunosPerfis, setAlunosPerfis] = useState<Perfil[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmasParaFluxos, setTurmasParaFluxos] = useState<Turma[]>([]);
  const [horariosQuadra, setHorariosQuadra] = useState<HorarioQuadra[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [modalTransferenciaAberto, setModalTransferenciaAberto] = useState(false);
  const [modalRecusaRepasseAberto, setModalRecusaRepasseAberto] = useState(false);
  const [modalRecusaMatriculaAberto, setModalRecusaMatriculaAberto] = useState(false);
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [tipoLogado, setTipoLogado] = useState<string>(""); // Para saber se é admin ou professor
  const [professores, setProfessores] = useState<Perfil[]>([]); // Lista de professores
  
  const [usuarioLogadoId, setUsuarioLogadoId] = useState<string>("");
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<SolicitacaoAula | null>(null);
  const [solicitacaoRecusaRepasse, setSolicitacaoRecusaRepasse] = useState<SolicitacaoAula | null>(null);
  const [matriculaRecusaPendente, setMatriculaRecusaPendente] = useState<Matricula | null>(null);
  const [observacaoRecusaRepasse, setObservacaoRecusaRepasse] = useState("");
  const [observacaoRecusaMatricula, setObservacaoRecusaMatricula] = useState("");
  const [professorResponsavelSelecionado, setProfessorResponsavelSelecionado] = useState<string>("");
  const [professorTransferenciaSelecionado, setProfessorTransferenciaSelecionado] = useState<string>("");
  const [turmaSugeridaTransferenciaId, setTurmaSugeridaTransferenciaId] = useState<number | null>(null);
  const [turmaExperimentalId, setTurmaExperimentalId] = useState<number | null>(null);
  const [diaAgendamentoSolicitacao, setDiaAgendamentoSolicitacao] = useState("Segunda");
  const [dataInicioExperimental, setDataInicioExperimental] = useState("");

  // Adicione o modal de sucesso junto do modal de confirmação
  const [modalSucesso, setModalSucesso] = useState({ aberto: false, titulo: "", mensagem: "" });
  
  // Atualize o tipoModal para aceitar "editar_professor"
  const [tipoModal, setTipoModal] = useState<"turma" | "quadra" | "editar_turma" | "efetivar_aluno" | "ver_aluno" | "editar_aluno" | "editar_horarios_aluno" | "professor" | "editar_professor" | "ver_solicitacao">("turma");
  
  // Novo estado para guardar o ID do professor que está a ser editado
  const [idEdicaoProfessor, setIdEdicaoProfessor] = useState<string | null>(null);

  // Adicione 'professor' no tipoModal
  
  const [novoProfessor, setNovoProfessor] = useState({ nome: "", email: "", whatsapp: "", senha: "" });

  const [erroModal, setErroModal] = useState("");
  // 2. Adicione este estado para controlar o nível no formulário
  const [nivelEdicao, setNivelEdicao] = useState("");
  const [dadosEdicaoAluno, setDadosEdicaoAluno] = useState<{
    perfilId: string;
    nomeAluno: string;
    nivel: string;
    turmasIds: number[];
    dataInicioPlano: string;
  }>({
    perfilId: "",
    nomeAluno: "",
    nivel: "Iniciante",
    turmasIds: [],
    dataInicioPlano: "",
  });
  const [filtroCategoriaAlunos, setFiltroCategoriaAlunos] = useState<FiltroCategoriaAlunos>("todos");
  const [filtroAtencaoSolicitacoes, setFiltroAtencaoSolicitacoes] = useState<FiltroAtencaoSolicitacoes>(null);
  const [buscaSolicitacoes, setBuscaSolicitacoes] = useState("");
  const [filtroProfessorSolicitacoes, setFiltroProfessorSolicitacoes] = useState("todos");
  const [filtroStatusSolicitacoesAdmin, setFiltroStatusSolicitacoesAdmin] = useState<FiltroStatusSolicitacoesAdmin>("todos");
  const [buscaAlunos, setBuscaAlunos] = useState("");
  const [filtroProfessorAlunos, setFiltroProfessorAlunos] = useState("todos");
  const [buscaMatriculados, setBuscaMatriculados] = useState("");
  const [filtroProfessorMatriculados, setFiltroProfessorMatriculados] = useState("todos");
  const [buscaTurmas, setBuscaTurmas] = useState("");
  const [filtroNivelTurmas, setFiltroNivelTurmas] = useState("todos");
  
  const [idEdicao, setIdEdicao] = useState<number | null>(null);
  const [alunoSelecionado, setAlunoSelecionado] = useState<Matricula | null>(null);
  const [novaTurma, setNovaTurma] = useState<DadosTurma>({ dia_semana: "Segunda", horario: "18:00", nivel: "Iniciante", professor_id: "", vagas_totais: 6 });
  const [novoHorarioQuadra, setNovoHorarioQuadra] = useState({ dia_semana: "Sábado", horario_inicio: "08:00", horario_fim: "09:00", preco: "R$ 80,00" });
  
  

  const [dadosEfetivacao, setDadosEfetivacao] = useState<{
    matriculaId: number;
    perfilId: string;
    nomeAluno: string;
    nivel: string;
    turmasIds: number[];
    cadastroCompleto: boolean;
    dataInicioPlano: string;
    solicitacaoId: string | null;
  }>({ 
    matriculaId: 0,
    perfilId: "",
    nomeAluno: "",
    nivel: "Iniciante",
    turmasIds: [],
    cadastroCompleto: false,
    dataInicioPlano: "",
    solicitacaoId: null,
  });
  
  const [diaFiltroModal, setDiaFiltroModal] = useState("Segunda");
  const [diaFiltroTurmas, setDiaFiltroTurmas] = useState("Segunda");
  const [professorFiltroTurmas, setProfessorFiltroTurmas] = useState("todos");
  const diasDaSemanaModal = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

  const obterMatriculasVisiveisTurma = (turma?: Turma | null) =>
    turma?.matriculas?.filter((matricula) =>
      !["inativo", "pendente", "aguardando_aceite_professor"].includes(matricula.status)
    ) || [];

  const contarOcupacaoTurma = (turma: Turma) => obterMatriculasVisiveisTurma(turma).length;

  const buscarNomeProfessorPorId = (professorId: string | null | undefined) =>
    professores.find((prof) => prof.id === professorId)?.nome || "";

  const obterNomeProfessorTurma = (turma?: Turma | null) =>
    turma?.professor?.nome || turma?.professor_legado || "Professor(a) não definido";

  const obterTurmasFluxo = () => (turmasParaFluxos.length > 0 ? turmasParaFluxos : turmas);

  const matriculaEhFluxoExperimental = (
    matricula?: Matricula | null,
    solicitacao?: SolicitacaoAula | null
  ) =>
    !!matricula &&
    (matricula.status === "experimental" ||
      (matricula.status === "pendente" &&
        !!solicitacao &&
        statusSolicitacoesExperimentaisAtivas.includes(solicitacao.status)));

  const matriculaAguardandoAceiteProfessor = (matricula?: Matricula | null) =>
    matricula?.status === "aguardando_aceite_professor";

  const obterLabelStatusMatricula = (matricula?: Matricula | null) => {
    if (!matricula) return "Sem status";
    if (matricula.status === "ativo") return "Ativa";
    if (matricula.status === "experimental") return "Experimental";
    if (matricula.status === "inativo") return "Inativa";
    if (matricula.status === "aguardando_pagamento") return "Aguardando pagto";
    if (matricula.status === "aguardando_dados") return "Aguardando dados";
    if (matricula.status === "aguardando_aceite_professor") return "Aguardando aceite";
    return "Pendente";
  };

  const obterClassesStatusMatricula = (status?: Matricula["status"] | null) => {
    if (status === "ativo") {
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
    }

    if (status === "aguardando_pagamento") {
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    }

    if (status === "aguardando_dados") {
      return "border-sky-500/20 bg-sky-500/10 text-sky-300";
    }

    if (status === "aguardando_aceite_professor") {
      return "border-violet-500/20 bg-violet-500/10 text-violet-300";
    }

    if (status === "experimental") {
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
    }

    if (status === "inativo") {
      return "border-slate-700 bg-slate-900 text-slate-400";
    }

    return "border-orange-500/20 bg-orange-500/10 text-orange-300";
  };

  const obterResumoTurma = (turmaId?: number | null) => {
    const turma = obterTurmasFluxo().find((item) => item.id === turmaId) || turmas.find((item) => item.id === turmaId);
    if (!turma) return "Nenhuma sugestão registrada";

    return `${turma.dia_semana} às ${turma.horario.substring(0, 5)} • ${obterNomeProfessorTurma(turma)}`;
  };

  const obterProximaDataDaTurma = (turma?: Turma | null) => {
    if (!turma) return "";

    const diaSemana = mapaDiaSemanaNumero[turma.dia_semana];
    if (diaSemana === undefined) return "";

    const agora = new Date();
    const referencia = new Date();
    referencia.setHours(0, 0, 0, 0);

    let diferencaDias = (diaSemana - referencia.getDay() + 7) % 7;
    if (diferencaDias === 0) {
      const [hora, minuto] = turma.horario.split(":").map(Number);
      const horarioJaPassou =
        agora.getHours() > hora || (agora.getHours() === hora && agora.getMinutes() >= minuto);

      if (horarioJaPassou) {
        diferencaDias = 7;
      }
    }

    referencia.setDate(referencia.getDate() + diferencaDias);
    return formatarDataISO(referencia);
  };

  const formatarDataCurta = (valor?: string | null) => {
    if (!valor) return "";

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(`${valor}T12:00:00`));
  };

  const dataJaChegou = (valor?: string | null) => {
    if (!valor) return false;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const referencia = new Date(`${valor}T12:00:00`);
    referencia.setHours(0, 0, 0, 0);

    return referencia <= hoje;
  };

  const dataEhHoje = (valor?: string | null) => {
    if (!valor) return false;

    const hoje = formatarDataISO(new Date());
    return formatarDataISO(new Date(`${valor}T12:00:00`)) === hoje;
  };

  const dataJaPassou = (valor?: string | null) => {
    if (!valor) return false;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const referencia = new Date(`${valor}T12:00:00`);
    referencia.setHours(0, 0, 0, 0);

    return referencia < hoje;
  };

  const dataCompativelComTurma = (data: string, turma?: Turma | null) => {
    if (!data || !turma) return false;
    const diaSemana = mapaDiaSemanaNumero[turma.dia_semana];
    if (diaSemana === undefined) return false;

    return new Date(`${data}T12:00:00`).getDay() === diaSemana;
  };

  const dataMinimaAgendamento = formatarDataISO(new Date());

  const solicitacaoTemProfessorEscolhido = (solicitacao?: SolicitacaoAula | null) =>
    !!solicitacao?.professor_preferido_id;

  const obterNomeProfessorEscolhido = (solicitacao?: SolicitacaoAula | null) =>
    solicitacao?.professor_preferido?.nome ||
    buscarNomeProfessorPorId(solicitacao?.professor_preferido_id) ||
    "";

  const obterNomeProfessorResponsavel = (solicitacao?: SolicitacaoAula | null) =>
    solicitacao?.professor_responsavel?.nome ||
    buscarNomeProfessorPorId(solicitacao?.professor_responsavel_id) ||
    "Ainda não definido";

  const formatarDataHoraCurta = (valor?: string | null) => {
    if (!valor) return "";

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(valor));
  };

  const obterLabelStatusSolicitacao = (solicitacao?: SolicitacaoAula | null) => {
    if (!solicitacao) return "Novo";
    if (solicitacao.status === "agendado") {
      return dataJaChegou(solicitacao.data_aula_experimental) ? "Aguardando resultado" : "Aula marcada";
    }
    if (solicitacao.status === "aprovada_para_matricula") return "Pronto para matricula";
    if (solicitacao.status === "faltou") return "Faltou";
    if (solicitacao.status === "cancelado") return "Cancelado";
    if (solicitacao.status === "nao_vai_continuar") return "Encerrado";
    if (solicitacao.status === "matricula_em_andamento") return "Matricula iniciada";
    if (solicitacao.status === "aguardando_aceite_professor") {
      return solicitacao.professor_responsavel_id === usuarioLogadoId
        ? "Aguardando seu aceite"
        : "Aguardando aceite";
    }
    if (!solicitacao.professor_responsavel_id) return "Novo";
    if (
      solicitacao.professor_preferido_id &&
      solicitacao.professor_responsavel_id === solicitacao.professor_preferido_id
    ) {
      return "Professor escolhido";
    }
    if (
      solicitacao.professor_preferido_id &&
      solicitacao.professor_responsavel_id !== solicitacao.professor_preferido_id
    ) {
      return "Transferido";
    }
    return "Assumido";
  };

  const obterDescricaoStatusSolicitacao = (solicitacao?: SolicitacaoAula | null) => {
    if (!solicitacao) return "";
    if (solicitacao.status === "agendado") {
      return dataJaChegou(solicitacao.data_aula_experimental)
        ? "A aula experimental ja aconteceu. Agora voce pode registrar o resultado e decidir se o aluno segue para a matricula."
        : `A aula experimental esta marcada para ${formatarDataCurta(solicitacao.data_aula_experimental)}.`;
    }
    if (solicitacao.status === "faltou") {
      return "O aluno faltou na aula experimental. Você pode reagendar uma nova tentativa ou encerrar o fluxo.";
    }
    if (solicitacao.status === "cancelado") {
      return "O fluxo foi encerrado sem consumir a aula experimental.";
    }
    if (solicitacao.status === "aprovada_para_matricula") {
      return "O aluno quer continuar. Defina agora as turmas reais e a data de inicio do plano.";
    }
    if (solicitacao.status === "nao_vai_continuar") {
      return "O fluxo experimental foi encerrado para este aluno.";
    }
    if (solicitacao.status === "aguardando_aceite_professor") {
      return solicitacao.professor_responsavel_id === usuarioLogadoId
        ? "Revise os dados do aluno antes de aceitar ou recusar o repasse."
        : `Aguardando resposta de ${obterNomeProfessorResponsavel(solicitacao)}.`;
    }
    if (!solicitacao.professor_responsavel_id) {
      return "Nenhum professor assumiu este atendimento ainda.";
    }
    if (
      solicitacao.professor_preferido_id &&
      solicitacao.professor_responsavel_id === solicitacao.professor_preferido_id
    ) {
      return `Atendimento exclusivo de ${obterNomeProfessorResponsavel(solicitacao)}.`;
    }
    if (
      solicitacao.professor_preferido_id &&
      solicitacao.professor_responsavel_id !== solicitacao.professor_preferido_id
    ) {
      return `Transferido para ${obterNomeProfessorResponsavel(solicitacao)}.`;
    }
    return "Atendimento em andamento. Se não houver encaixe, você pode transferir para outro professor.";
  };

  const obterTurmasDisponiveisNaColecao = (listaTurmas: Turma[]) => {
    return listaTurmas
      .filter((turma) => {
        return turma.ativa !== false && contarOcupacaoTurma(turma) < turma.vagas_totais;
      })
      .sort((a, b) => {
        const indiceDiaA = diasDaSemanaModal.indexOf(a.dia_semana);
        const indiceDiaB = diasDaSemanaModal.indexOf(b.dia_semana);

        if (indiceDiaA !== indiceDiaB) {
          return indiceDiaA - indiceDiaB;
        }

        return a.horario.localeCompare(b.horario);
      });
  };

  const obterTurmasDisponiveis = () => obterTurmasDisponiveisNaColecao(obterTurmasFluxo());

  const obterTurmasDisponiveisPorProfessor = (professorId?: string | null) =>
    obterTurmasDisponiveis().filter((turma) => turma.professor_id === professorId);

  const obterPrimeiroDiaDisponivelSolicitacao = (
    solicitacao?: SolicitacaoAula | null,
    professorResponsavelId?: string | null
  ) => {
    const professorExclusivoId =
      solicitacao?.professor_responsavel_id ||
      solicitacao?.professor_preferido_id ||
      professorResponsavelId ||
      null;
    const primeiraTurmaDisponivel = obterTurmasDisponiveis().find(
      (turma) => !professorExclusivoId || turma.professor_id === professorExclusivoId
    );

    return primeiraTurmaDisponivel?.dia_semana || diasDaSemanaModal[0];
  };

  const abrirDetalhesAluno = (matricula: Matricula) => {
    setAlunoSelecionado(matricula);
    setTipoModal("ver_aluno");
    setModalAberto(true);
  };

  const buscarDados = async (perfilTipo = tipoLogado, perfilId = usuarioLogadoId) => {
    try {
      const dados = await buscarDadosPainel(perfilTipo, perfilId);
      setTurmas(dados.turmas);
      setTurmasParaFluxos(dados.turmasParaFluxos || dados.turmas);
      setHorariosQuadra(dados.horariosQuadra);
      setAlunosPerfis((dados.alunos as Perfil[]) || []);
      setMatriculas(dados.matriculas as Matricula[]);
      setProfessores(dados.professores); // Salva a lista de professores
    } catch (error) { console.error("Erro ao buscar:", error); }
  };

  const carregarSolicitacoes = async (perfilId = usuarioLogadoId, tipoPerfil = tipoLogado) => {
    if (!perfilId || !tipoPerfil) return;

    const pendentes = await buscarSolicitacoesPendentes(perfilId, tipoPerfil);
    setSolicitacoes(pendentes);
  };

  const recarregarPainel = async (perfilId = usuarioLogadoId, tipoPerfil = tipoLogado) => {
    await Promise.all([buscarDados(tipoPerfil, perfilId), carregarSolicitacoes(perfilId, tipoPerfil)]);
  };

  const abrirModalEdicaoProfessor = (prof: Perfil) => {
    setNovoProfessor({ 
      nome: prof.nome, 
      email: prof.email, 
      whatsapp: prof.whatsapp || "", 
      senha: "" // A senha não é carregada (e será ocultada no formulário de edição)
    });
    setIdEdicaoProfessor(prof.id);
    setTipoModal("editar_professor");
    setModalAberto(true);
  };

  const abrirEdicaoCadastroAluno = (matricula: Matricula) => {
    setAlunoSelecionado(matricula);
    setNivelEdicao(matricula.perfis?.nivel || "Iniciante");
    setErroModal("");
    setTipoModal("editar_aluno");
    setModalAberto(true);
  };

  const abrirEdicaoHorariosAluno = (matricula: Matricula) => {
    const matriculasRegularesAtivas = matriculas
      .filter((item) => item.perfil_id === matricula.perfil_id)
      .filter((item) => {
        const solicitacaoRelacionada = obterSolicitacaoRelacionadaMatricula(item);
        return !matriculaEhFluxoExperimental(item, solicitacaoRelacionada) && item.status !== "inativo";
      })
      .sort((a, b) => a.turma_id - b.turma_id);

    const turmasIds = matriculasRegularesAtivas
      .map((item) => item.turma_id)
      .filter((turmaId) => !!turmaId);
    const primeiraTurmaSelecionada =
      matriculasRegularesAtivas[0]?.turmas ||
      turmas.find((turma) => turma.id === matriculasRegularesAtivas[0]?.turma_id) ||
      turmasEditaveisAluno[0] ||
      null;
    const dataInicioPlanoAtual =
      matriculasRegularesAtivas.find((item) => !!item.data_inicio)?.data_inicio ||
      formatarDataISO(new Date());

    setAlunoSelecionado(matricula);
    setNivelEdicao(matricula.perfis?.nivel || "Iniciante");
    setDadosEdicaoAluno({
      perfilId: matricula.perfil_id,
      nomeAluno: matricula.perfis?.nome || "Aluno",
      nivel: matricula.perfis?.nivel || "Iniciante",
      turmasIds,
      dataInicioPlano: dataInicioPlanoAtual,
    });
    setDiaFiltroModal(primeiraTurmaSelecionada?.dia_semana || turmasEditaveisAluno[0]?.dia_semana || "Segunda");
    setErroModal("");
    setTipoModal("editar_horarios_aluno");
    setModalAberto(true);
  };

  const alternarPermissaoNovaExperimental = async (matricula: Matricula) => {
    if (tipoLogado !== "admin" || !matricula.perfil_id) return;

    const permissaoAtual = matricula.perfis?.permitir_nova_experimental !== false;

    setCarregando(true);
    setErroModal("");

    try {
      await atualizarPermissaoNovaExperimental(matricula.perfil_id, !permissaoAtual);
      await recarregarPainel();
      setAlunoSelecionado((prev) =>
        prev && prev.id === matricula.id
          ? {
              ...prev,
              perfis: prev.perfis
                ? { ...prev.perfis, permitir_nova_experimental: !permissaoAtual }
                : prev.perfis,
            }
          : prev
      );
      setModalSucesso({
        aberto: true,
        titulo: !permissaoAtual ? "Nova Experimental Liberada" : "Nova Experimental Bloqueada",
        mensagem: !permissaoAtual
          ? "O aluno poderá solicitar uma nova aula experimental."
          : "O aluno não poderá solicitar outra aula experimental até nova liberação.",
      });
    } catch (error) {
      setErroModal(error instanceof Error ? error.message : "Não foi possível atualizar a permissão da aula experimental.");
    } finally {
      setCarregando(false);
    }
  };



  useEffect(() => {
    async function verificarAcesso() {
      try {
        // Pega a sessão para sabermos o ID do professor logado
        const { data: { session } } = await supabase.auth.getSession();
        const { autorizado, tipo } = await verificarPermissaoAdmin(); 
        
        if (!autorizado || !session) {
          router.push("/");
          return;
        }

        setUsuarioLogadoId(session.user.id);
        setTipoLogado(tipo);

        setAutorizado(true);
        
        // Busca as turmas, quadras e alunos matriculados
        const dados = await buscarDadosPainel(tipo, session.user.id);
        setTurmas(dados.turmas);
        setTurmasParaFluxos(dados.turmasParaFluxos || dados.turmas);
        setHorariosQuadra(dados.horariosQuadra);
        setAlunosPerfis((dados.alunos as Perfil[]) || []);
        setMatriculas(dados.matriculas as Matricula[]);
        setProfessores(dados.professores);

        // Busca as solicitações de aula experimental pendentes
        const pendentes = await buscarSolicitacoesPendentes(session.user.id, tipo);
        setSolicitacoes(pendentes);
      } catch (error) {
        console.error("Erro ao carregar painel:", error);
        setErroModal(error instanceof Error ? error.message : "Não foi possível carregar os dados do painel.");
      } finally {
        setAcessoVerificado(true);
        setCarregando(false);
      }
    }
    verificarAcesso();
  }, [router]);

  const toggleTurmaEfetivacao = (idTurma: number) => {
    setDadosEfetivacao(prev => {
      const jaSelecionado = prev.turmasIds.includes(idTurma);

      return {
        ...prev,
        turmasIds: jaSelecionado ? prev.turmasIds.filter(id => id !== idTurma) : [...prev.turmasIds, idTurma],
      };
    });
  };

  const atualizarDataInicioEfetivacao = (dataInicio: string) => {
    setDadosEfetivacao((prev) => ({
      ...prev,
      dataInicioPlano: dataInicio,
    }));
  };

  const toggleTurmaEdicaoAluno = (idTurma: number) => {
    setDadosEdicaoAluno((prev) => {
      const jaSelecionado = prev.turmasIds.includes(idTurma);

      return {
        ...prev,
        turmasIds: jaSelecionado ? prev.turmasIds.filter((id) => id !== idTurma) : [...prev.turmasIds, idTurma],
      };
    });
  };

  const atualizarDataInicioEdicaoAluno = (dataInicio: string) => {
    setDadosEdicaoAluno((prev) => ({
      ...prev,
      dataInicioPlano: dataInicio,
    }));
  };

  const salvarDados = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErroModal(""); 

    try {
      if (tipoModal === "turma" || tipoModal === "editar_turma") {
        await salvarTurma(novaTurma, idEdicao);
      } 
      else if (tipoModal === "editar_aluno" && alunoSelecionado?.perfil_id) {
        await atualizarPerfil(alunoSelecionado.perfil_id, { nivel: nivelEdicao });
        setModalSucesso({
          aberto: true,
          titulo: "Aluno Atualizado",
          mensagem: `O nível de ${alunoSelecionado.perfis?.nome || "aluno"} foi atualizado com sucesso.`,
        });
      }
      else if (tipoModal === "editar_horarios_aluno" && alunoSelecionado?.perfil_id) {
        const totalTurmasSelecionadas = dadosEdicaoAluno.turmasIds.length;
        if (totalTurmasSelecionadas > 0 && !dadosEdicaoAluno.dataInicioPlano) {
          throw new Error("Defina a data de início do plano.");
        }

        const atualizacaoAluno = await atualizarTurmasAluno({
          perfilId: alunoSelecionado.perfil_id,
          nivel: nivelEdicao,
          turmasIds: dadosEdicaoAluno.turmasIds,
          dataInicioPlano: dadosEdicaoAluno.dataInicioPlano,
        });
        setModalSucesso({
          aberto: true,
          titulo: "Horários Atualizados",
          mensagem:
            totalTurmasSelecionadas > 0
              ? `${alunoSelecionado.perfis?.nome || "O aluno"} agora está com ${atualizacaoAluno.totalTurmasAtivas} horário(s) ativo(s).`
              : `${alunoSelecionado.perfis?.nome || "O aluno"} ficou sem horários ativos no momento.`,
        });
      }
      else if (tipoModal === "quadra") {
        await salvarQuadra(novoHorarioQuadra, idEdicao);
      } 
      else if (tipoModal === "efetivar_aluno") {
        const resultadoEfetivacao = await efetivarMatricula({
          matriculaId: dadosEfetivacao.matriculaId,
          perfilId: dadosEfetivacao.perfilId,
          turmasIds: dadosEfetivacao.turmasIds,
          nivel: dadosEfetivacao.nivel,
          cadastroCompleto: dadosEfetivacao.cadastroCompleto,
          dataInicioPlano: dadosEfetivacao.dataInicioPlano,
          solicitacaoId: dadosEfetivacao.solicitacaoId,
          tipoPerfil: tipoLogado,
          professorSolicitanteId: tipoLogado === "professor" ? usuarioLogadoId : null,
        });
        setModalSucesso({
          aberto: true,
          titulo: resultadoEfetivacao.totalMatriculasPendentes > 0 ? "Plano Enviado" : "Matricula Iniciada",
          mensagem:
            resultadoEfetivacao.totalMatriculasPendentes > 0
              ? `${resultadoEfetivacao.totalMatriculasDiretas} turma(s) foram confirmadas e ${resultadoEfetivacao.totalMatriculasPendentes} ficaram aguardando aceite de outros professores.`
              : "As turmas reais do aluno foram salvas com sucesso.",
        });
      }
      else if (tipoModal === "professor") {
        await cadastrarNovoProfessor(novoProfessor);
        setModalSucesso({ aberto: true, titulo: "Professor Cadastrado", mensagem: "O novo professor já tem acesso ao sistema." });
      }
      else if (tipoModal === "editar_professor" && idEdicaoProfessor) {
        await atualizarPerfil(idEdicaoProfessor, { 
          nome: novoProfessor.nome, 
          whatsapp: novoProfessor.whatsapp.replace(/\D/g, "") 
        });
        setModalSucesso({ aberto: true, titulo: "Professor Atualizado", mensagem: "Os dados foram salvos com sucesso." });
      }else if (tipoModal === "ver_solicitacao" && solicitacaoSelecionada) {
        if (tipoLogado === "professor" && solicitacaoSelecionada.status === "aguardando_aceite_professor") {
          throw new Error("Aceite o repasse antes de entrar em contato ou agendar a aula.");
        }

        if (!responsavelAtualSolicitacao && professorResponsavelEfetivo) {
          await assumirSolicitacaoAula(solicitacaoSelecionada.id, professorResponsavelEfetivo);
        }

        if (
          tipoLogado === "admin" &&
          professorResponsavelSelecionado &&
          professorResponsavelSelecionado !== responsavelAtualSolicitacao
        ) {
          await atualizarResponsavelSolicitacao(
            solicitacaoSelecionada.id,
            professorResponsavelSelecionado,
            "pendente"
          );
          setModalSucesso({ aberto: true, titulo: "Responsável Atualizado", mensagem: "A solicitação foi atualizada com sucesso." });
        } else {
          throw new Error("Use as ações rápidas para iniciar o atendimento, transferir ou abrir o agendamento.");
        }

        await recarregarPainel();
      }
      
      fecharModalPrincipal();
      await recarregarPainel();
      
    } catch (error) {
      // 1. Captura a mensagem de erro bruta
      let mensagemErro = error instanceof Error ? error.message : "Ocorreu um erro desconhecido ao guardar as informações.";

      // 2. Traduz os erros de forma clara
      if (mensagemErro === "whatsapp_duplicado" || (mensagemErro.includes("duplicate key") && mensagemErro.includes("whatsapp"))) {
        mensagemErro = "Este número de WhatsApp já está cadastrado para outro utilizador no sistema.";
      } 
      else if (mensagemErro.includes("User already registered") || mensagemErro.includes("already exists")) {
        mensagemErro = "Este e-mail já está cadastrado no sistema.";
      }

      // 3. Joga o erro traduzido para a UI vermelha
      setErroModal(mensagemErro);
    } finally {
      setCarregando(false);
    }
  };
  
  const excluirItem = async (id: number, tabela: 'turmas' | 'horarios_quadra' | 'matriculas') => {
    const isTurma = tabela === 'turmas';
    const titulo = isTurma ? "Excluir Turma" : "Excluir Horário de Quadra";
    const mensagem = isTurma 
      ? "Tem a certeza que deseja excluir esta turma? Todos os alunos matriculados ficarão sem turma."
      : "Tem a certeza que deseja excluir este horário de locação?";

    setModalConfirmacao({
      aberto: true,
      titulo: titulo,
      mensagem: mensagem,
      acao: async () => {
        setModalConfirmacao(prev => ({ ...prev, aberto: false }));
        setCarregando(true);
        try {
          await excluirRegistro(tabela, id);
          await buscarDados(); 
          setModalSucesso({ 
            aberto: true, 
            titulo: "Excluído!", 
            mensagem: isTurma ? "A turma foi removida do sistema com sucesso." : "O horário foi removido com sucesso." 
          });
        } catch (error) {
          console.error(error); 
          // Verificação segura de tipo sem usar 'any'
          const mensagemErro = error instanceof Error ? error.message : "Erro ao excluir registo.";
          setErroModal(mensagemErro);
        } finally {
          setCarregando(false);
        }
      }
    });
  };
  const assumirSolicitacao = async (solicitacao: SolicitacaoAula) => {
    setCarregando(true);
    setErroModal("");

    try {
      const professorId =
        solicitacao.professor_responsavel_id ||
        solicitacao.professor_preferido_id ||
        (tipoLogado === "professor" ? usuarioLogadoId : professorResponsavelSelecionado);

      if (!professorId) {
        throw new Error("Selecione o professor responsável antes de iniciar o atendimento.");
      }

      await assumirSolicitacaoAula(solicitacao.id, professorId);
      await recarregarPainel();

      setSolicitacaoSelecionada((prev) =>
        prev && prev.id === solicitacao.id
          ? { ...prev, professor_responsavel_id: professorId, status: "pendente" }
          : prev
      );
      setModalSucesso({
        aberto: true,
        titulo: "Atendimento Iniciado",
        mensagem: "A solicitação entrou na fila do professor responsável e já pode ser agendada.",
      });
    } catch (error) {
      setErroModal(error instanceof Error ? error.message : "Não foi possível iniciar o atendimento.");
    } finally {
      setCarregando(false);
    }
  };

  const abrirWhatsApp = async (solicitacao: SolicitacaoAula) => {
    if (!solicitacao.professor_responsavel_id || solicitacao.status === "aguardando_aceite_professor") {
      setErroModal("Inicie o atendimento antes de entrar em contato com o aluno.");
      return;
    }

    const foneLimpo = solicitacao.telefone_aluno.replace(/\D/g, '');
    const mensagem = `Olá, ${solicitacao.nome_aluno}! Vi que você solicitou uma Aula Experimental de Futevôlei com a gente. Vamos agendar?`;
    const agora = new Date().toISOString();
    await registrarTentativaContatoSolicitacao(solicitacao.id);
    await carregarSolicitacoes();
    setSolicitacaoSelecionada((prev) =>
      prev && prev.id === solicitacao.id ? { ...prev, ultimo_contato_whatsapp_em: agora } : prev
    );
    window.open(`https://wa.me/55${foneLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  const aceitarRepasse = async (solicitacao: SolicitacaoAula) => {
    setCarregando(true);
    setErroModal("");

    try {
      await aceitarRepasseSolicitacao(solicitacao.id, usuarioLogadoId);
      await recarregarPainel();
      setSolicitacaoSelecionada((prev) =>
        prev ? { ...prev, status: "pendente", professor_origem_transferencia_id: null } : prev
      );
      setModalSucesso({
        aberto: true,
        titulo: "Repasse Aceito",
        mensagem: "A solicitação agora está na sua fila para contato e agendamento.",
      });
    } catch (error) {
      setErroModal(error instanceof Error ? error.message : "Não foi possível aceitar o repasse.");
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalRecusaRepasse = (solicitacao: SolicitacaoAula) => {
    setSolicitacaoRecusaRepasse(solicitacao);
    setObservacaoRecusaRepasse("");
    setErroModal("");
    setModalRecusaRepasseAberto(true);
  };

  const fecharModalRecusaRepasse = () => {
    setModalRecusaRepasseAberto(false);
    setSolicitacaoRecusaRepasse(null);
    setObservacaoRecusaRepasse("");
  };

  const abrirModalRecusaMatricula = (matricula: Matricula) => {
    setMatriculaRecusaPendente(matricula);
    setObservacaoRecusaMatricula("");
    setErroModal("");
    setModalRecusaMatriculaAberto(true);
  };

  const fecharModalRecusaMatricula = () => {
    setModalRecusaMatriculaAberto(false);
    setMatriculaRecusaPendente(null);
    setObservacaoRecusaMatricula("");
  };

  const encontrarMatriculaExperimentalDaSolicitacao = (solicitacao: SolicitacaoAula) => {
    const telefoneLimpo = solicitacao.telefone_aluno.replace(/\D/g, "");

    return (
      matriculas.find((matricula) => {
        const mesmoPerfil = dadosExtrasAluno?.id ? matricula.perfil_id === dadosExtrasAluno.id : false;
        const mesmoTelefone = matricula.perfis?.whatsapp?.replace(/\D/g, "") === telefoneLimpo;

        return matriculaEhFluxoExperimental(matricula, solicitacao) && (mesmoPerfil || mesmoTelefone);
      }) || null
    );
  };

  const seguirParaMatricula = async (solicitacao: SolicitacaoAula) => {
    const matriculaExperimental = encontrarMatriculaExperimentalDaSolicitacao(solicitacao);

    if (!matriculaExperimental) {
      setErroModal("Nao encontramos a matricula experimental desse aluno para iniciar as turmas reais.");
      return;
    }

    setCarregando(true);
    setErroModal("");

    try {
      if (solicitacao.status !== "aprovada_para_matricula") {
        await registrarResultadoAulaExperimental({
          solicitacaoId: solicitacao.id,
          telefoneAluno: solicitacao.telefone_aluno,
          resultado: "aprovada_para_matricula",
        });
        await recarregarPainel();
      }

      const p = matriculaExperimental.perfis;
      const isCompleto = p?.cpf && p?.data_nascimento && p?.contato_emergencia;
      const turmaInicial =
        matriculaExperimental.turmas ||
        obterTurmasFluxo().find((turma) => turma.id === matriculaExperimental.turma_id) ||
        turmas.find((turma) => turma.id === matriculaExperimental.turma_id) ||
        null;
      const dataInicial = matriculaExperimental.data_inicio || obterProximaDataDaTurma(turmaInicial);

      setDadosEfetivacao({
        matriculaId: matriculaExperimental.id,
        perfilId: matriculaExperimental.perfil_id || p?.id || "",
        nomeAluno: p?.nome || solicitacao.nome_aluno,
        nivel: p?.nivel || solicitacao.nivel_experiencia || "Iniciante",
        turmasIds: [matriculaExperimental.turma_id],
        cadastroCompleto: !!isCompleto,
        dataInicioPlano: dataInicial || "",
        solicitacaoId: solicitacao.id,
      });
      setDiaFiltroModal(turmaInicial?.dia_semana || obterTurmasFluxo()[0]?.dia_semana || "Segunda");
      setTipoModal("efetivar_aluno");
      setModalAgendamentoAberto(false);
      setModalTransferenciaAberto(false);
      setModalAberto(true);
    } catch (error) {
      setErroModal(error instanceof Error ? error.message : "Nao foi possivel iniciar a matricula do aluno.");
    } finally {
      setCarregando(false);
    }
  };

  const registrarResultadoSolicitacao = async (
    solicitacao: SolicitacaoAula,
    resultado: "faltou" | "nao_vai_continuar" | "cancelado"
  ) => {
    setCarregando(true);
    setErroModal("");

    try {
      await registrarResultadoAulaExperimental({
        solicitacaoId: solicitacao.id,
        telefoneAluno: solicitacao.telefone_aluno,
        resultado,
      });
      await recarregarPainel();
      fecharModalPrincipal();
      setModalSucesso({
        aberto: true,
        titulo:
          resultado === "faltou"
            ? "Falta Registrada"
            : resultado === "cancelado"
              ? "Fluxo Encerrado"
              : "Fluxo Encerrado",
        mensagem:
          resultado === "faltou"
            ? "A falta foi registrada. Se o aluno quiser, voce ainda pode reagendar uma nova experimental."
            : resultado === "cancelado"
              ? "O fluxo foi encerrado sem consumir a aula experimental. O aluno poderá solicitar novamente depois."
              : "O fluxo foi encerrado e o aluno nao podera solicitar outra experimental ate nova liberacao do admin.",
      });
    } catch (error) {
      setErroModal(error instanceof Error ? error.message : "Nao foi possivel registrar o resultado da aula.");
    } finally {
      setCarregando(false);
    }
  };

  const confirmarAgendamentoSolicitacao = async () => {
    if (!solicitacaoSelecionada || !turmaExperimentalId) {
      setErroModal("Selecione uma turma para continuar.");
      return;
    }

    if (!dataInicioExperimental) {
      setErroModal("Escolha a data em que o aluno vai começar.");
      return;
    }

    setCarregando(true);
    setErroModal("");

    try {
      if (tipoLogado === "professor" && solicitacaoSelecionada.status === "aguardando_aceite_professor") {
        throw new Error("Aceite o repasse antes de entrar em contato ou agendar a aula.");
      }

      if (!responsavelAtualSolicitacao) {
        throw new Error("Inicie o atendimento antes de marcar a aula experimental.");
      }

      const agendamento = await agendarAulaExperimental({
        solicitacaoId: solicitacaoSelecionada.id,
        telefoneAluno: solicitacaoSelecionada.telefone_aluno,
        turmaId: turmaExperimentalId,
        professorResponsavelId: professorResponsavelEfetivo || null,
        dataInicio: dataInicioExperimental,
      });

      await recarregarPainel();
      setModalAgendamentoAberto(false);
      fecharModalPrincipal();
      setModalSucesso({
        aberto: true,
        titulo: "Aula Marcada",
        mensagem: `${agendamento.nomeAluno} começa em ${formatarDataCurta(agendamento.dataInicio)}, ${agendamento.diaSemana}, às ${agendamento.horario.substring(0, 5)}.`,
      });
    } catch (error) {
      setErroModal(error instanceof Error ? error.message : "Não foi possível concluir o agendamento.");
    } finally {
      setCarregando(false);
    }
  };

  const recusarRepasse = async (solicitacao: SolicitacaoAula, observacao: string) => {
    setCarregando(true);
    setErroModal("");

    try {
      await recusarRepasseSolicitacao(solicitacao.id, usuarioLogadoId, observacao);
      await recarregarPainel();
      fecharModalRecusaRepasse();
      fecharModalPrincipal();
      setModalSucesso({
        aberto: true,
        titulo: "Repasse Recusado",
        mensagem: "A solicitação voltou para o professor anterior seguir com o atendimento.",
      });
    } catch (error) {
      setErroModal(error instanceof Error ? error.message : "Não foi possível recusar o repasse.");
    } finally {
      setCarregando(false);
    }
  };

  const aceitarMatriculaPendente = async (matricula: Matricula) => {
    setCarregando(true);
    setErroModal("");

    try {
      await aceitarMatriculaPendenteProfessor(matricula.id, usuarioLogadoId);
      await recarregarPainel();
      setModalSucesso({
        aberto: true,
        titulo: "Turma Confirmada",
        mensagem: "A matrícula foi aceita e já entrou no plano do aluno.",
      });
    } catch (error) {
      setErroModal(error instanceof Error ? error.message : "Não foi possível aceitar esta matrícula.");
    } finally {
      setCarregando(false);
    }
  };

  const recusarMatriculaPendente = async (matricula: Matricula) => {
    setCarregando(true);
    setErroModal("");

    try {
      await recusarMatriculaPendenteProfessor(
        matricula.id,
        usuarioLogadoId,
        observacaoRecusaMatricula
      );
      await recarregarPainel();
      fecharModalRecusaMatricula();
      setModalSucesso({
        aberto: true,
        titulo: "Turma Recusada",
        mensagem: "A turma pendente foi recusada e o histórico ficou registrado para o professor que indicou o aluno.",
      });
    } catch (error) {
      setErroModal(error instanceof Error ? error.message : "Não foi possível recusar esta matrícula.");
    } finally {
      setCarregando(false);
    }
  };

  const transferirSolicitacao = async (solicitacao: SolicitacaoAula, professorDestinoId: string) => {
    setCarregando(true);
    setErroModal("");

    try {
      const professorOrigemId =
        solicitacao.professor_responsavel_id ||
        (solicitacao.professor_preferido_id === usuarioLogadoId ? usuarioLogadoId : null) ||
        (tipoLogado === "admin" ? usuarioLogadoId : null);

      await repassarSolicitacaoParaProfessor(
        solicitacao.id,
        professorOrigemId,
        professorDestinoId,
        turmaSugeridaTransferenciaId
      );
      await recarregarPainel();
      fecharModalPrincipal();
      setProfessorTransferenciaSelecionado("");
      setTurmaSugeridaTransferenciaId(null);
      setModalSucesso({
        aberto: true,
        titulo: "Solicitação Transferida",
        mensagem: `O aluno foi encaminhado para ${buscarNomeProfessorPorId(professorDestinoId)} avaliar o atendimento.`,
      });
    } catch (error) {
      setErroModal(error instanceof Error ? error.message : "Não foi possível transferir a solicitação.");
    } finally {
      setCarregando(false);
    }
  };

  const abrirModal = (tipo: "turma" | "quadra") => {
    setIdEdicao(null);
    if (tipo === "turma") {
      setNovaTurma({
        dia_semana: "Segunda",
        horario: "18:00",
        nivel: "Iniciante",
        professor_id: professores[0]?.id || "",
        vagas_totais: 6,
      });
    }
    setTipoModal(tipo);
    setModalAberto(true);
  };

  const abrirModalEdicao = (turmaExistente: Turma) => {
    setNovaTurma({
      dia_semana: turmaExistente.dia_semana,
      horario: turmaExistente.horario,
      nivel: turmaExistente.nivel,
      professor_id: turmaExistente.professor_id || "",
      vagas_totais: turmaExistente.vagas_totais,
    });
    setIdEdicao(turmaExistente.id);
    setTipoModal("editar_turma");
    setModalAberto(true);
  };

  const abrirModalSolicitacao = async (solicitacao: SolicitacaoAula) => {
    const professorInicial =
      solicitacao.professor_responsavel_id ||
      solicitacao.professor_preferido_id ||
      (tipoLogado === "professor" ? usuarioLogadoId : "");
    const telefoneLimpo = solicitacao.telefone_aluno.replace(/\D/g, "");
    const matriculaExperimental = (
      matriculas.find((matricula) => {
        const mesmoTelefone = matricula.perfis?.whatsapp?.replace(/\D/g, "") === telefoneLimpo;
        return matriculaEhFluxoExperimental(matricula, solicitacao) && mesmoTelefone;
      }) || null
    );
    const turmaExperimental =
      matriculaExperimental?.turmas ||
      turmas.find((turma) => turma.id === matriculaExperimental?.turma_id) ||
      null;
    const dataAgendamentoExistente =
      solicitacao.status === "faltou"
        ? obterProximaDataDaTurma(turmaExperimental)
        : solicitacao.data_aula_experimental || matriculaExperimental?.data_inicio || "";

    setSolicitacaoSelecionada(solicitacao);
    setSolicitacaoRecusaRepasse(null);
    setObservacaoRecusaRepasse("");
    setModalRecusaRepasseAberto(false);
    setModalAgendamentoAberto(false);
    setProfessorResponsavelSelecionado(professorInicial);
    setProfessorTransferenciaSelecionado("");
    setTurmaSugeridaTransferenciaId(solicitacao.turma_sugerida_id || null);
    setModalTransferenciaAberto(false);
    setTurmaExperimentalId(matriculaExperimental?.turma_id || null);
    setDataInicioExperimental(dataAgendamentoExistente);
    setDiaAgendamentoSolicitacao(
      turmaExperimental?.dia_semana || obterPrimeiroDiaDisponivelSolicitacao(solicitacao, professorInicial)
    );
    setTipoModal("ver_solicitacao");
    setDadosExtrasAluno(null);
    setErroModal("");
    setModalAberto(true);

    const selectDadosExtrasAluno =
      tipoLogado === "admin"
        ? "id, nome, whatsapp, nivel, cpf, data_nascimento, contato_emergencia, sexo, necessidade_especial, objetivo, permitir_nova_experimental"
        : "id, nome, whatsapp, nivel, data_nascimento, contato_emergencia, sexo, necessidade_especial, objetivo, permitir_nova_experimental";
    const telefonesBusca = gerarVariacoesTelefone(telefoneLimpo);

    const queryDadosAluno = supabase
      .from("perfis")
      .select(selectDadosExtrasAluno)
      .limit(1);

    const { data } = solicitacao.perfil_id
      ? await queryDadosAluno.eq("id", solicitacao.perfil_id).maybeSingle()
      : await queryDadosAluno.in("whatsapp", telefonesBusca).maybeSingle();

    if (data) {
      setDadosExtrasAluno(data);
    }
  };

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  const fecharModalPrincipal = () => {
    setModalAberto(false);
    setModalTransferenciaAberto(false);
    setModalRecusaRepasseAberto(false);
    setModalRecusaMatriculaAberto(false);
    setModalAgendamentoAberto(false);
    setSolicitacaoRecusaRepasse(null);
    setMatriculaRecusaPendente(null);
    setObservacaoRecusaRepasse("");
    setObservacaoRecusaMatricula("");
    setProfessorTransferenciaSelecionado("");
    setTurmaSugeridaTransferenciaId(null);
    setTurmaExperimentalId(null);
    setDataInicioExperimental("");
    setDadosEdicaoAluno({
      perfilId: "",
      nomeAluno: "",
      nivel: "Iniciante",
      turmasIds: [],
      dataInicioPlano: "",
    });
    setDadosEfetivacao({
      matriculaId: 0,
      perfilId: "",
      nomeAluno: "",
      nivel: "Iniciante",
      turmasIds: [],
      cadastroCompleto: false,
      dataInicioPlano: "",
      solicitacaoId: null,
    });
  };

  const turmasDisponiveisEfetivacao = obterTurmasDisponiveisNaColecao(obterTurmasFluxo());
  const turmasFiltradasNoModal = turmasDisponiveisEfetivacao.filter(
    (turma) => turma.dia_semana === diaFiltroModal
  );
  const solicitacaoExigeProfessorEscolhido = solicitacaoTemProfessorEscolhido(solicitacaoSelecionada);
  const solicitacaoAguardandoAceite =
    solicitacaoSelecionada?.status === "aguardando_aceite_professor";
  const responsavelAtualSolicitacao =
    !solicitacaoAguardandoAceite ? solicitacaoSelecionada?.professor_responsavel_id || "" : "";
  const solicitacaoJaAssumida = !!responsavelAtualSolicitacao;
  const professorPreferidoPodeAssumir =
    tipoLogado === "professor" &&
    !!solicitacaoSelecionada?.professor_preferido_id &&
    solicitacaoSelecionada.professor_preferido_id === usuarioLogadoId;
  const solicitacaoAbertaParaAssumir =
    !solicitacaoJaAssumida &&
    !solicitacaoAguardandoAceite &&
    (
      !solicitacaoSelecionada?.professor_preferido_id
        ? tipoLogado === "admin" || tipoLogado === "professor"
        : professorPreferidoPodeAssumir
    );
  const professorResponsavelEfetivo =
    responsavelAtualSolicitacao ||
    (solicitacaoAbertaParaAssumir
      ? tipoLogado === "professor"
        ? usuarioLogadoId
        : professorResponsavelSelecionado || ""
      : "");
  const usuarioPodeGerenciarSolicitacao =
    tipoLogado === "admin" ||
    responsavelAtualSolicitacao === usuarioLogadoId ||
    (
      !solicitacaoJaAssumida &&
      !solicitacaoAguardandoAceite &&
      tipoLogado === "professor" &&
      (!solicitacaoSelecionada?.professor_preferido_id || professorPreferidoPodeAssumir)
    );
  const turmasDisponiveisSolicitacao = obterTurmasDisponiveisPorProfessor(professorResponsavelEfetivo);
  const professoresParaTransferencia = professores.filter(
    (professor) => professor.id !== responsavelAtualSolicitacao
  );
  const professoresComDisponibilidade = professoresParaTransferencia
    .map((professor) => ({
      professor,
      turmas: obterTurmasDisponiveisPorProfessor(professor.id),
    }))
    ;
  const turmasProfessorTransferencia = obterTurmasDisponiveisPorProfessor(professorTransferenciaSelecionado);
  const diasDisponiveisSolicitacao = diasDaSemanaModal.filter((dia) =>
    turmasDisponiveisSolicitacao.some((turma) => turma.dia_semana === dia)
  );
  const diasDisponiveisEfetivacao = diasDaSemanaModal.filter((dia) =>
    turmasDisponiveisEfetivacao.some((turma) => turma.dia_semana === dia)
  );
  const turmasDoDiaSolicitacao = turmasDisponiveisSolicitacao.filter(
    (turma) => turma.dia_semana === diaAgendamentoSolicitacao
  );
  const turmaExperimentalSelecionada =
    turmas.find((turma) => turma.id === turmaExperimentalId) ||
    turmasDisponiveisSolicitacao.find((turma) => turma.id === turmaExperimentalId) ||
    null;
  const dataInicioCompativelComTurma = dataCompativelComTurma(dataInicioExperimental, turmaExperimentalSelecionada);
  const nivelAlunoSolicitacao = dadosExtrasAluno?.nivel || solicitacaoSelecionada?.nivel_experiencia || "";
  const idadeAlunoSolicitacao = calcularIdade(
    dadosExtrasAluno?.data_nascimento || solicitacaoSelecionada?.data_nascimento || null
  );
  const matriculaExperimentalDaSolicitacao = solicitacaoSelecionada
    ? encontrarMatriculaExperimentalDaSolicitacao(solicitacaoSelecionada)
    : null;
  const solicitacaoAulaMarcada = solicitacaoSelecionada?.status === "agendado";
  const solicitacaoAguardandoResultado =
    solicitacaoAulaMarcada && dataJaChegou(solicitacaoSelecionada?.data_aula_experimental);
  const solicitacaoFaltou = solicitacaoSelecionada?.status === "faltou";
  const solicitacaoProntaParaMatricula =
    solicitacaoSelecionada?.status === "aprovada_para_matricula";
  const turmasSelecionadasEfetivacao = obterTurmasFluxo().filter((turma) =>
    dadosEfetivacao.turmasIds.includes(turma.id)
  );
  const dataInicioPlanoValida =
    !!dadosEfetivacao.dataInicioPlano &&
    new Date(`${dadosEfetivacao.dataInicioPlano}T12:00:00`) >= new Date(`${dataMinimaAgendamento}T00:00:00`);
  const turmasEfetivacaoDiretas = turmasSelecionadasEfetivacao.filter(
    (turma) =>
      tipoLogado === "admin" ||
      !usuarioLogadoId ||
      !turma.professor_id ||
      turma.professor_id === usuarioLogadoId
  );
  const turmasEfetivacaoAguardandoAceite = turmasSelecionadasEfetivacao.filter(
    (turma) =>
      tipoLogado === "professor" &&
      !!usuarioLogadoId &&
      !!turma.professor_id &&
      turma.professor_id !== usuarioLogadoId
  );
  const aguardandoAceiteDoProfessor =
    solicitacaoAguardandoAceite &&
    solicitacaoSelecionada?.professor_responsavel_id === usuarioLogadoId;
  const professorTransferenciaEhValido =
    !!professorTransferenciaSelecionado &&
    professorTransferenciaSelecionado !== responsavelAtualSolicitacao;
  const descricaoStatusSolicitacaoModal = (() => {
    if (!solicitacaoSelecionada || solicitacaoAguardandoAceite) return "";

    if (solicitacaoSelecionada.status === "agendado" && solicitacaoSelecionada.data_aula_experimental) {
      return "";
    }

    if (!responsavelAtualSolicitacao) {
      return "";
    }

    return obterDescricaoStatusSolicitacao(solicitacaoSelecionada);
  })();
  const solicitacoesDaFila = solicitacoes.filter((solicitacao) =>
    ["pendente", "aguardando_aceite_professor", "em_contato"].includes(solicitacao.status)
  );
  const solicitacoesPorTelefone = solicitacoes.reduce((mapa, solicitacao) => {
    const telefone = normalizarTelefone(solicitacao.telefone_aluno);
    if (!telefone) return mapa;

    const existente = mapa.get(telefone);
    if (!existente || new Date(solicitacao.created_at).getTime() >= new Date(existente.created_at).getTime()) {
      mapa.set(telefone, solicitacao);
    }

    return mapa;
  }, new Map<string, SolicitacaoAula>());
  const obterSolicitacaoRelacionadaMatricula = (matricula?: Matricula | null) => {
    if (!matricula?.perfis?.whatsapp) return null;
    return solicitacoesPorTelefone.get(normalizarTelefone(matricula.perfis.whatsapp)) || null;
  };
  const turmasEditaveisAluno = turmas
    .filter((turma) => turma.ativa !== false)
    .filter((turma) => tipoLogado === "admin" || turma.professor_id === usuarioLogadoId)
    .sort((a, b) => {
      const indiceDiaA = diasDaSemanaModal.indexOf(a.dia_semana);
      const indiceDiaB = diasDaSemanaModal.indexOf(b.dia_semana);

      if (indiceDiaA !== indiceDiaB) {
        return indiceDiaA - indiceDiaB;
      }

      return a.horario.localeCompare(b.horario);
    });
  const diasComTurmaEditavel = diasDaSemanaModal.filter((dia) =>
    turmasEditaveisAluno.some((turma) => turma.dia_semana === dia)
  );
  const turmasEditaveisFiltradasNoModal = turmasEditaveisAluno.filter(
    (turma) => turma.dia_semana === diaFiltroModal
  );
  const turmasSelecionadasEdicaoAluno = turmasEditaveisAluno.filter((turma) =>
    dadosEdicaoAluno.turmasIds.includes(turma.id)
  );
  const dataInicioEdicaoAlunoValida =
    !dadosEdicaoAluno.dataInicioPlano ||
    new Date(`${dadosEdicaoAluno.dataInicioPlano}T12:00:00`) >= new Date(`${dataMinimaAgendamento}T00:00:00`);
  const matriculasComContexto = matriculas.map((matricula) => {
    const solicitacaoRelacionada = obterSolicitacaoRelacionadaMatricula(matricula);
    const fluxoExperimental = matriculaEhFluxoExperimental(matricula, solicitacaoRelacionada);
    const aceiteProfessorPendente = matriculaAguardandoAceiteProfessor(matricula);
    const experimentalAguardandoResultado =
      solicitacaoRelacionada?.status === "agendado" && dataJaChegou(solicitacaoRelacionada.data_aula_experimental);
    const experimentalAulaHoje =
      solicitacaoRelacionada?.status === "agendado" && dataEhHoje(solicitacaoRelacionada.data_aula_experimental);
    const experimentalSemResultado =
      solicitacaoRelacionada?.status === "agendado" && dataJaPassou(solicitacaoRelacionada.data_aula_experimental);
    const experimentalProntoParaMatricula = solicitacaoRelacionada?.status === "aprovada_para_matricula";
    const experimentalMatriculaPendente =
      solicitacaoRelacionada?.status === "aprovada_para_matricula" ||
      solicitacaoRelacionada?.status === "matricula_em_andamento";

    return {
      matricula,
      solicitacaoRelacionada,
      fluxoExperimental,
      aceiteProfessorPendente,
      experimentalAguardandoResultado,
      experimentalAulaHoje,
      experimentalSemResultado,
      experimentalProntoParaMatricula,
      experimentalMatriculaPendente,
    };
  });
  const contextosPorPerfil = matriculasComContexto.reduce((mapa, item) => {
    const perfilId = item.matricula.perfil_id;
    const listaAtual = mapa.get(perfilId) || [];
    listaAtual.push(item);
    mapa.set(perfilId, listaAtual);
    return mapa;
  }, new Map<string, typeof matriculasComContexto>());
  const alunosResumo = alunosPerfis
    .map((perfil, indice) => {
      const contextosAluno = contextosPorPerfil.get(perfil.id) || [];
      const contextosExperimentais = contextosAluno.filter((item) => item.fluxoExperimental);
      const matriculasPendentesAceite = contextosAluno.filter((item) => item.aceiteProfessorPendente);
      const contextoExperimentalAtual =
        contextosExperimentais.find((item) => item.experimentalSemResultado) ||
        contextosExperimentais.find((item) => item.experimentalProntoParaMatricula) ||
        contextosExperimentais.find((item) => item.experimentalAguardandoResultado) ||
        contextosExperimentais[0] ||
        null;
      const matriculasAtivas = contextosAluno.filter(
        (item) =>
          !item.fluxoExperimental &&
          !item.aceiteProfessorPendente &&
          item.matricula.status !== "inativo"
      );
      const matriculasInativas = contextosAluno.filter((item) => item.matricula.status === "inativo");
      const matriculaRepresentante =
        contextoExperimentalAtual?.matricula ||
        matriculasPendentesAceite[0]?.matricula ||
        matriculasAtivas[0]?.matricula ||
        matriculasInativas[0]?.matricula || {
          id: -(indice + 1),
          perfil_id: perfil.id,
          turma_id: 0,
          status: "inativo" as const,
          data_inicio: null,
          perfis: perfil,
        };
      const resumoTurmasAtivas =
        matriculasAtivas.length > 0
          ? `${matriculasAtivas.length} turma${matriculasAtivas.length > 1 ? "s" : ""} ativa${matriculasAtivas.length > 1 ? "s" : ""}`
          : null;
      const horariosAtivos = matriculasAtivas
        .map(({ matricula }) => {
          const turma = matricula.turmas || turmas.find((item) => item.id === matricula.turma_id);
          return turma ? `${turma.dia_semana.substring(0, 3)} ${turma.horario.substring(0, 5)}` : null;
        })
        .filter((horario): horario is string => !!horario);
      const resumoTurmasInativas =
        matriculasInativas.length > 0
          ? `${matriculasInativas.length} histórico${matriculasInativas.length > 1 ? "s" : ""} encerrado${matriculasInativas.length > 1 ? "s" : ""}`
          : null;
      const resumoAceitesPendentes =
        matriculasPendentesAceite.length > 0
          ? `${matriculasPendentesAceite.length} turma${matriculasPendentesAceite.length > 1 ? "s" : ""} aguardando aceite`
          : null;
      const resumoOperacional = [resumoTurmasAtivas, resumoAceitesPendentes, resumoTurmasInativas]
        .filter(Boolean)
        .join(" • ");
      const descricao =
        contextoExperimentalAtual?.solicitacaoRelacionada
          ? contextoExperimentalAtual.solicitacaoRelacionada.status === "agendado"
            ? `Experimental em ${formatarDataCurta(contextoExperimentalAtual.solicitacaoRelacionada.data_aula_experimental)}`
            : obterDescricaoStatusSolicitacao(contextoExperimentalAtual.solicitacaoRelacionada)
          : resumoOperacional || "Sem turmas ativas no momento.";
      const professoresVinculadosMap = new Map<string, string>();

      contextosAluno.forEach(({ matricula }) => {
        const turma = matricula.turmas || turmas.find((item) => item.id === matricula.turma_id);
        if (turma?.professor_id) {
          professoresVinculadosMap.set(turma.professor_id, obterNomeProfessorTurma(turma));
        }
      });

      if (contextoExperimentalAtual?.solicitacaoRelacionada?.professor_responsavel_id) {
        const professorId = contextoExperimentalAtual.solicitacaoRelacionada.professor_responsavel_id;
        professoresVinculadosMap.set(professorId, obterNomeProfessorResponsavel(contextoExperimentalAtual.solicitacaoRelacionada));
      }

      return {
        perfil,
        matriculaRepresentante,
        contextoExperimentalAtual,
        matriculasAtivas,
        matriculasPendentesAceite,
        matriculasInativas,
        horariosAtivos,
        professoresVinculadosIds: Array.from(professoresVinculadosMap.keys()),
        professoresVinculadosNomes: Array.from(professoresVinculadosMap.values()),
        possuiMatriculasAtivas: matriculasAtivas.length > 0,
        possuiAceitesPendentes: matriculasPendentesAceite.length > 0,
        possuiFluxoExperimental: !!contextoExperimentalAtual,
        precisaAtencao:
          matriculasPendentesAceite.length > 0 ||
          !!contextoExperimentalAtual?.experimentalSemResultado ||
          !!contextoExperimentalAtual?.experimentalProntoParaMatricula,
        labelStatus: contextoExperimentalAtual?.solicitacaoRelacionada
          ? obterLabelStatusSolicitacao(contextoExperimentalAtual.solicitacaoRelacionada)
          : matriculasPendentesAceite.length > 0 && matriculasAtivas.length === 0
            ? "Aguardando aceite"
          : matriculasAtivas.length > 0
            ? resumoTurmasAtivas || "Matriculado"
          : matriculasInativas.length > 0
              ? "Inativo"
              : "Sem turma",
        descricao,
      };
    })
    .sort((a, b) => {
      if (a.precisaAtencao !== b.precisaAtencao) {
        return Number(b.precisaAtencao) - Number(a.precisaAtencao);
      }

      if (a.possuiFluxoExperimental !== b.possuiFluxoExperimental) {
        return Number(b.possuiFluxoExperimental) - Number(a.possuiFluxoExperimental);
      }

      if (a.possuiMatriculasAtivas !== b.possuiMatriculasAtivas) {
        return Number(b.possuiMatriculasAtivas) - Number(a.possuiMatriculasAtivas);
      }

      return a.perfil.nome.localeCompare(b.perfil.nome);
    });
  const totalPerfisAlunos = alunosResumo.length;
  const totalPerfisMatriculados = alunosResumo.filter(
    (aluno) => aluno.possuiMatriculasAtivas || aluno.possuiAceitesPendentes
  ).length;
  const totalPerfisExperimentais = alunosResumo.filter((aluno) => aluno.possuiFluxoExperimental).length;
  const totalPerfisInativos = alunosResumo.filter(
    (aluno) => !aluno.possuiFluxoExperimental && !aluno.possuiMatriculasAtivas && !aluno.possuiAceitesPendentes
  ).length;
  const buscaSolicitacoesNormalizada = buscaSolicitacoes.trim().toLowerCase();
  const buscaAlunosNormalizada = buscaAlunos.trim().toLowerCase();
  const buscaMatriculadosNormalizada = buscaMatriculados.trim().toLowerCase();
  const buscaTurmasNormalizada = buscaTurmas.trim().toLowerCase();
  const alunosMatriculados = alunosResumo.filter(
    (aluno) => aluno.possuiMatriculasAtivas || aluno.possuiAceitesPendentes
  );
  const alunosFiltrados = alunosResumo.filter((aluno) => {
    if (filtroCategoriaAlunos === "matriculados") {
      if (!aluno.possuiMatriculasAtivas && !aluno.possuiAceitesPendentes) return false;
    }

    if (filtroCategoriaAlunos === "experimentais") {
      if (!aluno.possuiFluxoExperimental) return false;
    }

    if (filtroCategoriaAlunos === "inativos") {
      if (aluno.possuiFluxoExperimental || aluno.possuiMatriculasAtivas || aluno.possuiAceitesPendentes) return false;
    }

    if (
      buscaAlunosNormalizada &&
      !`${aluno.perfil.nome} ${aluno.perfil.whatsapp}`.toLowerCase().includes(buscaAlunosNormalizada)
    ) {
      return false;
    }

    if (
      tipoLogado === "admin" &&
      filtroProfessorAlunos !== "todos" &&
      !aluno.professoresVinculadosIds.includes(filtroProfessorAlunos)
    ) {
      return false;
    }

    return true;
  });
  const totalSolicitacoesSemResponsavel = solicitacoesDaFila.filter(
    (solicitacao) =>
      !solicitacao.professor_responsavel_id && solicitacao.status !== "aguardando_aceite_professor"
  ).length;
  const totalSolicitacoesAguardandoAceite = solicitacoesDaFila.filter(
    (solicitacao) =>
      solicitacao.status === "aguardando_aceite_professor" &&
      (tipoLogado === "admin" || solicitacao.professor_responsavel_id === usuarioLogadoId)
  ).length;
  const solicitacoesFiltradas = solicitacoesDaFila.filter((solicitacao) => {
    if (filtroAtencaoSolicitacoes === "sem_responsavel") {
      if (!!solicitacao.professor_responsavel_id || solicitacao.status === "aguardando_aceite_professor") return false;
    }

    if (filtroAtencaoSolicitacoes === "aguardando_aceite") {
      if (
        !(
          solicitacao.status === "aguardando_aceite_professor" &&
          (tipoLogado === "admin" || solicitacao.professor_responsavel_id === usuarioLogadoId)
        )
      ) {
        return false;
      }
    }

    if (buscaSolicitacoesNormalizada) {
      const professorResponsavel = obterNomeProfessorResponsavel(solicitacao);
      const textoBusca = `${solicitacao.nome_aluno} ${solicitacao.telefone_aluno} ${professorResponsavel}`.toLowerCase();
      if (!textoBusca.includes(buscaSolicitacoesNormalizada)) return false;
    }

    if (tipoLogado === "admin" && filtroProfessorSolicitacoes !== "todos") {
      const professorDaSolicitacao =
        solicitacao.professor_responsavel_id || solicitacao.professor_preferido_id || "sem_responsavel";
      if (professorDaSolicitacao !== filtroProfessorSolicitacoes) return false;
    }

    if (tipoLogado === "admin" && filtroStatusSolicitacoesAdmin !== "todos") {
      if (filtroStatusSolicitacoesAdmin === "sem_responsavel") {
        if (!!solicitacao.professor_responsavel_id || solicitacao.status === "aguardando_aceite_professor") return false;
      }

      if (filtroStatusSolicitacoesAdmin === "com_responsavel") {
        if (!solicitacao.professor_responsavel_id || solicitacao.status === "aguardando_aceite_professor") return false;
      }

      if (filtroStatusSolicitacoesAdmin === "aguardando_aceite") {
        if (solicitacao.status !== "aguardando_aceite_professor") return false;
      }
    }

    return true;
  });
  const matriculasRelacionadasAlunoSelecionado = alunoSelecionado
    ? matriculas
        .filter((matricula) => matricula.perfil_id === alunoSelecionado.perfil_id)
        .sort((a, b) => {
          const turmaA = a.turmas || turmas.find((turma) => turma.id === a.turma_id);
          const turmaB = b.turmas || turmas.find((turma) => turma.id === b.turma_id);
          const indiceDiaA = turmaA ? diasDaSemanaModal.indexOf(turmaA.dia_semana) : 99;
          const indiceDiaB = turmaB ? diasDaSemanaModal.indexOf(turmaB.dia_semana) : 99;

          if (indiceDiaA !== indiceDiaB) {
            return indiceDiaA - indiceDiaB;
          }

          return (turmaA?.horario || "").localeCompare(turmaB?.horario || "");
        })
    : [];
  const alunoSelecionadoTemTurmaRegularConfirmada = matriculasRelacionadasAlunoSelecionado.some((matricula) => {
    const solicitacaoRelacionada = obterSolicitacaoRelacionadaMatricula(matricula);
    return !matriculaEhFluxoExperimental(matricula, solicitacaoRelacionada) &&
      !matriculaAguardandoAceiteProfessor(matricula) &&
      matricula.status !== "inativo";
  });
  const alunosMatriculadosFiltrados = alunosMatriculados.filter((aluno) => {
    const horariosPendentesBusca = aluno.matriculasPendentesAceite
      .map(({ matricula }) => {
        const turma = matricula.turmas || turmas.find((item) => item.id === matricula.turma_id);
        return turma ? `${turma.dia_semana} ${turma.horario}` : "";
      })
      .join(" ");

    if (
      buscaMatriculadosNormalizada &&
      !`${aluno.perfil.nome} ${aluno.perfil.whatsapp} ${aluno.horariosAtivos.join(" ")} ${horariosPendentesBusca}`.toLowerCase().includes(buscaMatriculadosNormalizada)
    ) {
      return false;
    }

    if (
      tipoLogado === "admin" &&
      filtroProfessorMatriculados !== "todos" &&
      ![...aluno.matriculasAtivas, ...aluno.matriculasPendentesAceite].some(({ matricula }) => {
        const turma = matricula.turmas || turmas.find((item) => item.id === matricula.turma_id);
        return turma?.professor_id === filtroProfessorMatriculados;
      })
    ) {
      return false;
    }

    return true;
  });
  const matriculadosComFiltroAtivo =
    !!buscaMatriculadosNormalizada ||
    (tipoLogado === "admin" && filtroProfessorMatriculados !== "todos");
  const turmasFiltradasPorProfessor =
    tipoLogado === "admin" && professorFiltroTurmas !== "todos"
      ? turmas.filter((turma) => turma.professor_id === professorFiltroTurmas)
      : turmas;
  const turmasFiltradasPainel = turmasFiltradasPorProfessor.filter((turma) => {
    if (filtroNivelTurmas !== "todos" && turma.nivel !== filtroNivelTurmas) {
      return false;
    }

    if (buscaTurmasNormalizada) {
      const textoBusca = `${turma.dia_semana} ${turma.horario} ${turma.nivel} ${obterNomeProfessorTurma(turma)}`.toLowerCase();
      if (!textoBusca.includes(buscaTurmasNormalizada)) return false;
    }

    return true;
  });
  const diasComTurmaNoPainel = diasDaSemanaModal.filter((dia) =>
    turmasFiltradasPainel.some((turma) => turma.dia_semana === dia)
  );
  const turmasVisiveisNoPainel = turmasFiltradasPainel.filter(
    (turma) => turma.dia_semana === diaFiltroTurmas
  );
  const navegacaoAdmin = [
    {
      id: "solicitacoes" as AdminSecao,
      href: "/admin/solicitacoes",
      label: "Solicitacoes",
      icon: BellRing,
      mostrar: true,
      badge: solicitacoesDaFila.length > 0 ? solicitacoesDaFila.length : null,
    },
    {
      id: "alunos" as AdminSecao,
      href: "/admin/alunos",
      label: "Alunos",
      icon: Users,
      mostrar: true,
      badge: null,
    },
    {
      id: "matriculas" as AdminSecao,
      href: "/admin/matriculas",
      label: "Matriculados",
      icon: UserCheck,
      mostrar: true,
      badge: null,
    },
    {
      id: "turmas" as AdminSecao,
      href: "/admin/turmas",
      label: "Turmas",
      icon: CalendarDays,
      mostrar: true,
      badge: null,
    },
    {
      id: "aluguel" as AdminSecao,
      href: "/admin/quadras",
      label: "Quadras",
      icon: MapPin,
      mostrar: true,
      badge: null,
    },
    {
      id: "professores" as AdminSecao,
      href: "/admin/professores",
      label: "Professores",
      icon: Shield,
      mostrar: tipoLogado === "admin",
      badge: null,
    },
  ].filter((item) => item.mostrar);
  const classesGridDesktopNavegacao =
    navegacaoAdmin.length >= 6 ? "lg:grid-cols-6" : navegacaoAdmin.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4";
  const classesGridMobileNavegacao =
    navegacaoAdmin.length >= 6 ? "grid-cols-6" : navegacaoAdmin.length === 5 ? "grid-cols-5" : "grid-cols-4";

  useEffect(() => {
    if (diasComTurmaNoPainel.length === 0) {
      if (diaFiltroTurmas !== "") {
        setDiaFiltroTurmas("");
      }
      return;
    }

    if (!diasComTurmaNoPainel.includes(diaFiltroTurmas)) {
      setDiaFiltroTurmas(diasComTurmaNoPainel[0]);
    }
  }, [diaFiltroTurmas, diasComTurmaNoPainel]);

  if (!acessoVerificado) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6 text-center">
        <div className="max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-base font-bold text-white">Acesso não liberado</p>
          <p className="mt-2 text-sm text-slate-400">
            Não conseguimos validar o seu perfil para abrir este painel.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-orange-500 selection:text-white pt-[calc(7rem+env(safe-area-inset-top))] sm:pt-0 pb-24 relative">
      
      <AnimatePresence>
        {modalAberto && (
          <div key="modal-principal" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={fecharModalPrincipal} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className={`bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl w-full relative z-10 max-h-[85vh] overflow-hidden flex flex-col ${
                tipoModal === "efetivar_aluno" || tipoModal === "editar_horarios_aluno"
                  ? "max-w-lg sm:max-w-xl"
                  : tipoModal === "ver_solicitacao"
                    ? "max-w-lg sm:max-w-xl"
                    : "max-w-md"
              }`}
            >
              <div className="relative px-6 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
                <button onClick={fecharModalPrincipal} className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors bg-slate-800/50 p-2 rounded-full sm:top-7 sm:right-7"><X className="w-5 h-5" /></button>
                
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight pr-12">
                  {tipoModal === "turma"
                    ? "Nova Turma"
                    : tipoModal === "editar_turma"
                      ? "Editar Turma"
                      : tipoModal === "ver_aluno"
                        ? "Dados do Aluno"
                        : tipoModal === "editar_aluno"
                          ? "Editar Aluno"
                          : tipoModal === "editar_horarios_aluno"
                            ? "Editar Horários"
                      : tipoModal === "quadra"
                        ? "Novo Horário"
                        : tipoModal === "professor"
                          ? "Novo Professor"
                          : tipoModal === "editar_professor"
                            ? "Editar Professor"
                        : tipoModal === "ver_solicitacao"
                          ? "Aula Experimental"
                          : dadosEfetivacao.solicitacaoId
                            ? "Montar Treino"
                            : "Efetivar Aluno"}
                </h2>
              </div>

              <form onSubmit={salvarDados} className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 sm:px-8 sm:py-6 space-y-4">
                {erroModal && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm font-medium mb-4">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{erroModal}</p>
                  </div>
                )}
                {/* --- NOVA SECÇÃO: FICHA DO ALUNO --- */}
                {tipoModal === "ver_aluno" && alunoSelecionado && (
                  <div className="space-y-4 pb-2">
                    <div className="flex items-center gap-4 mb-4 border-b border-slate-800 pb-4">
                      <div className="w-14 h-14 bg-orange-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-2xl flex-shrink-0">
                        {alunoSelecionado.perfis?.nome?.charAt(0) || "?"}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg leading-tight">{alunoSelecionado.perfis?.nome || "Aluno"}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md uppercase tracking-wider font-bold">
                            Nível {alunoSelecionado.perfis?.nivel || "N/A"}
                          </span>
                        </div>
                        {secaoAtiva === "alunos" && alunoSelecionado.perfil_id && (
                          <button
                            type="button"
                            onClick={() => abrirEdicaoCadastroAluno(alunoSelecionado)}
                            className="mt-2 text-[11px] font-bold text-orange-500 hover:text-orange-400 transition-colors"
                          >
                            Mudar nível
                          </button>
                        )}
                      </div>
                    </div>

                    {alunoSelecionado.perfil_id && secaoAtiva === "matriculas" && alunoSelecionadoTemTurmaRegularConfirmada && (
                      <div>
                        <button
                          type="button"
                          onClick={() => abrirEdicaoHorariosAluno(alunoSelecionado)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-700"
                        >
                          <Edit2 className="h-4 w-4" />
                          Editar horários
                        </button>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">WhatsApp</p>
                        <p className="text-sm text-slate-300 font-medium">{alunoSelecionado.perfis?.whatsapp || "Não preenchido"}</p>
                      </div>
                      <div className={`grid gap-3 ${tipoLogado === "admin" ? "grid-cols-2" : "grid-cols-1"}`}>
                        {tipoLogado === "admin" && (
                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">CPF</p>
                            <p className="text-sm text-slate-300">{alunoSelecionado.perfis?.cpf || "Pendente"}</p>
                          </div>
                        )}
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Idade</p>
                          <p className="text-sm text-slate-300">
                            {calcularIdade(alunoSelecionado.perfis?.data_nascimento) !== null
                              ? `${calcularIdade(alunoSelecionado.perfis?.data_nascimento)} anos`
                              : "Pendente"}
                          </p>
                        </div>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Contacto de Emergência</p>
                        <p className="text-sm text-slate-300">{alunoSelecionado.perfis?.contato_emergencia || "Pendente"}</p>
                      </div>
                      {matriculasRelacionadasAlunoSelecionado.length > 0 && (
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Turmas do Aluno</p>
                          <div className="space-y-2">
                            {matriculasRelacionadasAlunoSelecionado.map((matricula) => {
                              const turma = matricula.turmas || turmas.find((item) => item.id === matricula.turma_id);
                              const labelStatus = obterLabelStatusMatricula(matricula);
                              const podeResponderMatriculaPendente =
                                tipoLogado === "professor" &&
                                matricula.status === "aguardando_aceite_professor" &&
                                turma?.professor_id === usuarioLogadoId;
                              const professorDaTurma = turma ? obterNomeProfessorTurma(turma) : "";
                              const professorIndicacao = buscarNomeProfessorPorId(matricula.professor_indicacao_id);

                              return (
                                <div
                                  key={`modal-aluno-matricula-${matricula.id}`}
                                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-3"
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-slate-200">
                                        {turma ? `${turma.dia_semana} às ${turma.horario.substring(0, 5)}` : "Sem turma vinculada"}
                                      </p>
                                      {professorDaTurma && (
                                        <p className="mt-1 text-xs text-slate-500">
                                          Professor: {professorDaTurma}
                                        </p>
                                      )}
                                      {matricula.data_inicio && (
                                        <p className="text-xs text-slate-500 mt-1">
                                          Início em {formatarDataCurta(matricula.data_inicio)}
                                        </p>
                                      )}
                                      {matricula.status === "aguardando_aceite_professor" && professorIndicacao && (
                                        <p className="text-xs text-amber-300 mt-1">
                                          Indicado por {professorIndicacao}
                                        </p>
                                      )}
                                      {matricula.ultima_recusa_professor_id && (
                                        <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-2">
                                          <p className="text-xs text-red-300">
                                            Recusada por {buscarNomeProfessorPorId(matricula.ultima_recusa_professor_id)}
                                            {matricula.ultima_recusa_em
                                              ? ` em ${formatarDataHoraCurta(matricula.ultima_recusa_em)}`
                                              : ""}
                                          </p>
                                          {matricula.ultima_recusa_observacao && (
                                            <p className="mt-1 text-xs text-slate-300 whitespace-pre-wrap">
                                              {matricula.ultima_recusa_observacao}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <span className="w-fit whitespace-nowrap rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase text-slate-300">
                                      {labelStatus}
                                    </span>
                                  </div>

                                  {podeResponderMatriculaPendente && (
                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                      <button
                                        type="button"
                                        onClick={() => aceitarMatriculaPendente(matricula)}
                                        className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-600"
                                      >
                                        Aceitar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => abrirModalRecusaMatricula(matricula)}
                                        className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:border-red-500/40 hover:text-red-300"
                                      >
                                        Recusar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Sexo</p>
                          <p className="text-sm text-slate-300">{alunoSelecionado.perfis?.sexo || "Não informado"}</p>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Objetivo</p>
                          <p className="text-sm text-slate-300 italic truncate" title={alunoSelecionado.perfis?.objetivo}>
                            {alunoSelecionado.perfis?.objetivo || "Não preenchido"}
                          </p>
                        </div>
                      </div>

                      {alunoSelecionado.perfis?.necessidade_especial && (
                        <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 mt-3">
                          <p className="text-[10px] text-red-400 uppercase font-bold tracking-wider mb-1">Atenção: Restrição / Necessidade</p>
                          <p className="text-sm text-slate-300">{alunoSelecionado.perfis?.necessidade_especial}</p>
                        </div>
                      )}

                      {tipoLogado === "admin" && (
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mt-3 space-y-3">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                              Nova Aula Experimental
                            </p>
                            <p className="text-sm text-slate-300">
                              {alunoSelecionado.perfis?.permitir_nova_experimental === false
                                ? "Bloqueada. Só volta a ficar disponível se o admin liberar."
                                : "Liberada para uma nova solicitação, se necessário."}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => alternarPermissaoNovaExperimental(alunoSelecionado)}
                            disabled={carregando}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {alunoSelecionado.perfis?.permitir_nova_experimental === false
                              ? "Liberar nova experimental"
                              : "Bloquear nova experimental"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {tipoModal === "ver_solicitacao" && solicitacaoSelecionada && (
                  <div className="space-y-5 pb-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-white text-lg mb-1">{solicitacaoSelecionada.nome_aluno}</h3>
                          <p className="text-slate-400 text-sm">{maskPhone(solicitacaoSelecionada.telefone_aluno)}</p>
                        </div>
                        <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] uppercase font-bold px-2 py-1 rounded whitespace-nowrap flex-shrink-0">
                          {dadosExtrasAluno?.nivel || solicitacaoSelecionada.nivel_experiencia || "NÍVEL NÃO INFO."}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Idade</p>
                          <p className="text-sm text-slate-300">
                            {idadeAlunoSolicitacao !== null ? `${idadeAlunoSolicitacao} anos` : "Não informada"}
                          </p>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Sexo</p>
                          <p className="text-sm text-slate-300">{dadosExtrasAluno?.sexo || "Não informado"}</p>
                        </div>
                      </div>

                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 mb-3">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Preferência de Horário</p>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{solicitacaoSelecionada.horarios_preferencia}</p>
                      </div>

                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 mb-3">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Objetivo / Motivação</p>
                        <p className="text-sm text-slate-300 italic">{dadosExtrasAluno?.objetivo || "Não preenchido"}</p>
                      </div>

                      {dadosExtrasAluno?.necessidade_especial && (
                        <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20 mb-3">
                          <p className="text-[10px] text-red-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Atenção: Restrição / Necessidade
                          </p>
                          <p className="text-sm text-slate-300">{dadosExtrasAluno?.necessidade_especial}</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {solicitacaoSelecionada.data_aula_experimental && (
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Aula Experimental</p>
                          <p className="text-sm text-slate-200">{formatarDataCurta(solicitacaoSelecionada.data_aula_experimental)}</p>
                        </div>
                      )}
                      {!solicitacaoAguardandoAceite && (
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Responsável Atual</p>
                          <p className="text-sm text-slate-200">
                            {responsavelAtualSolicitacao ? obterNomeProfessorResponsavel(solicitacaoSelecionada) : "Ainda sem responsável"}
                          </p>
                        </div>
                      )}
                      {solicitacaoSelecionada.resultado_experimental_em && (
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Resultado Registrado</p>
                          <p className="text-sm text-slate-200">
                            {formatarDataHoraCurta(solicitacaoSelecionada.resultado_experimental_em)}
                          </p>
                        </div>
                      )}
                      {solicitacaoSelecionada.professor_origem_transferencia_id && (
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Enviado Por</p>
                          <p className="text-sm text-slate-200">
                            {solicitacaoSelecionada.professor_origem_transferencia?.nome ||
                              buscarNomeProfessorPorId(solicitacaoSelecionada.professor_origem_transferencia_id)}
                          </p>
                        </div>
                      )}
                      {solicitacaoSelecionada.ultima_recusa_repasse_por_id && (
                        <div className="bg-slate-950 p-3 rounded-xl border border-red-500/20 sm:col-span-2">
                          <p className="text-[10px] text-red-300 uppercase font-bold tracking-wider mb-1">Último Repasse Recusado</p>
                          <p className="text-sm text-slate-200">
                            Recusado por{" "}
                            {solicitacaoSelecionada.ultima_recusa_repasse_por?.nome ||
                              buscarNomeProfessorPorId(solicitacaoSelecionada.ultima_recusa_repasse_por_id)}
                            {solicitacaoSelecionada.ultima_recusa_repasse_em
                              ? ` em ${formatarDataHoraCurta(solicitacaoSelecionada.ultima_recusa_repasse_em)}`
                              : ""}
                          </p>
                          {solicitacaoSelecionada.ultima_recusa_repasse_observacao && (
                            <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">
                              {solicitacaoSelecionada.ultima_recusa_repasse_observacao}
                            </p>
                          )}
                        </div>
                      )}
                      {solicitacaoSelecionada.turma_sugerida_id && (
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 sm:col-span-2">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Sugestão de Turma</p>
                          <p className="text-sm text-slate-200">{obterResumoTurma(solicitacaoSelecionada.turma_sugerida_id)}</p>
                        </div>
                      )}
                    </div>

                    {!!descricaoStatusSolicitacaoModal && (
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                        {descricaoStatusSolicitacaoModal}
                      </div>
                    )}

                    {solicitacaoAbertaParaAssumir && (
                      <div className="space-y-3">
                        {tipoLogado === "admin" ? (
                          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">
                              Direcionar Atendimento
                            </label>
                            <select
                              value={professorResponsavelSelecionado}
                              onChange={(e) => {
                                const novoProfessorId = e.target.value;
                                setProfessorResponsavelSelecionado(novoProfessorId);
                                setTurmaExperimentalId(null);
                                setDataInicioExperimental("");
                                setDiaAgendamentoSolicitacao(
                                  obterPrimeiroDiaDisponivelSolicitacao(solicitacaoSelecionada, novoProfessorId)
                                );
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm"
                            >
                              <option value="">Selecione um professor</option>
                              {professores.map((prof) => (
                                <option key={prof.id} value={prof.id}>{prof.nome}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!professorResponsavelSelecionado || carregando}
                              onClick={() => assumirSolicitacao(solicitacaoSelecionada)}
                              className="w-full mt-3 flex items-center justify-center gap-2 bg-white text-slate-950 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                              <UserCheck className="w-5 h-5" />
                              Direcionar Atendimento
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => assumirSolicitacao(solicitacaoSelecionada)}
                            disabled={carregando}
                            className="w-full flex items-center justify-center gap-2 bg-white text-slate-950 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition-colors shadow-lg disabled:opacity-50"
                          >
                            <UserCheck className="w-5 h-5" />
                            Iniciar Atendimento
                          </button>
                        )}
                      </div>
                    )}

                    {solicitacaoSelecionada.status === "aguardando_aceite_professor" && (
                      <div className={`rounded-xl border p-3 text-sm ${
                        aguardandoAceiteDoProfessor
                          ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
                          : "border-slate-800 bg-slate-950 text-slate-400"
                      }`}>
                        {aguardandoAceiteDoProfessor
                          ? `Solicitação transferida por ${solicitacaoSelecionada.professor_origem_transferencia?.nome || "outro professor"}.`
                          : `Aguardando o aceite de ${obterNomeProfessorResponsavel(solicitacaoSelecionada)} para continuar o agendamento.`}
                      </div>
                    )}

                    {aguardandoAceiteDoProfessor && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => aceitarRepasse(solicitacaoSelecionada)}
                          className="w-full flex items-center justify-center gap-2 bg-white text-slate-950 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition-colors shadow-lg"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          Aceitar Repasse
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirModalRecusaRepasse(solicitacaoSelecionada)}
                          className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-3.5 rounded-xl hover:bg-slate-700 transition-colors shadow-lg"
                        >
                          <X className="w-5 h-5" />
                          Recusar
                        </button>
                      </div>
                    )}

                    {!solicitacaoAguardandoAceite && solicitacaoJaAssumida && (
                      <button
                        type="button"
                        onClick={() => abrirWhatsApp(solicitacaoSelecionada)}
                        disabled={carregando}
                        className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold py-3.5 rounded-xl hover:bg-[#1ebd5a] transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <MessageCircle className="w-5 h-5" />
                        WhatsApp
                      </button>
                    )}

                    {usuarioPodeGerenciarSolicitacao && solicitacaoJaAssumida && !solicitacaoAguardandoAceite && (
                      <button
                        type="button"
                        onClick={() => setModalTransferenciaAberto(true)}
                        className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-3.5 rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
                      >
                        <UserCheck className="w-5 h-5" />
                        Transferir para Outro Professor
                      </button>
                    )}

                    {!solicitacaoAguardandoAceite && solicitacaoJaAssumida && (solicitacaoAguardandoResultado || solicitacaoProntaParaMatricula || solicitacaoFaltou) && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-4">
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pos-experimental</p>
                          <p className="text-sm text-slate-500 mt-1">
                            {solicitacaoProntaParaMatricula
                              ? "O aluno quer continuar. Agora defina as turmas reais e o início do plano."
                              : solicitacaoFaltou
                                ? "O aluno faltou. Agora voce decide se reagenda a aula teste ou se encerra esse fluxo."
                              : "Registre o resultado da aula experimental para decidir o proximo passo do aluno."}
                          </p>
                        </div>

                        {solicitacaoSelecionada.data_aula_experimental && (
                          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
                              Aula realizada
                            </p>
                            <p className="text-sm text-slate-100">
                              {formatarDataCurta(solicitacaoSelecionada.data_aula_experimental)}
                            </p>
                            {matriculaExperimentalDaSolicitacao?.turmas && (
                              <p className="text-xs text-slate-400 mt-1">
                                {matriculaExperimentalDaSolicitacao.turmas.dia_semana} as{" "}
                                {matriculaExperimentalDaSolicitacao.turmas.horario.substring(0, 5)}
                              </p>
                            )}
                          </div>
                        )}

                        {solicitacaoProntaParaMatricula ? (
                          <button
                            type="button"
                            onClick={() => seguirParaMatricula(solicitacaoSelecionada)}
                            disabled={!matriculaExperimentalDaSolicitacao || carregando}
                            className="w-full flex items-center justify-center gap-2 bg-white text-slate-950 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            Marcar Aula
                          </button>
                        ) : solicitacaoFaltou ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setModalAgendamentoAberto(true)}
                              className="w-full flex items-center justify-center gap-2 bg-white text-slate-950 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition-colors shadow-lg"
                            >
                              <CalendarDays className="w-5 h-5" />
                              Reagendar Experimental
                            </button>
                            <button
                              type="button"
                              onClick={() => registrarResultadoSolicitacao(solicitacaoSelecionada, "cancelado")}
                              className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-3.5 rounded-xl hover:bg-slate-700 transition-colors"
                            >
                              <AlertTriangle className="w-5 h-5" />
                              Cancelar Aula
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <button
                              type="button"
                              onClick={() => registrarResultadoSolicitacao(solicitacaoSelecionada, "faltou")}
                              className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-3.5 rounded-xl hover:bg-slate-700 transition-colors"
                            >
                              <X className="w-5 h-5" />
                              Não foi
                            </button>
                            <button
                              type="button"
                              onClick={() => registrarResultadoSolicitacao(solicitacaoSelecionada, "nao_vai_continuar")}
                              className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-3.5 rounded-xl hover:bg-slate-700 transition-colors"
                            >
                              <AlertTriangle className="w-5 h-5" />
                              Foi, mas não continua
                            </button>
                            <button
                              type="button"
                              onClick={() => seguirParaMatricula(solicitacaoSelecionada)}
                              disabled={!matriculaExperimentalDaSolicitacao || carregando}
                              className="w-full flex items-center justify-center gap-2 bg-white text-slate-950 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                              Foi e quer continuar
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {!solicitacaoAguardandoAceite && solicitacaoJaAssumida && !solicitacaoProntaParaMatricula && !solicitacaoAguardandoResultado && !solicitacaoFaltou && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Agendamento</p>
                          <p className="text-sm text-slate-500 mt-1">
                            {solicitacaoAulaMarcada
                              ? "A aula experimental ja esta marcada. Se precisar, voce pode ajustar a turma ou a data."
                              : "Escolha a turma e a data da primeira aula para confirmar o agendamento."}
                          </p>
                        </div>

                        {turmaExperimentalSelecionada && dataInicioExperimental ? (
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                            <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-300 mb-1">
                              {solicitacaoAulaMarcada ? "Aula confirmada" : "Seleção atual"}
                            </p>
                            <p className="text-sm text-slate-100">
                              {turmaExperimentalSelecionada.dia_semana} às {turmaExperimentalSelecionada.horario.substring(0, 5)}
                            </p>
                            <p className="text-xs text-slate-300 mt-1">
                              Início em {formatarDataCurta(dataInicioExperimental)}
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900 px-4 py-4 text-sm text-slate-400">
                            Nenhuma aula selecionada ainda.
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setModalAgendamentoAberto(true)}
                          disabled={!solicitacaoJaAssumida}
                          className="w-full flex items-center justify-center gap-2 bg-white text-slate-950 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CalendarDays className="w-5 h-5" />
                          {solicitacaoAulaMarcada ? "Reagendar Aula" : "Marcar Aula"}
                        </button>

                        <button
                          type="button"
                          onClick={() => registrarResultadoSolicitacao(solicitacaoSelecionada, "cancelado")}
                          className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-3.5 rounded-xl hover:bg-slate-700 transition-colors"
                        >
                          <AlertTriangle className="w-5 h-5" />
                          Cancelar Aula
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {(tipoModal === "professor" || tipoModal === "editar_professor") && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nome Completo</label>
                      <input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm" value={novoProfessor.nome} onChange={e => setNovoProfessor({...novoProfessor, nome: e.target.value})} />
                    </div>
                    
                    {/* E-mail: Só permite digitar se estiver CRIANDO um professor */}
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">E-mail</label>
                      <input 
                        type="email" required 
                        disabled={tipoModal === "editar_professor"} // Desabilita na edição
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                        value={novoProfessor.email} 
                        onChange={e => setNovoProfessor({...novoProfessor, email: e.target.value})} 
                      />
                    </div>

                    <div className={`grid ${tipoModal === "professor" ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
                      <div>
                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">WhatsApp</label>
                        <input 
                          type="tel" required placeholder="(00) 00000-0000" 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm" 
                          value={novoProfessor.whatsapp} 
                          onChange={e => setNovoProfessor({...novoProfessor, whatsapp: maskPhone(e.target.value)})} 
                        />
                      </div>
                      
                      {/* Senha: Só aparece ao CRIAR um professor */}
                      {tipoModal === "professor" && (
                        <div>
                          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Senha Provisória</label>
                          <input type="password" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm" value={novoProfessor.senha} onChange={e => setNovoProfessor({...novoProfessor, senha: e.target.value})} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {tipoModal === "efetivar_aluno" && (
                  <>
                    <div className="mb-4 p-3 sm:p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-lg sm:text-xl flex-shrink-0">{dadosEfetivacao.nomeAluno.charAt(0)}</div>
                      <div>
                        <h3 className="font-bold text-orange-400 text-sm sm:text-base leading-tight">{dadosEfetivacao.nomeAluno}</h3>
                        <p className="text-xs sm:text-sm text-slate-400">Marcação das aulas</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nível do Aluno</label>
                      <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={dadosEfetivacao.nivel} onChange={e => setDadosEfetivacao({...dadosEfetivacao, nivel: e.target.value})}>
                        <option>Iniciante</option><option>Intermediário</option><option>Avançado</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Aulas do Plano</label>
                        <span className="text-xs font-bold bg-slate-800 text-orange-500 px-2 py-0.5 rounded-md">
                          {dadosEfetivacao.turmasIds.length} selec.
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        Voce pode selecionar mais de uma turma no mesmo dia, se fizer sentido para a rotina do aluno.
                      </p>
                      
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
                        {diasDisponiveisEfetivacao.map(dia => {
                          const temTurmaNesteDia = turmasDisponiveisEfetivacao.some(
                            (turma) => turma.dia_semana === dia && dadosEfetivacao.turmasIds.includes(turma.id)
                          );
                          return (
                            <button
                              key={dia}
                              type="button"
                              onClick={() => setDiaFiltroModal(dia)}
                              className={`flex-shrink-0 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                                diaFiltroModal === dia ? "bg-slate-700 text-white" : "bg-slate-950 text-slate-500 border border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              {dia.substring(0,3)}
                              {temTurmaNesteDia && <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-col gap-3 mt-4">
                        {turmasFiltradasNoModal.length === 0 ? (
                          <p className="text-xs text-slate-500 py-6 text-center bg-slate-950 rounded-xl border border-slate-800">
                            Nenhuma turma disponível neste dia.
                          </p>
                        ) : (
                          turmasFiltradasNoModal.map(t => {
                            const selecionado = dadosEfetivacao.turmasIds.includes(t.id);
                            const lotacao = contarOcupacaoTurma(t);
                            const estaCheia = lotacao >= t.vagas_totais;
                            const disabled = estaCheia && !selecionado; // Impede seleção se estiver cheia (e não for a atual)
                            
                            // Verifica se o aluno que estamos a efetivar já faz parte desta turma (como experimental)
                            const matriculasVisiveisDaTurma = obterMatriculasVisiveisTurma(t);
                            const alunoJaNaTurma = matriculasVisiveisDaTurma.some(
                              (m: Matricula) => m.perfis?.id === dadosEfetivacao.perfilId
                            );

                            return (
                              <div 
                                key={t.id} 
                                onClick={() => { if (!disabled) toggleTurmaEfetivacao(t.id) }}
                                className={`border rounded-2xl p-4 transition-all relative overflow-hidden flex flex-col gap-3 ${
                                  disabled ? "bg-slate-950/50 border-slate-800/50 cursor-not-allowed opacity-60" :
                                  selecionado ? "bg-orange-500/5 border-orange-500 cursor-pointer shadow-[0_0_15px_rgba(249,115,22,0.1)]" : "bg-slate-950 border-slate-800 cursor-pointer hover:border-slate-700 hover:bg-slate-900"
                                }`}
                              >
                                {/* HEADER DO CARD: Info e Lotação */}
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`font-bold text-base ${selecionado ? "text-white" : "text-slate-200"}`}>{t.dia_semana}</span>
                                      <span className={selecionado ? "text-orange-400 font-bold text-base" : "text-slate-400 font-bold text-base"}>{t.horario.substring(0,5)}</span>
                                    </div>
                                    <div className={`text-[10px] font-bold uppercase tracking-wider ${selecionado ? "text-orange-500/80" : "text-slate-500"}`}>{t.nivel}</div>
                                    <p className={`mt-1 text-xs ${selecionado ? "text-slate-200" : "text-slate-400"}`}>
                                      {obterNomeProfessorTurma(t)}
                                    </p>
                                  </div>

                                  <div className="flex flex-col items-end gap-2">
                                    {/* Ícone de check ou status */}
                                    {selecionado ? (
                                      <CheckCircle2 className="w-6 h-6 text-orange-500" />
                                    ) : disabled ? (
                                      <span className="text-[10px] font-bold text-red-500 uppercase">Lotada</span>
                                    ) : (
                                      <div className="w-6 h-6 rounded-full border-2 border-slate-700"></div>
                                    )}
                                    
                                    {/* Etiqueta de vagas */}
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider mt-1 ${
                                      estaCheia ? "bg-red-500/10 text-red-500" :
                                      selecionado ? "bg-orange-500/20 text-orange-500" : "bg-slate-800 text-slate-400"
                                    }`}>
                                      {lotacao} / {t.vagas_totais} vagas
                                    </span>
                                  </div>
                                </div>

                                {/* LISTA DE AVATARES DOS ALUNOS */}
                                <div className="border-t border-slate-800/50 pt-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase shrink-0">Alunos na turma:</span>
                                    <div className="flex flex-wrap gap-1.5 flex-1">
                                      {matriculasVisiveisDaTurma.length > 0 ? (
                                        matriculasVisiveisDaTurma.map((mat: Matricula) => {
                                          const nomeCompleto = mat.perfis?.nome || "Aluno";
                                          const primeiroNome = nomeCompleto.split(" ")[0];
                                          const isExp = mat.status === 'experimental';
                                          const isCurrentStudent = mat.perfis?.id === dadosEfetivacao.perfilId;

                                          return (
                                            <div
                                              key={`efetivacao-turma-${t.id}-matricula-${mat.id}`}
                                              title={`${nomeCompleto} ${isExp ? '(Experimental)' : ''}`}
                                              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold cursor-help ring-2 ring-slate-950 ${
                                                isCurrentStudent ? 'bg-emerald-500 text-slate-950 ring-emerald-500/30' :
                                                isExp ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-800 text-slate-300'
                                              }`}
                                            >
                                              {primeiroNome.charAt(0).toUpperCase()}
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <span className="text-xs text-slate-600 font-medium">Turma vazia</span>
                                      )}

                                      {/* PREVIEW: Mostra um avatar "+1" fantasma se a turma for selecionada e o aluno ainda não estiver nela */}
                                      {selecionado && !alunoJaNaTurma && (
                                         <div 
                                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-slate-950 bg-orange-500 text-slate-950 border border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.4)] animate-pulse" 
                                            title="Novo Aluno (Preview)"
                                         >
                                           +1
                                         </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>

                    {turmasSelecionadasEfetivacao.length > 0 && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-4">
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Inicio do plano</p>
                          <p className="text-sm text-slate-500 mt-1">
                            Escolha a data em que o plano do aluno começa. Essa mesma referência vale para as turmas selecionadas.
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-white">
                                Data de início do plano
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                Defina a partir de quando a mensalidade e o plano começam a contar.
                              </p>
                            </div>
                            <span className="text-[11px] px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300 font-bold uppercase tracking-wider">
                              Sugestão: {formatarDataCurta(dadosEfetivacao.dataInicioPlano || dataMinimaAgendamento)}
                            </span>
                          </div>

                          <input
                            type="date"
                            min={dataMinimaAgendamento}
                            value={dadosEfetivacao.dataInicioPlano}
                            onChange={(e) => atualizarDataInicioEfetivacao(e.target.value)}
                            style={{ colorScheme: "dark" }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm"
                          />

                          {dadosEfetivacao.dataInicioPlano && !dataInicioPlanoValida && (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                              Escolha uma data de início igual ou posterior a hoje.
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-2">
                              Confirmadas agora
                            </p>
                            {turmasEfetivacaoDiretas.length > 0 ? (
                              <div className="space-y-2">
                                {turmasEfetivacaoDiretas.map((turma) => (
                                  <p key={`direta-${turma.id}`} className="text-sm text-white">
                                    {turma.dia_semana} às {turma.horario.substring(0, 5)} • {obterNomeProfessorTurma(turma)}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-emerald-200/80">
                                Nenhuma turma será confirmada diretamente neste envio.
                              </p>
                            )}
                          </div>

                          <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-300 mb-2">
                              Aguardando aceite
                            </p>
                            {turmasEfetivacaoAguardandoAceite.length > 0 ? (
                              <div className="space-y-2">
                                {turmasEfetivacaoAguardandoAceite.map((turma) => (
                                  <p key={`pendente-aceite-${turma.id}`} className="text-sm text-white">
                                    {turma.dia_semana} às {turma.horario.substring(0, 5)} • {obterNomeProfessorTurma(turma)}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-orange-200/80">
                                Nenhuma turma depende de aceite de outro professor.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {tipoModal === "editar_aluno" && alunoSelecionado && (
                  <div className="space-y-4">
                    <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl mb-4">
                      <p className="text-sm text-orange-400 font-medium text-center">
                        Editando dados de: <span className="text-white font-bold">{alunoSelecionado.perfis?.nome}</span>
                      </p>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nível do Aluno</label>
                      <select
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500"
                        value={nivelEdicao}
                        onChange={(e) => setNivelEdicao(e.target.value)}
                      >
                        <option value="Iniciante">Iniciante</option>
                        <option value="Intermediário">Intermediário</option>
                        <option value="Avançado">Avançado</option>
                        <option value="Pró">Pró</option>
                      </select>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Horários e Turmas
                      </p>
                      <p className="text-sm text-slate-300">
                        Para adicionar, remover ou trocar horários, use a aba <span className="font-semibold text-white">Matriculados</span>.
                      </p>
                    </div>
                  </div>
                )}
                {tipoModal === "editar_horarios_aluno" && alunoSelecionado && (
                  <div className="space-y-4">
                    <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl mb-4">
                      <p className="text-sm text-orange-400 font-medium text-center">
                        Ajustando horários de: <span className="text-white font-bold">{alunoSelecionado.perfis?.nome}</span>
                      </p>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nível do Aluno</label>
                      <select
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500"
                        value={nivelEdicao}
                        onChange={(e) => setNivelEdicao(e.target.value)}
                      >
                        <option value="Iniciante">Iniciante</option>
                        <option value="Intermediário">Intermediário</option>
                        <option value="Avançado">Avançado</option>
                        <option value="Pró">Pró</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                          Horários do Aluno
                        </label>
                        <span className="text-xs font-bold bg-slate-800 text-orange-500 px-2 py-0.5 rounded-md">
                          {dadosEdicaoAluno.turmasIds.length} selec.
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        Toque para adicionar ou remover horários. Você pode ajustar mais de uma turma do mesmo aluno.
                      </p>

                      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
                        {diasComTurmaEditavel.map((dia) => {
                          const temSelecionadaNoDia = turmasEditaveisAluno.some(
                            (turma) => turma.dia_semana === dia && dadosEdicaoAluno.turmasIds.includes(turma.id)
                          );

                          return (
                            <button
                              key={`edicao-dia-${dia}`}
                              type="button"
                              onClick={() => setDiaFiltroModal(dia)}
                              className={`flex-shrink-0 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                                diaFiltroModal === dia
                                  ? "bg-slate-700 text-white"
                                  : "bg-slate-950 text-slate-500 border border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              {dia.substring(0, 3)}
                              {temSelecionadaNoDia && <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {turmasEditaveisFiltradasNoModal.length === 0 ? (
                        <p className="text-xs text-slate-500 py-6 text-center bg-slate-950 rounded-xl border border-slate-800">
                          Nenhuma turma disponível neste dia.
                        </p>
                      ) : (
                        turmasEditaveisFiltradasNoModal.map((turma) => {
                          const selecionado = dadosEdicaoAluno.turmasIds.includes(turma.id);
                          const lotacao = contarOcupacaoTurma(turma);
                          const matriculasVisiveisDaTurma = obterMatriculasVisiveisTurma(turma);
                          const alunoJaNaTurma = matriculasRelacionadasAlunoSelecionado.some(
                            (matricula) =>
                              matricula.turma_id === turma.id &&
                              !["experimental", "pendente", "inativo"].includes(matricula.status)
                          );
                          const estaCheia = lotacao >= turma.vagas_totais;
                          const disabled = estaCheia && !alunoJaNaTurma && !selecionado;

                          return (
                            <button
                              key={`edicao-turma-${turma.id}`}
                              type="button"
                              onClick={() => {
                                if (!disabled) toggleTurmaEdicaoAluno(turma.id);
                              }}
                              className={`w-full border rounded-2xl p-4 transition-all text-left ${
                                disabled
                                  ? "bg-slate-950/50 border-slate-800/50 cursor-not-allowed opacity-60"
                                  : selecionado
                                    ? "bg-orange-500/5 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]"
                                    : "bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-bold text-base ${selecionado ? "text-white" : "text-slate-200"}`}>
                                      {turma.dia_semana}
                                    </span>
                                    <span className={selecionado ? "text-orange-400 font-bold text-base" : "text-slate-400 font-bold text-base"}>
                                      {turma.horario.substring(0, 5)}
                                    </span>
                                  </div>
                                  <div className={`text-[10px] font-bold uppercase tracking-wider ${selecionado ? "text-orange-500/80" : "text-slate-500"}`}>
                                    {turma.nivel}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-2">
                                    Professor: {obterNomeProfessorTurma(turma)}
                                  </p>
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                  {selecionado ? (
                                    <CheckCircle2 className="w-6 h-6 text-orange-500" />
                                  ) : disabled ? (
                                    <span className="text-[10px] font-bold text-red-500 uppercase">Lotada</span>
                                  ) : (
                                    <div className="w-6 h-6 rounded-full border-2 border-slate-700"></div>
                                  )}

                                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                                    estaCheia ? "bg-red-500/10 text-red-500" : "bg-slate-800 text-slate-400"
                                  }`}>
                                    {matriculasVisiveisDaTurma.length} / {turma.vagas_totais} vagas
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {turmasSelecionadasEdicaoAluno.length > 0 ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-4">
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                            Início do plano
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            Essa data vale como referência do plano para todos os horários ativos do aluno.
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-white">
                                Data de início do plano
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                Use a mesma referência para manter a cobrança e o histórico alinhados.
                              </p>
                            </div>
                            <span className="text-[11px] px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300 font-bold uppercase tracking-wider">
                              Hoje: {formatarDataCurta(dataMinimaAgendamento)}
                            </span>
                          </div>

                          <input
                            type="date"
                            min={dataMinimaAgendamento}
                            value={dadosEdicaoAluno.dataInicioPlano}
                            onChange={(e) => atualizarDataInicioEdicaoAluno(e.target.value)}
                            style={{ colorScheme: "dark" }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm"
                          />

                          {dadosEdicaoAluno.dataInicioPlano && !dataInicioEdicaoAlunoValida && (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                              Escolha uma data de início igual ou posterior a hoje.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 px-4 py-5 text-sm text-slate-400">
                        Nenhum horário selecionado. Se salvar assim, o aluno ficará sem turmas ativas.
                      </div>
                    )}
                  </div>
                )}
                {(tipoModal === "turma" || tipoModal === "editar_turma" || tipoModal === "quadra") && (
                  <div>
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Dia da Semana</label>
                    <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={tipoModal === "quadra" ? novoHorarioQuadra.dia_semana : novaTurma.dia_semana} onChange={e => tipoModal === "quadra" ? setNovoHorarioQuadra({...novoHorarioQuadra, dia_semana: e.target.value}) : setNovaTurma({...novaTurma, dia_semana: e.target.value})}>
                      <option>Segunda</option><option>Terça</option><option>Quarta</option><option>Quinta</option><option>Sexta</option><option>Sábado</option><option>Domingo</option>
                    </select>
                  </div>
                )}

                {(tipoModal === "turma" || tipoModal === "editar_turma") && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Horário</label><input type="time" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={novaTurma.horario} onChange={e => setNovaTurma({...novaTurma, horario: e.target.value})} /></div>
                      <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Vagas</label><input type="number" min="1" max="12" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={novaTurma.vagas_totais} onChange={e => setNovaTurma({...novaTurma, vagas_totais: Number(e.target.value)})} /></div>
                    </div>
                    <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nível</label><select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={novaTurma.nivel} onChange={e => setNovaTurma({...novaTurma, nivel: e.target.value})}><option>Iniciante</option><option>Intermediário</option><option>Avançado</option></select></div>
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Professor Responsável</label>
                      <select
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm"
                        value={novaTurma.professor_id}
                        onChange={(e) => setNovaTurma({ ...novaTurma, professor_id: e.target.value })}
                      >
                        <option value="">Selecione um professor</option>
                        {professores.map((professor) => (
                          <option key={professor.id} value={professor.id}>
                            {professor.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {tipoModal === "quadra" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Início</label><input type="time" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={novoHorarioQuadra.horario_inicio} onChange={e => setNovoHorarioQuadra({...novoHorarioQuadra, horario_inicio: e.target.value})} /></div>
                      <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Fim</label><input type="time" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={novoHorarioQuadra.horario_fim} onChange={e => setNovoHorarioQuadra({...novoHorarioQuadra, horario_fim: e.target.value})} /></div>
                    </div>
                    <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Valor (R$)</label><input type="text" placeholder="Ex: R$ 80,00" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={novoHorarioQuadra.preco} onChange={e => setNovoHorarioQuadra({...novoHorarioQuadra, preco: e.target.value})} /></div>
                  </>
                )}

                {tipoModal !== "ver_aluno" &&
                  !(
                    tipoModal === "ver_solicitacao" &&
                    !(tipoLogado === "admin" && !!professorResponsavelSelecionado && professorResponsavelSelecionado !== responsavelAtualSolicitacao)
                  ) && (
                  <button
                    type="submit"
                    disabled={
                      carregando ||
                      (tipoModal === "editar_horarios_aluno" &&
                        dadosEdicaoAluno.turmasIds.length > 0 &&
                        !dataInicioEdicaoAlunoValida) ||
                      (tipoModal === "efetivar_aluno" &&
                        (dadosEfetivacao.turmasIds.length === 0 || !dataInicioPlanoValida))
                    }
                    className="w-full mt-6 py-4 bg-orange-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-orange-600 transition-colors shadow-lg disabled:opacity-50"
                  >
                    {carregando
                      ? "Processando..."
                      : tipoModal === "editar_turma"
                        ? "Salvar Alterações"
                        : tipoModal === "editar_aluno"
                          ? "Salvar Aluno"
                          : tipoModal === "editar_horarios_aluno"
                            ? "Salvar Horários"
                        : tipoModal === "efetivar_aluno"
                          ? dadosEfetivacao.solicitacaoId
                            ? "Salvar Plano"
                            : "Confirmar Matrículas"
                          : tipoModal === "ver_solicitacao"
                            ? "Salvar Responsável"
                            : "Salvar professor"}
                  </button>
                )}
              </form>
            </motion.div>
          </div>
        )}
        {modalAgendamentoAberto && solicitacaoSelecionada && (
          <div key="modal-agendamento" className="fixed inset-0 z-[135] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalAgendamentoAberto(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-[2rem] shadow-2xl w-full max-w-lg sm:max-w-2xl relative z-10 max-h-[85vh] overflow-y-auto scrollbar-hide"
            >
              <button
                onClick={() => setModalAgendamentoAberto(false)}
                className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors bg-slate-800/50 p-2 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 pr-10">Marcar Aula</h3>
              <p className="text-sm text-slate-400 mb-5">
                Escolha a turma e a data exata em que o aluno vai começar.
              </p>

              {erroModal && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm font-medium mb-4">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{erroModal}</p>
                </div>
              )}

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-4">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Solicitação</p>
                <p className="text-sm text-white font-bold">{solicitacaoSelecionada.nome_aluno}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {solicitacaoExigeProfessorEscolhido
                    ? `Professor escolhido: ${obterNomeProfessorEscolhido(solicitacaoSelecionada)}`
                    : `Responsável do agendamento: ${buscarNomeProfessorPorId(professorResponsavelEfetivo)}`}
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Turmas Disponíveis</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {solicitacaoExigeProfessorEscolhido
                        ? "Mostrando apenas as turmas do professor escolhido."
                        : professorResponsavelEfetivo
                          ? `Mostrando as turmas com vaga de ${buscarNomeProfessorPorId(professorResponsavelEfetivo)}.`
                          : "Defina quem vai atender para liberar as turmas disponíveis."}
                    </p>
                  </div>
                  {turmaExperimentalId && (
                    <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 px-3 py-2 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4" />
                      Turma selecionada
                    </span>
                  )}
                </div>

                {!professorResponsavelEfetivo ? (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900 px-4 py-5 text-sm text-slate-400">
                    Escolha primeiro quem vai atender esta solicitação para carregar as turmas disponíveis.
                  </div>
                ) : diasDisponiveisSolicitacao.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900 px-4 py-5 text-sm text-slate-400">
                    Nenhuma turma com vaga está disponível neste momento para este professor.
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {diasDisponiveisSolicitacao.map((dia) => (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => {
                            setDiaAgendamentoSolicitacao(dia);
                            setTurmaExperimentalId(null);
                            setDataInicioExperimental("");
                          }}
                          className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
                            diaAgendamentoSolicitacao === dia
                              ? "bg-orange-500 text-slate-950 border-orange-500"
                              : "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500"
                          }`}
                        >
                          {dia}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {turmasDoDiaSolicitacao.map((turma) => {
                        const ocupacao = contarOcupacaoTurma(turma);
                        const selecionada = turmaExperimentalId === turma.id;
                        const nivelCompativel =
                          !!nivelAlunoSolicitacao &&
                          turma.nivel.toLowerCase() === nivelAlunoSolicitacao.toLowerCase();

                        return (
                          <button
                            key={turma.id}
                            type="button"
                            onClick={() =>
                              setTurmaExperimentalId((atual) => {
                                const proximaTurmaId = atual === turma.id ? null : turma.id;
                                setDataInicioExperimental(
                                  proximaTurmaId === turma.id ? obterProximaDataDaTurma(turma) : ""
                                );
                                return proximaTurmaId;
                              })
                            }
                            className={`w-full rounded-2xl border p-4 text-left transition-all ${
                              selecionada
                                ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                                : "border-slate-700 bg-slate-900 hover:border-orange-500/50 hover:bg-slate-800/80"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock className="w-4 h-4 text-orange-400" />
                                  <span className="font-bold text-white">{turma.horario.substring(0, 5)}</span>
                                </div>
                                <p className="text-sm text-slate-300">{turma.nivel}</p>
                                <p className="text-xs text-slate-500 mt-1">Professor(a) {obterNomeProfessorTurma(turma)}</p>
                              </div>

                              {selecionada ? (
                                <div className="w-9 h-9 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center flex-shrink-0">
                                  <CheckCircle2 className="w-5 h-5" />
                                </div>
                              ) : (
                                <div className="text-right flex-shrink-0">
                                  <p className="text-xs text-slate-500 uppercase tracking-wider">Lotação</p>
                                  <p className="text-sm font-bold text-emerald-400">{ocupacao}/{turma.vagas_totais}</p>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-4">
                              <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-950 border border-slate-700 text-slate-300">
                                {turma.vagas_totais - ocupacao} vaga(s) livre(s)
                              </span>
                              {nivelCompativel && (
                                <span className="text-[11px] px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400">
                                  Nível compatível
                                </span>
                              )}
                              <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                Turma do responsável
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {turmaExperimentalSelecionada && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Primeira Aula</p>
                            <p className="text-sm text-slate-500 mt-1">
                              Escolha em qual {turmaExperimentalSelecionada.dia_semana.toLowerCase()} o aluno começa.
                            </p>
                          </div>
                          <span className="text-[11px] px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300 font-bold uppercase tracking-wider">
                            Sugestão: {formatarDataCurta(obterProximaDataDaTurma(turmaExperimentalSelecionada))}
                          </span>
                        </div>

                        <input
                          type="date"
                          min={dataMinimaAgendamento}
                          value={dataInicioExperimental}
                          onChange={(e) => setDataInicioExperimental(e.target.value)}
                          style={{ colorScheme: "dark" }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm"
                        />

                        {dataInicioExperimental && !dataInicioCompativelComTurma && (
                          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                            A data escolhida precisa cair em {turmaExperimentalSelecionada.dia_semana}.
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-slate-500">
                      {solicitacaoExigeProfessorEscolhido
                        ? <>O aluno entra como <span className="text-orange-400 font-bold">experimental</span> em uma turma do professor escolhido.</>
                        : <>O aluno entra como <span className="text-orange-400 font-bold">experimental</span> em uma turma do professor responsável atual.</>}
                    </p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setModalAgendamentoAberto(false)}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-3.5 rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={carregando || !turmaExperimentalId || !dataInicioExperimental || !dataInicioCompativelComTurma}
                  onClick={confirmarAgendamentoSolicitacao}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 text-slate-950 font-bold py-3.5 rounded-xl hover:bg-orange-600 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CalendarDays className="w-5 h-5" />
                  Confirmar Agendamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {modalTransferenciaAberto && solicitacaoSelecionada && (
          <div key="modal-transferencia" className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalTransferenciaAberto(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-[2rem] shadow-2xl w-full max-w-lg relative z-10 max-h-[85vh] overflow-y-auto scrollbar-hide"
            >
              <button
                onClick={() => setModalTransferenciaAberto(false)}
                className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors bg-slate-800/50 p-2 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 pr-10">Transferir Solicitação</h3>
              <p className="text-sm text-slate-400 mb-5">
                Escolha o professor destino e confira os horários disponíveis antes de enviar o repasse.
              </p>

              {erroModal && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm font-medium mb-4">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{erroModal}</p>
                </div>
              )}

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-4">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Solicitação</p>
                <p className="text-sm text-white font-bold">{solicitacaoSelecionada.nome_aluno}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {solicitacaoSelecionada.status === "aguardando_aceite_professor"
                    ? "Repasse aguardando aceite do professor destino"
                    : <>Responsável atual: <span className="text-slate-200">{obterNomeProfessorResponsavel(solicitacaoSelecionada)}</span></>}
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-3">
                    Professores
                  </p>
                  <div className="space-y-2">
                    {professoresComDisponibilidade.map(({ professor, turmas }) => {
                      const selecionado = professorTransferenciaSelecionado === professor.id;
                      const disponibilidadeTexto =
                        turmas.length > 0
                          ? `${turmas.length} horario(s) com vaga`
                          : "Sem horarios com vaga";

                      return (
                        <button
                          key={`professor-disponibilidade-${professor.id}`}
                          type="button"
                          onClick={() => {
                            const proximoId = selecionado ? "" : professor.id;
                            setProfessorTransferenciaSelecionado(proximoId);
                            setTurmaSugeridaTransferenciaId(null);
                          }}
                          className={`w-full rounded-xl border p-3 text-left transition-colors ${
                            selecionado
                              ? "border-orange-500/30 bg-orange-500/5"
                              : "border-slate-800 bg-slate-900 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-white">{professor.nome}</p>
                              <p className="text-xs text-slate-400 mt-1">{disponibilidadeTexto}</p>
                            </div>
                            <span className={`text-[10px] px-2.5 py-1 rounded-full border uppercase font-bold ${
                              selecionado
                                ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
                                : "border-slate-700 bg-slate-950 text-slate-300"
                            }`}>
                              {selecionado ? "Selecionado" : "Selecionar"}
                            </span>
                          </div>
                          {turmas.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {turmas.map((turma) => (
                                <span
                                  key={`disponibilidade-${professor.id}-${turma.id}`}
                                  className="text-[11px] px-2.5 py-1 rounded-full bg-slate-950 border border-slate-700 text-slate-300"
                                >
                                  {turma.dia_semana} {turma.horario.substring(0, 5)}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {professorTransferenciaSelecionado && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                        Sugestão de Turma
                      </p>
                      <p className="text-xs text-slate-400">
                        Opcional. O professor destino pode seguir sua sugestão ou escolher outra turma.
                      </p>
                    </div>

                    <select
                      value={turmaSugeridaTransferenciaId ?? ""}
                      onChange={(e) =>
                        setTurmaSugeridaTransferenciaId(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm"
                    >
                      <option value="">Sem sugestão de turma</option>
                      {turmasProfessorTransferencia.map((turma) => (
                        <option key={`transferencia-turma-${turma.id}`} value={turma.id}>
                          {turma.dia_semana} às {turma.horario.substring(0, 5)} - {turma.nivel}
                        </option>
                      ))}
                    </select>

                    {turmasProfessorTransferencia.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900 px-4 py-4 text-sm text-slate-400">
                        Este professor não tem turmas com vaga no momento. Você ainda pode transferir sem sugerir turma.
                      </div>
                    )}
                  </div>
                )}

                {professoresComDisponibilidade.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 px-4 py-5 text-sm text-slate-400">
                    Nenhum outro professor com vaga disponível foi encontrado no momento.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setModalTransferenciaAberto(false)}
                  className="w-full py-3.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={!professorTransferenciaEhValido || carregando}
                  onClick={() => transferirSolicitacao(solicitacaoSelecionada, professorTransferenciaSelecionado)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-white text-slate-950 font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  <UserCheck className="w-5 h-5" />
                  Confirmar Transferência
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {modalRecusaRepasseAberto && solicitacaoRecusaRepasse && (
          <div key="modal-recusa-repasse" className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={fecharModalRecusaRepasse}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-[2rem] shadow-2xl w-full max-w-lg relative z-10"
            >
              <button
                onClick={fecharModalRecusaRepasse}
                className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors bg-slate-800/50 p-2 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 pr-10">Recusar Repasse</h3>
              <p className="text-sm text-slate-400 mb-5">
                Essa observação vai voltar junto com o aluno para o professor que fez o repasse.
              </p>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-4">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Aluno</p>
                <p className="text-sm text-white font-bold">{solicitacaoRecusaRepasse.nome_aluno}</p>
                {solicitacaoRecusaRepasse.professor_origem_transferencia_id && (
                  <p className="text-xs text-slate-400 mt-1">
                    Voltará para{" "}
                    <span className="text-slate-200">
                      {solicitacaoRecusaRepasse.professor_origem_transferencia?.nome ||
                        buscarNomeProfessorPorId(solicitacaoRecusaRepasse.professor_origem_transferencia_id)}
                    </span>
                  </p>
                )}
              </div>

              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">
                Observação da Recusa
              </label>
              <textarea
                value={observacaoRecusaRepasse}
                onChange={(e) => setObservacaoRecusaRepasse(e.target.value)}
                placeholder="Ex: meus horários não encaixam com a disponibilidade do aluno."
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm resize-none"
              />

              {erroModal && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{erroModal}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                <button
                  type="button"
                  onClick={fecharModalRecusaRepasse}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-3.5 rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={carregando || !observacaoRecusaRepasse.trim()}
                  onClick={() => recusarRepasse(solicitacaoRecusaRepasse, observacaoRecusaRepasse)}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3.5 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-5 h-5" />
                  Confirmar Recusa
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {modalRecusaMatriculaAberto && matriculaRecusaPendente && (
          <div key="modal-recusa-matricula" className="fixed inset-0 z-[145] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={fecharModalRecusaMatricula}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-[2rem] shadow-2xl w-full max-w-lg relative z-10"
            >
              <button
                onClick={fecharModalRecusaMatricula}
                className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors bg-slate-800/50 p-2 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 pr-10">Recusar Turma</h3>
              <p className="text-sm text-slate-400 mb-5">
                Essa observação ficará visível no histórico do aluno para o professor que indicou essa turma.
              </p>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-4">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Aluno</p>
                <p className="text-sm text-white font-bold">{matriculaRecusaPendente.perfis?.nome || "Aluno"}</p>
                {matriculaRecusaPendente.turmas && (
                  <p className="text-xs text-slate-400 mt-1">
                    {matriculaRecusaPendente.turmas.dia_semana} às {matriculaRecusaPendente.turmas.horario.substring(0, 5)} • {obterNomeProfessorTurma(matriculaRecusaPendente.turmas)}
                  </p>
                )}
              </div>

              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">
                Observação da Recusa
              </label>
              <textarea
                value={observacaoRecusaMatricula}
                onChange={(e) => setObservacaoRecusaMatricula(e.target.value)}
                placeholder="Ex: essa turma está com perfil técnico diferente do que consigo atender agora."
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm resize-none"
              />

              {erroModal && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{erroModal}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                <button
                  type="button"
                  onClick={fecharModalRecusaMatricula}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-3.5 rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={carregando || !observacaoRecusaMatricula.trim()}
                  onClick={() => recusarMatriculaPendente(matriculaRecusaPendente)}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3.5 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-5 h-5" />
                  Confirmar Recusa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        <main className="max-w-5xl mx-auto px-4 pt-3 sm:px-6 sm:pt-24 pb-36 sm:pb-10">
        <nav className="hidden sm:block mb-8">
          <div className={`hidden sm:grid sm:grid-cols-2 ${classesGridDesktopNavegacao} gap-3`}>
            {navegacaoAdmin.map((item) => {
              const Icone = item.icon;
              const ativo = secaoAtiva === item.id;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`rounded-2xl border px-4 py-4 transition-all ${
                    ativo
                      ? "border-orange-500/30 bg-orange-500/10 text-white shadow-[0_0_24px_rgba(249,115,22,0.12)]"
                      : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`rounded-xl p-2 ${ativo ? "bg-orange-500 text-slate-950" : "bg-slate-950 text-slate-400"}`}>
                        <Icone className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold truncate">{item.label}</span>
                    </div>
                    {item.badge ? (
                      <span className="min-w-6 rounded-full bg-orange-500 px-2 py-1 text-[10px] font-bold text-slate-950 text-center">
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {carregando && turmas.length === 0 && matriculas.length === 0 ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        ) : (
          <>
            {secaoAtiva === "alunos" && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex flex-col gap-4 mb-6">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Alunos</h2>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Veja cada aluno uma única vez, com resumo do histórico, experimental e turmas ativas.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
                    <input
                      type="text"
                      value={buscaAlunos}
                      onChange={(e) => setBuscaAlunos(e.target.value)}
                      placeholder="Buscar por nome ou WhatsApp"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500"
                    />

                    {tipoLogado === "admin" && (
                      <select
                        value={filtroProfessorAlunos}
                        onChange={(e) => setFiltroProfessorAlunos(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500"
                      >
                        <option value="todos">Todos os professores</option>
                        {professores.map((professor) => (
                          <option key={`alunos-professor-${professor.id}`} value={professor.id}>
                            {professor.nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "todos" as const, label: "Todos", total: totalPerfisAlunos },
                      { id: "matriculados" as const, label: "Matriculados", total: totalPerfisMatriculados },
                      { id: "experimentais" as const, label: "Experimentais", total: totalPerfisExperimentais },
                      { id: "inativos" as const, label: "Inativos", total: totalPerfisInativos },
                    ].map((filtro) => (
                      <button
                        key={`filtro-perfis-${filtro.id}`}
                        type="button"
                        onClick={() => setFiltroCategoriaAlunos(filtro.id)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition-colors ${
                          filtroCategoriaAlunos === filtro.id
                            ? "border-orange-500 bg-orange-500 text-slate-950"
                            : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white"
                        }`}
                      >
                        {filtro.label}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            filtroCategoriaAlunos === filtro.id
                              ? "bg-slate-950/10"
                              : "bg-slate-950 text-slate-400"
                          }`}
                        >
                          {filtro.total}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {alunosFiltrados.length === 0 ? (
                  <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/50 text-slate-500 text-sm">
                    Nenhum aluno encontrado neste filtro.
                  </div>
                ) : (
                  <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {alunosFiltrados.map((aluno) => {
                      const idade = calcularIdade(aluno.perfil.data_nascimento);
                      const labelAcaoPrincipal = aluno.contextoExperimentalAtual?.experimentalAguardandoResultado
                        ? "Registrar Resultado"
                        : aluno.contextoExperimentalAtual?.experimentalProntoParaMatricula
                          ? "Montar Treino"
                          : aluno.contextoExperimentalAtual
                            ? "Ver Experimental"
                            : "Ver aluno";

                      return (
                        <motion.div
                          key={`perfil-${aluno.perfil.id}`}
                          variants={item}
                          className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col gap-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 flex-shrink-0">
                                {aluno.perfil.nome?.charAt(0) || "?"}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-white text-sm sm:text-base leading-tight truncate">
                                  {aluno.perfil.nome || "Aluno"}
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                                  {maskPhone(aluno.perfil.whatsapp || "") || "WhatsApp não preenchido"}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {idade !== null && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md uppercase border border-slate-700 bg-slate-950 text-slate-300">
                                      {idade} anos
                                    </span>
                                  )}
                                  <span className="text-[10px] px-2 py-0.5 rounded-md uppercase border border-slate-700 bg-slate-950 text-slate-300">
                                    Nível {aluno.perfil.nivel || "N/A"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <span className={`text-[10px] px-2 py-1 rounded-md uppercase border whitespace-nowrap ${
                              aluno.precisaAtencao
                                ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                                : aluno.possuiFluxoExperimental
                                  ? "border-orange-500/20 bg-orange-500/10 text-orange-400"
                                  : aluno.possuiMatriculasAtivas
                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                    : "border-slate-700 bg-slate-950 text-slate-400"
                            }`}>
                              {aluno.labelStatus}
                            </span>
                          </div>

                          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                            {aluno.descricao}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-800 pt-3">
                            <div className="text-xs text-slate-500">
                              {aluno.possuiMatriculasAtivas
                                ? `${aluno.matriculasAtivas.length} turma(s) ativa(s)`
                                : aluno.possuiAceitesPendentes
                                  ? `${aluno.matriculasPendentesAceite.length} turma(s) aguardando aceite`
                                : aluno.possuiFluxoExperimental
                                  ? "Em fluxo experimental"
                                  : "Cadastro sem turma ativa"}
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              {aluno.contextoExperimentalAtual?.solicitacaoRelacionada && (
                                <button
                                  type="button"
                                  onClick={() => abrirModalSolicitacao(aluno.contextoExperimentalAtual!.solicitacaoRelacionada!)}
                                  className={`flex-1 sm:flex-none justify-center px-4 py-2.5 font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center gap-2 ${
                                    aluno.contextoExperimentalAtual.experimentalAguardandoResultado
                                      ? "bg-emerald-500 text-slate-950 hover:bg-emerald-600"
                                      : "bg-white text-slate-950 hover:bg-slate-200"
                                  }`}
                                >
                                  <Eye className="w-4 h-4" />
                                  {labelAcaoPrincipal}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => abrirDetalhesAluno(aluno.matriculaRepresentante)}
                                className="flex-1 sm:flex-none justify-center px-4 py-2.5 bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2"
                              >
                                <Users className="w-4 h-4" />
                                Ver aluno
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </motion.div>
            )}

            {secaoAtiva === "matriculas" && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex flex-col gap-4 mb-6">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Matriculados</h2>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Um card por aluno, incluindo turmas confirmadas e pendentes de aceite. Ao visualizar, você vê todas elas.
                    </p>
                  </div>

                  <div className={`grid grid-cols-1 gap-3 ${tipoLogado === "admin" ? "sm:grid-cols-[minmax(0,1fr)_220px_190px]" : "sm:grid-cols-[minmax(0,1fr)_190px]"}`}>
                    <input
                      type="text"
                      value={buscaMatriculados}
                      onChange={(e) => setBuscaMatriculados(e.target.value)}
                      placeholder="Buscar por nome, WhatsApp ou horário"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500"
                    />

                    {tipoLogado === "admin" && (
                      <select
                        value={filtroProfessorMatriculados}
                        onChange={(e) => setFiltroProfessorMatriculados(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500"
                      >
                        <option value="todos">Todos os professores</option>
                        {professores.map((professor) => (
                          <option key={`matriculados-professor-${professor.id}`} value={professor.id}>
                            {professor.nome}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
                          <UserCheck className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white leading-tight">
                            {alunosMatriculadosFiltrados.length} visíveis
                          </p>
                          <p className="text-[11px] text-slate-500 leading-tight">
                            {matriculadosComFiltroAtivo ? "com filtros" : "no total"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {alunosMatriculadosFiltrados.length === 0 ? (
                  <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/50 text-slate-500 text-sm">
                    Nenhum aluno matriculado ou aguardando aceite no momento.
                  </div>
                ) : (
                  <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {alunosMatriculadosFiltrados.map((aluno) => {
                      const idade = calcularIdade(aluno.perfil.data_nascimento);
                      const totalTurmasConfirmadas = aluno.matriculasAtivas.length;
                      const totalTurmasPendentes = aluno.matriculasPendentesAceite.length;
                      const podeEditarHorarios = totalTurmasConfirmadas > 0;
                      const statusPlanoPendente =
                        aluno.matriculasAtivas.some(({ matricula }) => matricula.status === "aguardando_dados")
                          ? {
                              status: "aguardando_dados" as const,
                              label: "Aguardando dados",
                            }
                          : aluno.matriculasAtivas.some(
                                ({ matricula }) => matricula.status === "aguardando_pagamento"
                              )
                            ? {
                                status: "aguardando_pagamento" as const,
                                label: "Aguardando pagamento",
                              }
                            : aluno.matriculasAtivas.some(({ matricula }) => matricula.status === "pendente")
                              ? {
                                  status: "pendente" as const,
                                  label: "Liberação pendente",
                                }
                              : null;
                      const horariosPendentesAceite = aluno.matriculasPendentesAceite
                        .map(({ matricula }) => {
                          const turma = matricula.turmas || turmas.find((item) => item.id === matricula.turma_id);
                          return turma ? `${turma.dia_semana.substring(0, 3)} ${turma.horario.substring(0, 5)}` : null;
                        })
                        .filter((horario): horario is string => !!horario);
                      const professoresAtivos = Array.from(
                        new Set(
                          [...aluno.matriculasAtivas, ...aluno.matriculasPendentesAceite]
                            .map(({ matricula }) => {
                              const turma = matricula.turmas || turmas.find((item) => item.id === matricula.turma_id);
                              return turma ? obterNomeProfessorTurma(turma) : null;
                            })
                            .filter((professor): professor is string => !!professor)
                        )
                      ).join(", ");

                      return (
                        <motion.div
                          key={`matriculado-${aluno.perfil.id}`}
                          variants={item}
                          className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col gap-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 flex-shrink-0">
                                {aluno.perfil.nome?.charAt(0) || "?"}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-white text-sm sm:text-base leading-tight truncate">
                                  {aluno.perfil.nome || "Aluno"}
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                                  {maskPhone(aluno.perfil.whatsapp || "") || "WhatsApp não preenchido"}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {idade !== null && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md uppercase border border-slate-700 bg-slate-950 text-slate-300">
                                      {idade} anos
                                    </span>
                                  )}
                                  {totalTurmasConfirmadas > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md uppercase border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                                      {totalTurmasConfirmadas} turma(s) no plano
                                    </span>
                                  )}
                                  {totalTurmasPendentes > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md uppercase border border-amber-500/20 bg-amber-500/10 text-amber-300">
                                      {totalTurmasPendentes} aguardando aceite
                                    </span>
                                  )}
                                  {statusPlanoPendente && (
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-md uppercase border ${obterClassesStatusMatricula(statusPlanoPendente.status)}`}
                                    >
                                      {statusPlanoPendente.label}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">
                              Horários do plano
                            </p>
                            {aluno.horariosAtivos.length > 0 && (
                              <div>
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                  Confirmadas
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {aluno.horariosAtivos.map((horario) => (
                                    <span
                                      key={`matriculado-ativo-${aluno.perfil.id}-${horario}`}
                                      className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200"
                                    >
                                      {horario}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {horariosPendentesAceite.length > 0 && (
                              <div className={aluno.horariosAtivos.length > 0 ? "mt-3" : ""}>
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                                  Aguardando aceite
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {horariosPendentesAceite.map((horario) => (
                                    <span
                                      key={`matriculado-pendente-${aluno.perfil.id}-${horario}`}
                                      className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-200"
                                    >
                                      {horario}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {aluno.horariosAtivos.length === 0 && horariosPendentesAceite.length === 0 && (
                              <p className="text-sm text-slate-200">Abra o perfil para ver as turmas.</p>
                            )}
                            {professoresAtivos && (
                              <p className="text-xs text-slate-500 mt-2">
                                Professores: {professoresAtivos}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-800 pt-3">
                            {aluno.matriculasInativas.length > 0 ? (
                              <div className="text-xs text-slate-500">
                                {aluno.matriculasInativas.length} turma(s) encerrada(s) no histórico
                              </div>
                            ) : totalTurmasPendentes > 0 ? (
                              <div className="text-xs text-slate-500">
                                {totalTurmasConfirmadas > 0
                                  ? `${totalTurmasConfirmadas} confirmada(s) • ${totalTurmasPendentes} aguardando aceite`
                                  : `${totalTurmasPendentes} turma(s) aguardando aceite`}
                              </div>
                            ) : (
                              <div />
                            )}

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              {podeEditarHorarios && (
                                <button
                                  type="button"
                                  onClick={() => abrirEdicaoHorariosAluno(aluno.matriculaRepresentante)}
                                  className="flex-1 sm:flex-none justify-center px-4 py-2.5 bg-orange-500 text-slate-950 font-bold text-xs sm:text-sm rounded-xl hover:bg-orange-600 transition-colors flex items-center gap-2"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Editar horários
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => abrirDetalhesAluno(aluno.matriculaRepresentante)}
                                className="flex-1 sm:flex-none justify-center px-4 py-2.5 bg-white text-slate-950 font-bold text-xs sm:text-sm rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                Ver aluno
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </motion.div>
            )}
            {secaoAtiva === "solicitacoes" && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex flex-col gap-4 mb-6">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Solicitações de Aula</h2>
                    <p className="text-xs sm:text-sm text-slate-400">Novos alunos aguardando contato para agendar aula.</p>
                  </div>

                  <div className={`grid grid-cols-1 gap-3 ${tipoLogado === "admin" ? "lg:grid-cols-[minmax(0,1fr)_220px_220px]" : ""}`}>
                    <input
                      type="text"
                      value={buscaSolicitacoes}
                      onChange={(e) => setBuscaSolicitacoes(e.target.value)}
                      placeholder="Buscar por nome, telefone ou responsável"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500"
                    />

                    {tipoLogado === "admin" && (
                      <>
                        <select
                          value={filtroProfessorSolicitacoes}
                          onChange={(e) => setFiltroProfessorSolicitacoes(e.target.value)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500"
                        >
                          <option value="todos">Todos os responsáveis</option>
                          <option value="sem_responsavel">Sem responsável</option>
                          {professores.map((professor) => (
                            <option key={`solicitacoes-professor-${professor.id}`} value={professor.id}>
                              {professor.nome}
                            </option>
                          ))}
                        </select>

                        <select
                          value={filtroStatusSolicitacoesAdmin}
                          onChange={(e) => setFiltroStatusSolicitacoesAdmin(e.target.value as FiltroStatusSolicitacoesAdmin)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500"
                        >
                          <option value="todos">Todos os status</option>
                          <option value="sem_responsavel">Sem responsável</option>
                          <option value="com_responsavel">Com responsável</option>
                          <option value="aguardando_aceite">Aguardando aceite</option>
                        </select>
                      </>
                    )}
                  </div>

                  {(totalSolicitacoesSemResponsavel > 0 ||
                    totalSolicitacoesAguardandoAceite > 0 ||
                    filtroAtencaoSolicitacoes) && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        Precisa de atenção
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          {
                            id: "sem_responsavel" as const,
                            label: "Sem responsável",
                            total: totalSolicitacoesSemResponsavel,
                          },
                          {
                            id: "aguardando_aceite" as const,
                            label: tipoLogado === "professor" ? "Seu aceite" : "Aguardando aceite",
                            total: totalSolicitacoesAguardandoAceite,
                          },
                        ]
                          .filter((alerta) => alerta.total > 0 || filtroAtencaoSolicitacoes === alerta.id)
                          .map((alerta) => (
                            <button
                              key={`alerta-solicitacoes-${alerta.id}`}
                              type="button"
                              onClick={() =>
                                setFiltroAtencaoSolicitacoes((atual) => (atual === alerta.id ? null : alerta.id))
                              }
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition-colors ${
                                filtroAtencaoSolicitacoes === alerta.id
                                  ? "border-orange-500 bg-orange-500 text-slate-950"
                                  : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white"
                              }`}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {alerta.label}
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] ${
                                  filtroAtencaoSolicitacoes === alerta.id
                                    ? "bg-slate-950/10"
                                    : "bg-slate-950 text-slate-400"
                                }`}
                              >
                                {alerta.total}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {solicitacoesFiltradas.length === 0 ? (
                  <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/50 text-slate-500 text-sm">
                    {filtroAtencaoSolicitacoes
                      ? "Nenhuma solicitação encontrada neste alerta."
                      : "Nenhuma solicitacao ativa no momento."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {solicitacoesFiltradas.map((solicitacao) => {
                      const cardAguardandoMeuAceite =
                        solicitacao.status === "aguardando_aceite_professor" &&
                        solicitacao.professor_responsavel_id === usuarioLogadoId;
                      const cardAbertaParaAssumir =
                        tipoLogado === "professor" &&
                        !solicitacao.professor_responsavel_id &&
                        solicitacao.status !== "aguardando_aceite_professor" &&
                        (!solicitacao.professor_preferido_id || solicitacao.professor_preferido_id === usuarioLogadoId);
                      const cardAguardandoResultado =
                        solicitacao.status === "agendado" && dataJaChegou(solicitacao.data_aula_experimental);
                      const cardProntoParaMatricula =
                        solicitacao.status === "aprovada_para_matricula";
                      const labelBotaoVisualizar = cardAguardandoResultado
                        ? "Registrar Resultado"
                        : cardProntoParaMatricula
                          ? "Montar Treino"
                          : "Visualizar";

                      return (
                        <div key={solicitacao.id} className="bg-slate-900 border border-slate-700 p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-1 gap-3">
                              <h3 className="font-bold text-base sm:text-lg text-white truncate pr-2">{solicitacao.nome_aluno}</h3>
                              <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] uppercase font-bold px-2 py-1 rounded whitespace-nowrap flex-shrink-0">
                                {solicitacao.nivel_experiencia || 'NÍVEL NÃO INFO.'}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400 mb-3">{maskPhone(solicitacao.telefone_aluno)}</p>

                            <div className="flex flex-wrap gap-2 mb-3">
                              <span className="text-[10px] uppercase font-bold px-2 py-1 rounded border border-slate-700 bg-slate-950 text-slate-300">
                                {obterLabelStatusSolicitacao(solicitacao)}
                              </span>
                              {solicitacaoTemProfessorEscolhido(solicitacao) &&
                                solicitacao.professor_responsavel_id === solicitacao.professor_preferido_id && (
                                <span className="text-[10px] uppercase font-bold px-2 py-1 rounded border border-orange-500/20 bg-orange-500/10 text-orange-300">
                                  Professor fixo
                                </span>
                                )}
                            </div>
                            
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-3">
                              <p className="text-xs text-slate-500 mb-1 uppercase font-bold tracking-wider">Preferência de Horário</p>
                              <p className="text-sm text-slate-300 italic">{solicitacao.horarios_preferencia}</p>
                            </div>

                            <div className="space-y-1.5 text-xs text-slate-500">
                              {cardAguardandoMeuAceite ? (
                                <p>
                                  Situação: <span className="text-slate-300">Aguardando seu aceite</span>
                                </p>
                              ) : (
                                <p>
                                  {solicitacaoTemProfessorEscolhido(solicitacao) ? "Professor pedido: " : "Responsável atual: "}
                                  <span className="text-slate-300">
                                    {solicitacaoTemProfessorEscolhido(solicitacao)
                                      ? obterNomeProfessorEscolhido(solicitacao)
                                      : solicitacao.status === "aguardando_aceite_professor" && solicitacao.professor_responsavel_id
                                        ? `Aguardando aceite de ${obterNomeProfessorResponsavel(solicitacao)}`
                                        : obterNomeProfessorResponsavel(solicitacao)}
                                  </span>
                                </p>
                              )}
                              {solicitacao.data_aula_experimental && (
                                <p>
                                  Experimental:{" "}
                                  <span className="text-slate-300">
                                    {formatarDataCurta(solicitacao.data_aula_experimental)}
                                  </span>
                                </p>
                              )}
                              {cardAguardandoMeuAceite && solicitacao.professor_origem_transferencia_id && (
                                <p>
                                  Enviado por:{" "}
                                  <span className="text-slate-300">
                                    {solicitacao.professor_origem_transferencia?.nome ||
                                      buscarNomeProfessorPorId(solicitacao.professor_origem_transferencia_id)}
                                  </span>
                                </p>
                              )}
                              {solicitacao.ultima_recusa_repasse_por_id && !cardAguardandoMeuAceite && (
                                <p>
                                  Último retorno:{" "}
                                  <span className="text-slate-300">
                                    recusado por{" "}
                                    {solicitacao.ultima_recusa_repasse_por?.nome ||
                                      buscarNomeProfessorPorId(solicitacao.ultima_recusa_repasse_por_id)}
                                  </span>
                                </p>
                              )}
                            </div>
                            {solicitacao.ultima_recusa_repasse_observacao && !cardAguardandoMeuAceite && (
                              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                                <p className="text-[10px] uppercase font-bold tracking-wider text-red-300 mb-1">Observação da Recusa</p>
                                <p className="text-xs text-slate-200">{solicitacao.ultima_recusa_repasse_observacao}</p>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                            {cardAguardandoMeuAceite ? (
                              <button
                                onClick={() => abrirModalSolicitacao(solicitacao)}
                                className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-700 sm:col-span-2 font-bold py-3 rounded-xl transition-colors shadow-lg shadow-slate-900/20 border border-slate-700 hover:border-slate-600"
                              >
                                <Eye className="w-5 h-5" />
                                Visualizar Repasse
                              </button>
                            ) : (
                              <>
                                {cardAbertaParaAssumir && (
                                  <button
                                    type="button"
                                    onClick={() => assumirSolicitacao(solicitacao)}
                                    className="w-full flex items-center justify-center gap-2 bg-white text-slate-950 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                                  >
                                    <UserCheck className="w-4 h-4" />
                                    Iniciar
                                  </button>
                                )}
                                <button
                                  onClick={() => abrirModalSolicitacao(solicitacao)}
                                  className={`w-full flex items-center justify-center gap-2 ${cardAbertaParaAssumir ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-slate-800 text-white hover:bg-slate-700 sm:col-span-2"} font-bold py-3 rounded-xl transition-colors shadow-lg shadow-slate-900/20 border border-slate-700 hover:border-slate-600`}
                                >
                                  <Eye className="w-5 h-5" />
                                  {labelBotaoVisualizar}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
            {secaoAtiva === "turmas" && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Turmas (Aulas)</h2>
                    <p className="text-xs sm:text-sm text-slate-400">Grade fixa do professor.</p>
                  </div>
                  <button onClick={() => abrirModal("turma")} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-slate-950 px-4 py-3 sm:py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"><Plus className="w-4 h-4" /> Nova Turma</button>
                </div>
                <div className="mb-5 space-y-3">
                  <div className={`grid grid-cols-1 gap-3 ${tipoLogado === "admin" ? "lg:grid-cols-[minmax(0,1fr)_220px_220px]" : "sm:grid-cols-[minmax(0,1fr)_220px]"}`}>
                    <input
                      type="text"
                      value={buscaTurmas}
                      onChange={(e) => setBuscaTurmas(e.target.value)}
                      placeholder="Buscar por dia, horário, nível ou professor"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500"
                    />

                    <select
                      value={filtroNivelTurmas}
                      onChange={(e) => setFiltroNivelTurmas(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500"
                    >
                      <option value="todos">Todos os níveis</option>
                      <option value="Iniciante">Iniciante</option>
                      <option value="Intermediário">Intermediário</option>
                      <option value="Avançado">Avançado</option>
                      <option value="Pró">Pró</option>
                    </select>

                    {tipoLogado === "admin" && professores.length > 0 && (
                      <select
                        value={professorFiltroTurmas}
                        onChange={(e) => {
                          setProfessorFiltroTurmas(e.target.value);
                        }}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500"
                      >
                        <option value="todos">Todos os professores</option>
                        {professores.map((professor) => (
                          <option key={`filtro-professor-${professor.id}`} value={professor.id}>
                            {professor.nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs sm:text-sm text-slate-400">
                      {turmasFiltradasPainel.length} turma(s) no total
                    </p>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {diasComTurmaNoPainel.map((dia) => {
                      const ativo = diaFiltroTurmas === dia;
                      const totalNoDia = turmasFiltradasPainel.filter(
                        (turma) => turma.dia_semana === dia
                      ).length;

                      return (
                        <button
                          key={`filtro-dia-${dia}`}
                          type="button"
                          onClick={() => setDiaFiltroTurmas(dia)}
                          className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-bold transition-colors ${
                            ativo
                              ? "border-orange-500 bg-orange-500 text-slate-950"
                              : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
                          }`}
                        >
                          <span>{dia.substring(0, 3)}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${ativo ? "bg-slate-950 text-white" : "bg-slate-800 text-slate-300"}`}>
                            {totalNoDia}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {turmasVisiveisNoPainel.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800/50 bg-slate-900/30 px-4 py-16 text-center text-sm text-slate-500">
                    Nenhuma turma encontrada para esse filtro.
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {turmasVisiveisNoPainel.map(turma => (
                    <div key={`turma-${turma.id}`} className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:justify-between sm:items-start group gap-4">
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-base sm:text-lg">{turma.dia_semana}</span>
                          <span className="text-orange-500 font-bold text-base sm:text-lg">{turma.horario.substring(0,5)}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 mb-4">{turma.nivel} • {obterNomeProfessorTurma(turma)}</p>
                        
                        {/* --- NOVA SEÇÃO: AVATARES E LOTAÇÃO --- */}
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {obterMatriculasVisiveisTurma(turma).length > 0 ? (
                              obterMatriculasVisiveisTurma(turma).map((matricula: Matricula) => {
                                const nomeCompleto = matricula.perfis?.nome || "Aluno";
                                const primeiroNome = nomeCompleto.split(" ")[0];
                                const inicial = primeiroNome.charAt(0).toUpperCase();
                                const isExperimental = matricula.status === 'experimental';
                                
                                return (
                                  <button 
                                    key={`painel-turma-${turma.id}-matricula-${matricula.id}`} 
                                    type="button"
                                    onClick={() => abrirDetalhesAluno(matricula)}
                                    title={`${nomeCompleto} (${isExperimental ? 'Aula Experimental' : 'Matriculado'})`}
                                    className={`relative flex items-center justify-center shrink-0 h-8 w-8 rounded-full ring-2 ring-slate-900 text-xs font-bold cursor-pointer transition-transform hover:scale-110 hover:z-10 ${
                                      isExperimental 
                                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }`}
                                  >
                                    <span className="leading-none mt-[1px]">{inicial}</span>
                                  </button>
                                );
                              })
                            ) : (
                              <span className="text-xs text-slate-500 font-medium bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800">
                                Sem alunos
                              </span>
                            )}
                          </div>
                          
                          {/* Contador de Lotação */}
                          <span className="text-xs font-medium px-2 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-400 flex items-center gap-1">
                            <span className={contarOcupacaoTurma(turma) >= turma.vagas_totais ? "text-orange-500 font-bold" : "text-emerald-400 font-bold"}>
                              {contarOcupacaoTurma(turma)}
                            </span> 
                            / {turma.vagas_totais} vagas
                          </span>
                        </div>
                        {/* --------------------------------------- */}

                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto border-t border-slate-800 pt-3 sm:border-t-0 sm:pt-0 sm:opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={() => abrirModalEdicao(turma)} className="flex-1 sm:flex-none flex justify-center p-2.5 text-slate-400 bg-slate-800 sm:bg-transparent hover:text-white hover:bg-slate-800 rounded-xl transition-all"><Edit2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                        <button onClick={() => excluirItem(turma.id, 'turmas')} className="flex-1 sm:flex-none flex justify-center p-2.5 text-slate-400 bg-slate-800 sm:bg-transparent hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </motion.div>
            )}

            {secaoAtiva === "aluguel" && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Aluguel de Quadra</h2>
                    <p className="text-xs sm:text-sm text-slate-400">Horários para locação.</p>
                  </div>
                  <button onClick={() => abrirModal("quadra")} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 text-white px-4 py-3 sm:py-2.5 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"><Clock className="w-4 h-4 text-orange-500" /> Novo Horário</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {horariosQuadra.map(hq => (
                    <div key={`quadra-${hq.id}`} className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:justify-between sm:items-center group gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1"><span className="font-bold text-white text-base sm:text-lg">{hq.dia_semana}</span><span className="text-orange-500 font-bold text-base sm:text-lg">{hq.horario_inicio.substring(0,5)} às {hq.horario_fim.substring(0,5)}</span></div>
                        <p className="text-xs sm:text-sm text-emerald-400 font-bold">{hq.preco}</p>
                      </div>
                      <div className="flex justify-end w-full sm:w-auto border-t border-slate-800 pt-3 sm:border-t-0 sm:pt-0 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => excluirItem(hq.id, 'horarios_quadra')} className="w-full sm:w-auto flex justify-center p-2.5 text-slate-400 bg-slate-800 sm:bg-transparent hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            {secaoAtiva === "professores" && tipoLogado === "admin" && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Corpo Docente</h2>
                    <p className="text-xs sm:text-sm text-slate-400">Gerencie os professores da arena.</p>
                  </div>
                  <button onClick={() => { setTipoModal("professor"); setModalAberto(true); }} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-slate-950 px-4 py-3 sm:py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
                    <UserPlus className="w-4 h-4" /> Novo Professor
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {professores.map(prof => (
                    <div key={`prof-${prof.id}`} className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex items-center justify-between group gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 flex-shrink-0">{prof.nome.charAt(0)}</div>
                        <div>
                          <h3 className="font-bold text-white text-base leading-tight">{prof.nome}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{prof.email}</p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Botão de Editar */}
                        <button 
                          onClick={() => abrirModalEdicaoProfessor(prof)} 
                          title="Editar Professor" 
                          className="p-2.5 text-slate-400 bg-slate-800 hover:text-white rounded-xl transition-all"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        
                        {/* Botão de Excluir */}
                        <button 
                          onClick={() => {
                            setModalConfirmacao({
                              aberto: true,
                              titulo: "Excluir Professor",
                              mensagem: "Deseja EXCLUIR DEFINITIVAMENTE este professor? O acesso dele será permanentemente revogado e ele perderá o vínculo com as turmas.",
                              acao: async () => {
                                setModalConfirmacao(prev => ({ ...prev, aberto: false }));
                                setCarregando(true);
                                try {
                                  await excluirProfessor(prof.id); 
                                  await buscarDados();
                                  setModalSucesso({ aberto: true, titulo: "Professor Removido", mensagem: "O acesso deste professor foi revogado com sucesso." });
                                } catch (error) {
                                  // Verificação segura de tipo sem usar 'any'
                                  const mensagemErro = error instanceof Error ? error.message : "Erro ao excluir professor.";
                                  setErroModal(mensagemErro);
                                } finally {
                                  setCarregando(false);
                                }
                              }
                            });
                          }} 
                          title="Excluir Professor Definitivamente" 
                          className="p-2.5 text-slate-400 bg-slate-800 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}

        <div className="h-24 sm:hidden" aria-hidden="true" />
        <nav className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 shadow-[0_-12px_30px_rgba(2,6,23,0.55)] backdrop-blur">
          <div className={`grid ${classesGridMobileNavegacao} gap-1`}>
            {navegacaoAdmin.map((item) => {
              const Icone = item.icon;
              const ativo = secaoAtiva === item.id;

              return (
                <Link
                  key={`bottom-${item.id}`}
                  href={item.href}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold transition-colors ${
                    ativo ? "bg-orange-500 text-slate-950" : "text-slate-400"
                  }`}
                >
                  <div className="relative">
                    <Icone className="h-4 w-4" />
                    {item.badge ? (
                      <span className="absolute -right-2 -top-2 rounded-full bg-white px-1 text-[9px] leading-4 text-slate-950 min-w-4 text-center">
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <AnimatePresence>
          {modalConfirmacao.aberto && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
               {/* Fundo escuro */}
               <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                onClick={() => setModalConfirmacao({ ...modalConfirmacao, aberto: false })}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
              />

              {/* Caixa do Modal */}
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.95, opacity: 0 }} 
                className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-2xl w-full max-w-sm text-center relative z-10"
              >
                <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                
                <h2 className="text-xl font-bold text-white mb-2">{modalConfirmacao.titulo}</h2>
                <p className="text-sm text-slate-400 mb-8 leading-relaxed">{modalConfirmacao.mensagem}</p>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setModalConfirmacao({ ...modalConfirmacao, aberto: false })} 
                    className="flex-1 py-3.5 bg-slate-800 text-white font-bold text-sm rounded-xl hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={modalConfirmacao.acao} 
                    className="flex-1 py-3.5 bg-red-600 text-white font-bold text-sm rounded-xl hover:bg-red-700 transition-colors"
                  >
                    Sim, Remover
                  </button>
                </div>
              </motion.div>
            </div>
          )}
          {modalSucesso.aberto && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                onClick={() => setModalSucesso({ ...modalSucesso, aberto: false })}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} 
                className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-2xl w-full max-w-sm text-center relative z-10"
              >
                <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">{modalSucesso.titulo}</h2>
                <p className="text-sm text-slate-400 mb-8 leading-relaxed">{modalSucesso.mensagem}</p>
                <button 
                  onClick={() => setModalSucesso({ ...modalSucesso, aberto: false })} 
                  className="w-full py-3.5 bg-emerald-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-emerald-600 transition-colors"
                >
                  Continuar
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
