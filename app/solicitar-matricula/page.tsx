"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Loader2,
  Save,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import {
  buscarContextoSolicitacoesAluno,
  buscarProfessoresEHorariosSolicitacao,
  HorarioSolicitacaoDisponivel,
  ProfessorSolicitacao,
} from "@/services/solicitacaoAlunoService";
import { Perfil } from "@/types";

const ORDEM_DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const maskPhone = (value: string) => {
  if (!value) return "";

  return value
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(-\d{4})\d+?$/, "$1");
};

const normalizarTelefone = (value: string) => value.replace(/\D/g, "");

const mensagemTipoSolicitacaoIndisponivel =
  "O banco ainda não foi atualizado para receber solicitações de matrícula.";

export default function SolicitarMatriculaPage() {
  const router = useRouter();
  const [perfilAluno, setPerfilAluno] = useState<Perfil | null>(null);
  const [professores, setProfessores] = useState<ProfessorSolicitacao[]>([]);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<HorarioSolicitacaoDisponivel[]>([]);
  const [horariosSelecionados, setHorariosSelecionados] = useState<string[]>([]);
  const [modoHorario, setModoHorario] = useState<"combinar" | "especificar" | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [possuiRestricao, setPossuiRestricao] = useState<boolean | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [erroCampoId, setErroCampoId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: "",
    whatsapp: "",
    data_nascimento: "",
    professor_id: "",
    sexo: "",
    necessidade_especial: "",
    nivel_experiencia: "",
    objetivo: "",
  });

  useEffect(() => {
    if (!mensagemErro) return;

    const animationFrame = window.requestAnimationFrame(() => {
      const alvo =
        (erroCampoId ? document.getElementById(erroCampoId) : null) ||
        document.getElementById("aviso-erro-formulario") ||
        document.getElementById("aviso-erro-rodape");

      if (!alvo) return;

      alvo.scrollIntoView({ behavior: "smooth", block: "center" });

      if (
        alvo instanceof HTMLInputElement ||
        alvo instanceof HTMLSelectElement ||
        alvo instanceof HTMLTextAreaElement
      ) {
        alvo.focus();
      }
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [mensagemErro, erroCampoId]);

  useEffect(() => {
    async function carregarDados() {
      try {
        const contexto = await buscarContextoSolicitacoesAluno();

        if (!contexto.logado) {
          router.replace("/entrar");
          return;
        }

        if (!contexto.perfil || contexto.perfil.tipo !== "aluno") {
          router.replace("/");
          return;
        }

        if (!contexto.podeSolicitarMatricula) {
          router.replace("/agenda");
          return;
        }

        setPerfilAluno(contexto.perfil);
        setFormData({
          nome: contexto.perfil.nome || "",
          whatsapp: maskPhone(contexto.perfil.whatsapp || ""),
          data_nascimento: contexto.perfil.data_nascimento || "",
          professor_id: "",
          sexo: contexto.perfil.sexo || "",
          necessidade_especial: contexto.perfil.necessidade_especial || "",
          nivel_experiencia: contexto.perfil.nivel || "",
          objetivo: contexto.perfil.objetivo || "",
        });
        setPossuiRestricao(
          contexto.perfil.necessidade_especial ? true : null
        );

        const dadosSolicitacao = await buscarProfessoresEHorariosSolicitacao();
        setProfessores(dadosSolicitacao.professores);
        setHorariosDisponiveis(dadosSolicitacao.horariosDisponiveis);
      } catch (error) {
        setMensagemErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os dados da matrícula agora."
        );
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, [router]);

  const criarErroFormulario = (mensagem: string, campoId?: string) => {
    const erro = new Error(mensagem) as Error & { campoId?: string };
    erro.campoId = campoId;
    return erro;
  };

  const atualizarCampo = (campo: keyof typeof formData, valor: string) => {
    setMensagemErro(null);
    setErroCampoId(null);
    setFormData((atual) => ({ ...atual, [campo]: valor }));
  };

  const selecionarProfessor = (professorId: string) => {
    setMensagemErro(null);
    setErroCampoId(null);

    if (formData.professor_id !== professorId) {
      setHorariosSelecionados([]);
    }

    setFormData((atual) => ({ ...atual, professor_id: professorId }));
  };

  const selecionarModoHorario = (novoModo: "combinar" | "especificar") => {
    setMensagemErro(null);
    setErroCampoId(null);

    if (modoHorario !== novoModo) {
      setHorariosSelecionados([]);
    }

    setModoHorario(novoModo);
  };

  const toggleHorario = (chave: string) => {
    setMensagemErro(null);
    setErroCampoId(null);
    setHorariosSelecionados((atual) =>
      atual.includes(chave) ? atual.filter((item) => item !== chave) : [...atual, chave]
    );
  };

  const horariosDisponiveisFiltrados = horariosDisponiveis.filter(
    (horario) => !formData.professor_id || horario.professor_id === formData.professor_id
  );

  const horariosApresentados = Array.from(
    new Map(
      horariosDisponiveisFiltrados.map((horario) => [
        formData.professor_id ? horario.chave : `${horario.dia_semana}|${horario.horario}`,
        {
          ...horario,
          chave: formData.professor_id ? horario.chave : `${horario.dia_semana}|${horario.horario}`,
        },
      ])
    ).values()
  ).sort((a, b) => {
    const indiceDiaA = ORDEM_DIAS_SEMANA.indexOf(a.dia_semana);
    const indiceDiaB = ORDEM_DIAS_SEMANA.indexOf(b.dia_semana);

    if (indiceDiaA !== indiceDiaB) {
      return indiceDiaA - indiceDiaB;
    }

    return a.horario.localeCompare(b.horario);
  });

  const horariosPorDia = ORDEM_DIAS_SEMANA.map((dia) => ({
    dia,
    horarios: horariosApresentados.filter((horario) => horario.dia_semana === dia),
  })).filter((grupo) => grupo.horarios.length > 0);

  const horariosPreferenciaFormatados = horariosApresentados
    .filter((horario) => horariosSelecionados.includes(horario.chave))
    .map((horario) => `${horario.dia_semana} às ${horario.horario}`)
    .join("\n");

  const salvarSolicitacaoMatricula = async ({
    perfilId,
    nomeAluno,
    telefoneAluno,
    horariosPreferencia,
    professorPreferidoId,
    nivelExperiencia,
  }: {
    perfilId: string;
    nomeAluno: string;
    telefoneAluno: string;
    horariosPreferencia: string;
    professorPreferidoId: string | null;
    nivelExperiencia: string;
  }) => {
    const payload = {
      tipo_solicitacao: "matricula",
      perfil_id: perfilId,
      nome_aluno: nomeAluno,
      telefone_aluno: telefoneAluno,
      horarios_preferencia: horariosPreferencia,
      professor_preferido_id: professorPreferidoId,
      professor_responsavel_id: professorPreferidoId,
      status: "pendente",
      nivel_experiencia: nivelExperiencia,
    };

    let { error } = await supabase.from("solicitacoes_aula_experimental").insert([payload]);

    if (error?.message?.toLowerCase().includes("tipo_solicitacao")) {
      throw new Error(mensagemTipoSolicitacaoIndisponivel);
    }

    if (error?.message?.toLowerCase().includes("perfil_id")) {
      const retry = await supabase
        .from("solicitacoes_aula_experimental")
        .insert([
          {
            tipo_solicitacao: "matricula",
            nome_aluno: nomeAluno,
            telefone_aluno: telefoneAluno,
            horarios_preferencia: horariosPreferencia,
            professor_preferido_id: professorPreferidoId,
            professor_responsavel_id: professorPreferidoId,
            status: "pendente",
            nivel_experiencia: nivelExperiencia,
          },
        ]);

      error = retry.error;
    }

    if (error) {
      throw new Error("Não foi possível registrar a solicitação de matrícula agora.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setMensagemErro(null);
    setEnviando(true);

    try {
      if (!perfilAluno?.id) {
        throw new Error("Seu perfil não foi carregado corretamente. Faça login novamente.");
      }

      if (!formData.nome.trim()) {
        throw criarErroFormulario("Preencha o nome completo.", "campo-nome");
      }

      if (!formData.whatsapp.trim()) {
        throw criarErroFormulario("Preencha o WhatsApp.", "campo-whatsapp");
      }

      if (!formData.data_nascimento) {
        throw criarErroFormulario("Informe a data de nascimento.", "campo-data-nascimento");
      }

      if (!formData.sexo) {
        throw criarErroFormulario("Selecione o sexo.", "campo-sexo");
      }

      if (!formData.nivel_experiencia) {
        throw criarErroFormulario("Selecione o seu nível atual.", "campo-nivel");
      }

      if (!formData.objetivo.trim()) {
        throw criarErroFormulario("Conte o que você busca agora no treino.", "campo-objetivo");
      }

      if (possuiRestricao === null) {
        throw criarErroFormulario(
          "Informe se você possui alguma restrição ou necessidade especial.",
          "campo-restricao"
        );
      }

      if (possuiRestricao && !formData.necessidade_especial.trim()) {
        throw criarErroFormulario(
          "Descreva a restrição ou necessidade especial para continuar.",
          "campo-necessidade-especial"
        );
      }

      if (!modoHorario) {
        throw criarErroFormulario(
          "Escolha se os horários serão a combinar ou informados agora.",
          "campo-horarios"
        );
      }

      if (modoHorario === "especificar" && horariosSelecionados.length === 0) {
        throw criarErroFormulario(
          "Selecione pelo menos um dia e horário disponível para o retorno.",
          "campo-horarios"
        );
      }

      const horariosPreferenciaFinal =
        modoHorario === "combinar" ? "A combinar" : horariosPreferenciaFormatados;
      const whatsappLimpo = normalizarTelefone(formData.whatsapp);

      const { error: atualizarPerfilError } = await supabase
        .from("perfis")
        .update({
          nome: formData.nome.trim(),
          whatsapp: whatsappLimpo,
          nivel: formData.nivel_experiencia,
          data_nascimento: formData.data_nascimento,
          sexo: formData.sexo,
          necessidade_especial: possuiRestricao ? formData.necessidade_especial.trim() : "",
          objetivo: formData.objetivo.trim(),
        })
        .eq("id", perfilAluno.id);

      if (atualizarPerfilError) {
        throw new Error("Não foi possível atualizar seus dados antes de enviar a solicitação.");
      }

      await salvarSolicitacaoMatricula({
        perfilId: perfilAluno.id,
        nomeAluno: formData.nome.trim(),
        telefoneAluno: whatsappLimpo,
        horariosPreferencia: horariosPreferenciaFinal,
        professorPreferidoId: formData.professor_id || null,
        nivelExperiencia: formData.nivel_experiencia,
      });

      setSucesso(true);
    } catch (error) {
      const erroTratado = error as Error & { campoId?: string };
      setErroCampoId(erroTratado.campoId || null);
      setMensagemErro(
        error instanceof Error ? error.message : "Não foi possível enviar a solicitação agora."
      );
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-900 p-8 rounded-3xl border border-slate-800 max-w-md w-full shadow-2xl"
        >
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Solicitação enviada!</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Recebemos o seu pedido de matrícula. Um professor vai continuar esse atendimento com você pelo WhatsApp.
          </p>
          <Link href="/agenda">
            <button className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-full hover:bg-slate-700 transition-colors">
              Voltar para minha agenda
            </button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center py-12 px-6">
      <div className="w-full max-w-xl">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>Voltar</span>
        </button>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-slate-900 p-8 sm:p-10 rounded-[2rem] border border-slate-800 shadow-2xl"
        >
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">
              Solicitar <span className="text-orange-400">Matrícula</span>
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Atualize o que mudou e informe as preferências para a equipe montar o seu retorno.
            </p>
          </div>

          {mensagemErro && (
            <motion.div
              id="aviso-erro-formulario"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-2xl border border-rose-500/25 bg-rose-500/8 px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-rose-500/10 p-2 text-rose-300">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-rose-100">Confira os dados do formulário</p>
                  <p className="mt-1 text-sm leading-relaxed text-rose-100/85">{mensagemErro}</p>
                </div>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nome Completo <span className="text-orange-400">*</span>
                </label>
                <input
                  id="campo-nome"
                  type="text"
                  placeholder="Ex: João Silva"
                  value={formData.nome}
                  onChange={(e) => atualizarCampo("nome", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  WhatsApp <span className="text-orange-400">*</span>
                </label>
                <input
                  id="campo-whatsapp"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={formData.whatsapp}
                  onChange={(e) => atualizarCampo("whatsapp", maskPhone(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Data de Nascimento <span className="text-orange-400">*</span>
              </label>
              <input
                id="campo-data-nascimento"
                type="date"
                max={new Date().toISOString().split("T")[0]}
                value={formData.data_nascimento}
                onChange={(e) => atualizarCampo("data_nascimento", e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all [color-scheme:dark]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Sexo <span className="text-orange-400">*</span>
                </label>
                <div className="relative">
                  <select
                    id="campo-sexo"
                    value={formData.sexo}
                    onChange={(e) => atualizarCampo("sexo", e.target.value)}
                    className="w-full appearance-none bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-11 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                  >
                    <option value="">Selecione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outros">Outros</option>
                    <option value="Prefiro não informar">Prefiro não informar</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nível atual <span className="text-orange-400">*</span>
                </label>
                <div className="relative">
                  <select
                    id="campo-nivel"
                    value={formData.nivel_experiencia}
                    onChange={(e) => atualizarCampo("nivel_experiencia", e.target.value)}
                    className="w-full appearance-none bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-11 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                  >
                    <option value="">Selecione o seu nível...</option>
                    <option value="Aprendiz">Aprendiz</option>
                    <option value="Iniciante">Iniciante</option>
                    <option value="Intermediário">Intermediário</option>
                    <option value="Avançado">Avançado</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                O que você busca agora no treino? <span className="text-orange-400">*</span>
              </label>
              <textarea
                id="campo-objetivo"
                placeholder="Ex: voltar ao ritmo, melhorar condicionamento, retomar os fundamentos..."
                value={formData.objetivo}
                onChange={(e) => atualizarCampo("objetivo", e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all resize-none h-20"
              />
            </div>

            <div id="campo-restricao">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Possui alguma restrição médica, física ou necessidade especial? <span className="text-orange-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMensagemErro(null);
                    setPossuiRestricao(false);

                    if (formData.necessidade_especial) {
                      setFormData((atual) => ({ ...atual, necessidade_especial: "" }));
                    }
                  }}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                    possuiRestricao === false
                      ? "border-orange-500 bg-orange-500/10 text-white"
                      : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  Não
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMensagemErro(null);
                    setPossuiRestricao(true);
                  }}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                    possuiRestricao === true
                      ? "border-orange-500 bg-orange-500/10 text-white"
                      : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  Sim
                </button>
              </div>

              {possuiRestricao === true && (
                <input
                  id="campo-necessidade-especial"
                  type="text"
                  placeholder="Descreva a restrição ou necessidade especial"
                  value={formData.necessidade_especial}
                  onChange={(e) => atualizarCampo("necessidade_especial", e.target.value)}
                  className="mt-3 w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Quer ser atendido por um professor específico?
              </label>
              <div className="relative">
                <select
                  value={formData.professor_id}
                  onChange={(e) => selecionarProfessor(e.target.value)}
                  className="w-full appearance-none bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-11 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                >
                  <option value="">Qualquer professor</option>
                  {professores.map((professor) => (
                    <option key={professor.id} value={professor.id}>
                      {professor.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Se escolher um professor, os horários mostrados abaixo serão apenas os dele. Se deixar qualquer professor, você verá todos os horários disponíveis.
              </p>
            </div>

            <div id="campo-horarios">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Dias e Horários de Preferência <span className="text-orange-400">*</span>
                </label>
                {modoHorario === "especificar" && (
                  <span className="text-xs text-slate-500">
                    {horariosSelecionados.length} selecionado(s)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => selecionarModoHorario("combinar")}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    modoHorario === "combinar"
                      ? "border-orange-500 bg-orange-500/10 text-white"
                      : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <p className="text-sm font-bold">A combinar</p>
                  <p className="mt-1 text-xs text-slate-500">
                    O professor alinha os melhores horários com você depois.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => selecionarModoHorario("especificar")}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    modoHorario === "especificar"
                      ? "border-orange-500 bg-orange-500/10 text-white"
                      : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <p className="text-sm font-bold">Informar horários</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Escolha os dias e horários em que você consegue treinar.
                  </p>
                </button>
              </div>

              {modoHorario === "especificar" ? (
                <>
                  <p className="text-xs text-slate-500 mb-3">
                    Selecione quantos horários quiser. Só aparecem horários que já têm alguma turma disponível.
                  </p>

                  {horariosPorDia.length === 0 ? (
                    <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-sm text-slate-500">
                      {formData.professor_id
                        ? "Não encontramos horários de turma disponíveis para este professor no momento."
                        : "Não encontramos horários de turma disponíveis no momento."}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {horariosPorDia.map((grupo) => (
                        <div key={grupo.dia} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">
                            {grupo.dia}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {grupo.horarios.map((horario) => {
                              const selecionado = horariosSelecionados.includes(horario.chave);

                              return (
                                <button
                                  key={horario.chave}
                                  type="button"
                                  onClick={() => toggleHorario(horario.chave)}
                                  className={`rounded-full border px-4 py-2 text-sm font-bold transition-all ${
                                    selecionado
                                      ? "border-orange-500 bg-orange-500 text-slate-950"
                                      : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white"
                                  }`}
                                >
                                  {horario.horario}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {horariosSelecionados.length > 0 && (
                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">
                        Horários escolhidos
                      </p>
                      <p className="whitespace-pre-line text-sm text-slate-300">
                        {horariosPreferenciaFormatados}
                      </p>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {mensagemErro && (
              <div
                id="aviso-erro-rodape"
                className="rounded-2xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-100"
              >
                {mensagemErro}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold py-4 rounded-xl shadow-lg hover:shadow-orange-500/25 transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> A processar...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" /> Solicitar Matrícula
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
