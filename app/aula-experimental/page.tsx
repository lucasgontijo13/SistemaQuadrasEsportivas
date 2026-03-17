"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Send, Loader2, CheckCircle2, Eye, EyeOff, ChevronDown, AlertCircle } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Professor {
  id: string;
  nome: string;
}

interface HorarioDisponivel {
  chave: string;
  dia_semana: string;
  horario: string;
  professor_id: string | null;
}

const ORDEM_DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const STATUS_SOLICITACOES_EM_ANDAMENTO = [
  "pendente",
  "aguardando_aceite_professor",
  "agendado",
  "faltou",
  "aprovada_para_matricula",
  "matricula_em_andamento",
];

const STATUS_MATRICULAS_BLOQUEANTES = [
  "experimental",
  "ativo",
  "aguardando_dados",
  "aguardando_pagamento",
];

const maskPhone = (value: string) => {
  if (!value) return "";
  return value
    .replace(/\D/g, "") // Tira tudo que não é número
    .replace(/(\d{2})(\d)/, "($1) $2") // Coloca o parênteses DDD
    .replace(/(\d{5})(\d)/, "$1-$2") // Coloca o hífen depois do 5º dígito
    .replace(/(-\d{4})\d+?$/, "$1"); // Impede de digitar mais que 15 caracteres
};

const gerarVariacoesTelefone = (telefone: string) => {
  const telefoneLimpo = telefone.replace(/\D/g, "");
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

export default function AulaExperimentalPage() {
  const router = useRouter();
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<HorarioDisponivel[]>([]);
  const [horariosSelecionados, setHorariosSelecionados] = useState<string[]>([]);
  const [modoHorario, setModoHorario] = useState<"combinar" | "especificar" | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [possuiRestricao, setPossuiRestricao] = useState<boolean | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [erroCampoId, setErroCampoId] = useState<string | null>(null);
  
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  // ESTADO ATUALIZADO COM OS NOVOS CAMPOS
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    whatsapp: "",
    data_nascimento: "",
    senha: "",
    confirmarSenha: "",
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
        document.getElementById("aviso-erro-formulario");

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
    async function carregarDadosIniciais() {
      const [{ data: professoresData, error: professoresError }, { data: turmasData, error: turmasError }] =
        await Promise.all([
          supabase
            .from("perfis")
            .select("id, nome")
            .eq("tipo", "professor"),
          supabase
            .from("turmas")
            .select("dia_semana, horario, professor_id")
            .eq("ativa", true),
        ]);

      if (!professoresError && professoresData) {
        setProfessores(professoresData);
      }

      if (!turmasError && turmasData) {
        const unicos = new Map<string, HorarioDisponivel>();

        (turmasData as Array<{ dia_semana: string; horario: string; professor_id: string | null }>).forEach((turma) => {
          const horarioFormatado = turma.horario.substring(0, 5);
          const chave = `${turma.professor_id ?? "qualquer"}|${turma.dia_semana}|${horarioFormatado}`;

          if (!unicos.has(chave)) {
            unicos.set(chave, {
              chave,
              dia_semana: turma.dia_semana,
              horario: horarioFormatado,
              professor_id: turma.professor_id,
            });
          }
        });

        const ordenados = Array.from(unicos.values()).sort((a, b) => {
          const indiceDiaA = ORDEM_DIAS_SEMANA.indexOf(a.dia_semana);
          const indiceDiaB = ORDEM_DIAS_SEMANA.indexOf(b.dia_semana);

          if (indiceDiaA !== indiceDiaB) {
            return indiceDiaA - indiceDiaB;
          }

          return a.horario.localeCompare(b.horario);
        });

        setHorariosDisponiveis(ordenados);
      }

      setCarregando(false);
    }

    carregarDadosIniciais();
  }, []);

  const toggleHorario = (chave: string) => {
    setMensagemErro(null);
    setErroCampoId(null);
    setHorariosSelecionados((atual) =>
      atual.includes(chave) ? atual.filter((item) => item !== chave) : [...atual, chave]
    );
  };

  const atualizarCampo = (campo: keyof typeof formData, valor: string) => {
    setMensagemErro(null);
    setErroCampoId(null);
    setFormData((atual) => ({ ...atual, [campo]: valor }));
  };

  const selecionarModoHorario = (novoModo: "combinar" | "especificar") => {
    setMensagemErro(null);
    setErroCampoId(null);

    if (modoHorario !== novoModo) {
      setHorariosSelecionados([]);
    }

    setModoHorario(novoModo);
  };

  const selecionarProfessor = (professorId: string) => {
    setMensagemErro(null);
    setErroCampoId(null);

    if (formData.professor_id !== professorId) {
      setHorariosSelecionados([]);
    }

    setFormData((atual) => ({ ...atual, professor_id: professorId }));
  };

  const criarErroFormulario = (mensagem: string, campoId?: string) => {
    const erro = new Error(mensagem) as Error & { campoId?: string };
    erro.campoId = campoId;
    return erro;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setMensagemErro(null);
    setEnviando(true);

    try {
      if (!formData.nome.trim()) {
        throw criarErroFormulario("Preencha o nome completo.", "campo-nome");
      }

      if (!formData.whatsapp.trim()) {
        throw criarErroFormulario("Preencha o WhatsApp.", "campo-whatsapp");
      }

      if (!formData.email.trim()) {
        throw criarErroFormulario("Preencha o e-mail.", "campo-email");
      }

      if (!formData.data_nascimento) {
        throw criarErroFormulario("Informe a data de nascimento.", "campo-data-nascimento");
      }

      if (!formData.sexo) {
        throw criarErroFormulario("Selecione o sexo.", "campo-sexo");
      }

      if (!formData.nivel_experiencia) {
        throw criarErroFormulario("Selecione o nível no futevôlei.", "campo-nivel");
      }

      if (!formData.objetivo.trim()) {
        throw criarErroFormulario("Conte por que você quer praticar futevôlei.", "campo-objetivo");
      }

      if (possuiRestricao === null) {
        throw criarErroFormulario(
          "Informe se você possui alguma restrição ou necessidade especial.",
          "campo-restricao"
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
          "Selecione pelo menos um dia e horário disponível para a aula experimental.",
          "campo-horarios"
        );
      }

      if (possuiRestricao && !formData.necessidade_especial.trim()) {
        throw criarErroFormulario(
          "Descreva a restrição ou necessidade especial para continuar.",
          "campo-necessidade-especial"
        );
      }

      const horariosPreferenciaFinal =
        modoHorario === "combinar" ? "A combinar" : horariosPreferenciaFormatados;
      const whatsappLimpo = formData.whatsapp.replace(/\D/g, "");
      const telefonesBusca = gerarVariacoesTelefone(whatsappLimpo);

      const [{ data: perfilPorEmail, error: erroPerfilEmail }, { data: perfilPorWhatsapp, error: erroPerfilWhatsapp }] =
        await Promise.all([
          supabase
            .from("perfis")
            .select("id, tipo, whatsapp, email, permitir_nova_experimental")
            .eq("email", formData.email)
            .maybeSingle(),
          supabase
            .from("perfis")
            .select("id, tipo, whatsapp, email, permitir_nova_experimental")
            .in("whatsapp", telefonesBusca)
            .limit(1)
            .maybeSingle(),
        ]);

      if (erroPerfilEmail || erroPerfilWhatsapp) {
        throw new Error("Não foi possível validar o seu cadastro agora. Tente novamente em instantes.");
      }

      if (
        perfilPorEmail &&
        perfilPorWhatsapp &&
        perfilPorEmail.id !== perfilPorWhatsapp.id
      ) {
        throw new Error("Este e-mail e este WhatsApp já estão vinculados a cadastros diferentes. Fale com a equipe para ajustar.");
      }

      const perfilExistente = perfilPorEmail || perfilPorWhatsapp;

      if (!perfilExistente) {
        if (!formData.senha || !formData.confirmarSenha) {
          throw criarErroFormulario(
            "Crie uma senha para concluir o seu primeiro cadastro.",
            "campo-senha"
          );
        }

        if (formData.senha !== formData.confirmarSenha) {
          throw criarErroFormulario("As senhas não coincidem.", "campo-confirmar-senha");
        }

        if (formData.senha.length < 6) {
          throw criarErroFormulario("A senha deve ter pelo menos 6 caracteres.", "campo-senha");
        }
      }

      if (perfilExistente?.tipo && perfilExistente.tipo !== "aluno") {
        throw new Error("Este contato já está vinculado a um perfil interno do sistema.");
      }

      let perfilId = perfilExistente?.id || null;
      const whatsappReferencia = perfilExistente?.whatsapp || whatsappLimpo;

      if (perfilId) {
        const telefonesSolicitacao = Array.from(
          new Set([formData.whatsapp, whatsappReferencia, ...telefonesBusca].filter(Boolean))
        );

        const [{ data: solicitacaoEmAndamento, error: erroSolicitacaoAtiva }, { data: matriculaAtiva, error: erroMatriculaAtiva }] =
          await Promise.all([
            supabase
              .from("solicitacoes_aula_experimental")
              .select("id")
              .in("status", STATUS_SOLICITACOES_EM_ANDAMENTO)
              .in("telefone_aluno", telefonesSolicitacao)
              .limit(1)
              .maybeSingle(),
            supabase
              .from("matriculas")
              .select("id")
              .eq("perfil_id", perfilId)
              .in("status", STATUS_MATRICULAS_BLOQUEANTES)
              .limit(1)
              .maybeSingle(),
          ]);

        if (erroSolicitacaoAtiva || erroMatriculaAtiva) {
          throw new Error("Não foi possível validar o histórico desse aluno agora. Tente novamente em instantes.");
        }

        if (solicitacaoEmAndamento || matriculaAtiva) {
          throw new Error("Já existe uma aula experimental ou matrícula em andamento para este aluno.");
        }

        if (perfilExistente.permitir_nova_experimental === false) {
          throw new Error("Este aluno já utilizou a aula experimental. Apenas a equipe pode liberar uma nova tentativa.");
        }

        const { error: atualizarPerfilError } = await supabase
          .from("perfis")
          .update({
            nome: formData.nome,
            whatsapp: whatsappLimpo,
            email: formData.email,
            nivel: formData.nivel_experiencia,
            data_nascimento: formData.data_nascimento,
            sexo: formData.sexo,
            necessidade_especial: possuiRestricao ? formData.necessidade_especial.trim() : "",
            objetivo: formData.objetivo,
          })
          .eq("id", perfilId);

        if (atualizarPerfilError) {
          throw new Error("Encontramos o cadastro do aluno, mas não conseguimos atualizar os dados agora.");
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.senha,
        });

        if (authError) {
          throw new Error(`Erro ao criar conta: ${authError.message}`);
        }

        if (!authData.user) {
          throw new Error("Não foi possível concluir a criação da conta agora.");
        }

        perfilId = authData.user.id;

        const { error: perfilError } = await supabase.from("perfis").insert([
          {
            id: perfilId,
            nome: formData.nome,
            whatsapp: whatsappLimpo,
            email: formData.email,
            tipo: "aluno",
            nivel: formData.nivel_experiencia,
            data_nascimento: formData.data_nascimento,
            sexo: formData.sexo,
            necessidade_especial: possuiRestricao ? formData.necessidade_especial.trim() : "",
            objetivo: formData.objetivo,
            permitir_nova_experimental: true,
          },
        ]);

        if (perfilError) {
          throw new Error("A conta foi criada, mas não conseguimos preparar o perfil do aluno.");
        }
      }

      let { error: solicitacaoError } = await supabase
        .from("solicitacoes_aula_experimental")
        .insert([
          {
            nome_aluno: formData.nome,
            perfil_id: perfilId,
            telefone_aluno: whatsappLimpo,
            horarios_preferencia: horariosPreferenciaFinal,
            professor_preferido_id: formData.professor_id || null,
            professor_responsavel_id: formData.professor_id || null,
            status: "pendente",
            nivel_experiencia: formData.nivel_experiencia,
          },
        ]);

      if (solicitacaoError?.message?.toLowerCase().includes("perfil_id")) {
        const retry = await supabase
          .from("solicitacoes_aula_experimental")
          .insert([
            {
              nome_aluno: formData.nome,
              telefone_aluno: whatsappLimpo,
              horarios_preferencia: horariosPreferenciaFinal,
              professor_preferido_id: formData.professor_id || null,
              professor_responsavel_id: formData.professor_id || null,
              status: "pendente",
              nivel_experiencia: formData.nivel_experiencia,
            },
          ]);

        solicitacaoError = retry.error;
      }

      if (solicitacaoError) {
        throw new Error("A solicitação não pôde ser registrada agora. Tente novamente em instantes.");
      }

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
          <h2 className="text-2xl font-bold text-white mb-4">Solicitação Enviada!</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Recebemos as suas preferências e um dos nossos professores entrará em contacto pelo WhatsApp em breve para agendar a sua aula.
          </p>
          <Link href="/entrar">
            <button className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-full hover:bg-slate-700 transition-colors">
              Fazer Login
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
            <h1 className="text-3xl font-bold text-white mb-2">Aula <span className="text-orange-500">Experimental</span></h1>
            <p className="text-slate-400 text-sm">Crie a sua conta e diga-nos os melhores horários para a sua aula.</p>
          </div>

          {mensagemErro && (
            <motion.div
              id="aviso-erro-formulario"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/12 via-rose-500/8 to-amber-500/10 px-4 py-3 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-rose-100">Confira os dados do formulário</p>
                  <p className="mt-1 text-sm leading-relaxed text-rose-100/85">{mensagemErro}</p>
                </div>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Nome e WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nome Completo <span className="text-orange-400">*</span>
                </label>
                <input 
                  id="campo-nome"
                  type="text" required placeholder="Ex: João Silva"
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
                  type="tel" required placeholder="(00) 00000-0000"
                  value={formData.whatsapp}
                  onChange={(e) => atualizarCampo("whatsapp", maskPhone(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                E-mail <span className="text-orange-400">*</span>
              </label>
              <input 
                id="campo-email"
                type="email" required placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) => atualizarCampo("email", e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Data de Nascimento <span className="text-orange-400">*</span>
              </label>
              <input
                id="campo-data-nascimento"
                type="date"
                required
                max={new Date().toISOString().split("T")[0]}
                value={formData.data_nascimento}
                onChange={(e) => atualizarCampo("data_nascimento", e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all [color-scheme:dark]"
              />
            </div>

            {/* Senhas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Senha <span className="text-orange-400">*</span>
                </label>
                <div className="relative">
                  <input 
                    id="campo-senha"
                    type={mostrarSenha ? "text" : "password"} placeholder="Mínimo 6 caracteres"
                    value={formData.senha}
                    onChange={(e) => atualizarCampo("senha", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                  />
                  <button 
                    type="button" 
                    onClick={() => setMostrarSenha(!mostrarSenha)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-500 hover:text-slate-300"
                  >
                    {mostrarSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Confirmar Senha <span className="text-orange-400">*</span>
                </label>
                <div className="relative">
                  <input 
                    id="campo-confirmar-senha"
                    type={mostrarConfirmarSenha ? "text" : "password"} placeholder="Repita a senha"
                    value={formData.confirmarSenha}
                    onChange={(e) => atualizarCampo("confirmarSenha", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                  />
                  <button 
                    type="button" 
                    onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-500 hover:text-slate-300"
                  >
                    {mostrarConfirmarSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
            {/* NOVOS CAMPOS: Sexo e Nível */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Sexo <span className="text-orange-400">*</span>
                </label>
                <div className="relative">
                  <select 
                    id="campo-sexo"
                    required
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
                  Nível no Futevôlei <span className="text-orange-400">*</span>
                </label>
                <div className="relative">
                  <select 
                    id="campo-nivel"
                    required
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

            {/* NOVO CAMPO: Objetivo */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Por que quer praticar futevôlei? <span className="text-orange-400">*</span>
              </label>
              <textarea 
                id="campo-objetivo"
                required placeholder="Ex: Cuidar da saúde, hobby, quero competir..."
                value={formData.objetivo}
                onChange={(e) => atualizarCampo("objetivo", e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all resize-none h-20"
              />
            </div>

            {/* NOVO CAMPO: Restrições */}
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
                  required
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
              {carregando ? (
                <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> A carregar professores...
                </div>
              ) : (
                <>
                  <div className="relative">
                    <select 
                      value={formData.professor_id}
                      onChange={(e) => selecionarProfessor(e.target.value)}
                      className="w-full appearance-none bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-11 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                    >
                      <option value="">Qualquer professor</option>
                      {professores.map((prof) => (
                        <option key={prof.id} value={prof.id}>
                          {prof.nome}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Se escolher um professor, os horários mostrados abaixo serão apenas os dele. Se deixar qualquer professor, você verá todos os horários disponíveis.
                  </p>
                </>
              )}
            </div>

            {/* Preferências da Aula */}
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
                    O professor combina os melhores horários com você depois.
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
                    Escolha os dias e horários em que você realmente consegue ir.
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
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">
                {mensagemErro}
              </div>
            )}

            <button 
              type="submit" 
              disabled={enviando}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold py-4 rounded-xl shadow-lg hover:shadow-orange-500/25 transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {enviando ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> A processar...</>
              ) : (
                <><Send className="w-5 h-5" /> Criar Conta e Solicitar Aula</>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
