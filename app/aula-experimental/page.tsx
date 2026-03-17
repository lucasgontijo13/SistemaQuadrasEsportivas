"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Send, Loader2, CheckCircle2, Eye, EyeOff, ChevronDown } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Professor {
  id: string;
  nome: string;
}

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
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  
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
    horarios_preferencia: "",
    professor_id: "",
    sexo: "",
    necessidade_especial: "",
    nivel_experiencia: "",
    objetivo: "",
  });

  // Busca os professores ao carregar a página
  useEffect(() => {
    async function buscarProfessores() {
      const { data, error } = await supabase
        .from("perfis")
        .select("id, nome")
        .eq("tipo", "professor");

      if (!error && data) {
        setProfessores(data);
      }
      setCarregando(false);
    }
    buscarProfessores();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setEnviando(true);

    try {
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
          throw new Error("Crie uma senha para concluir o seu primeiro cadastro.");
        }

        if (formData.senha !== formData.confirmarSenha) {
          throw new Error("As senhas não coincidem.");
        }

        if (formData.senha.length < 6) {
          throw new Error("A senha deve ter pelo menos 6 caracteres.");
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
            necessidade_especial: formData.necessidade_especial,
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
            necessidade_especial: formData.necessidade_especial,
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
            horarios_preferencia: formData.horarios_preferencia,
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
              horarios_preferencia: formData.horarios_preferencia,
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
      alert(error instanceof Error ? error.message : "Não foi possível enviar a solicitação agora.");
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

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nome e WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome Completo</label>
                <input 
                  type="text" required placeholder="Ex: João Silva"
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">WhatsApp</label>
                <input 
                  type="tel" required placeholder="(00) 00000-0000"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({...formData, whatsapp: maskPhone(e.target.value)})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">E-mail</label>
              <input 
                type="email" required placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Data de Nascimento</label>
              <input
                type="date"
                required
                max={new Date().toISOString().split("T")[0]}
                value={formData.data_nascimento}
                onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all [color-scheme:dark]"
              />
            </div>

            {/* Senhas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Senha</label>
                <div className="relative">
                  <input 
                    type={mostrarSenha ? "text" : "password"} placeholder="Mínimo 6 caracteres"
                    value={formData.senha}
                    onChange={(e) => setFormData({...formData, senha: e.target.value})}
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
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar Senha</label>
                <div className="relative">
                  <input 
                    type={mostrarConfirmarSenha ? "text" : "password"} placeholder="Repita a senha"
                    value={formData.confirmarSenha}
                    onChange={(e) => setFormData({...formData, confirmarSenha: e.target.value})}
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
            <p className="text-xs text-slate-500 -mt-2">
              Se este aluno já tiver cadastro e a equipe liberar uma nova experimental, a conta existente será reaproveitada.
            </p>

            {/* NOVOS CAMPOS: Sexo e Nível */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Sexo</label>
                <div className="relative">
                  <select 
                    required
                    value={formData.sexo}
                    onChange={(e) => setFormData({...formData, sexo: e.target.value})}
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
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nível no Futevôlei</label>
                <div className="relative">
                  <select 
                    required
                    value={formData.nivel_experiencia}
                    onChange={(e) => setFormData({...formData, nivel_experiencia: e.target.value})}
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
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Por que quer praticar futevôlei?</label>
              <textarea 
                required placeholder="Ex: Cuidar da saúde, hobby, quero competir..."
                value={formData.objetivo}
                onChange={(e) => setFormData({...formData, objetivo: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all resize-none h-20"
              />
            </div>

            {/* NOVO CAMPO: Restrições */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Possui alguma restrição médica, física ou necessidade especial?</label>
              <input 
                type="text" placeholder="Se não possuir, pode deixar em branco."
                value={formData.necessidade_especial}
                onChange={(e) => setFormData({...formData, necessidade_especial: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
              />
            </div>

            {/* Preferências da Aula */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Dias e Horários de Preferência</label>
              <textarea 
                required placeholder="Ex: Segundas de manhã ou Quartas depois das 18h"
                value={formData.horarios_preferencia}
                onChange={(e) => setFormData({...formData, horarios_preferencia: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all resize-none h-24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Quer ser atendido por um professor específico?</label>
              {carregando ? (
                <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> A carregar professores...
                </div>
              ) : (
                <>
                <div className="relative">
                  <select 
                    value={formData.professor_id}
                    onChange={(e) => setFormData({...formData, professor_id: e.target.value})}
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
                  Se escolher um professor, somente ele poderá atender sua aula experimental. Se deixar em branco, qualquer professor poderá assumir o atendimento.
                </p>
                </>
              )}
            </div>

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
