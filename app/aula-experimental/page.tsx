"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Send, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Professor {
  id: string;
  nome: string;
}

const maskPhone = (value: string) => {
  if (!value) return "";
  return value
    .replace(/\D/g, "") // Tira tudo que não é número
    .replace(/(\d{2})(\d)/, "($1) $2") // Coloca o parênteses DDD
    .replace(/(\d{5})(\d)/, "$1-$2") // Coloca o hífen depois do 5º dígito
    .replace(/(-\d{4})\d+?$/, "$1"); // Impede de digitar mais que 15 caracteres
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
    
    if (formData.senha !== formData.confirmarSenha) {
      alert("As senhas não coincidem!");
      return;
    }

    if (formData.senha.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setEnviando(true);

    // 1. Cria a conta do aluno na plataforma (Auth)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.senha,
    });

    if (authError) {
      alert("Erro ao criar conta: " + authError.message);
      setEnviando(false);
      return;
    }

    // 2. Salva os dados na tabela de Perfis do banco de dados
    if (authData.user) {
      const { error: perfilError } = await supabase.from('perfis').insert([{
        id: authData.user.id,
        nome: formData.nome,
        whatsapp: formData.whatsapp.replace(/\D/g, ""), 
        email: formData.email,
        tipo: 'aluno',
        nivel: formData.nivel_experiencia, // Salva o nível diretamente no perfil
        sexo: formData.sexo,
        necessidade_especial: formData.necessidade_especial,
        objetivo: formData.objetivo
      }]);

      if (perfilError) {
        console.error("Erro ao salvar perfil:", perfilError);
      }
    }

    // 3. Salva a solicitação da aula experimental
    const { error: solicitacaoError } = await supabase
      .from("solicitacoes_aula_experimental")
      .insert([
        {
          nome_aluno: formData.nome,
          telefone_aluno: formData.whatsapp,
          horarios_preferencia: formData.horarios_preferencia,
          professor_id: formData.professor_id || null, // Nulo se for "Qualquer professor"
          status: "pendente",
          nivel_experiencia: formData.nivel_experiencia
        },
      ]);

    setEnviando(false);

    if (solicitacaoError) {
      alert("A sua conta foi criada, mas ocorreu um erro ao registar a preferência de horário. Por favor, contacte o suporte.");
      console.error(solicitacaoError);
    } else {
      setSucesso(true);
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
            A sua conta foi criada e recebemos as suas preferências. Um dos nossos professores entrará em contacto consigo pelo WhatsApp em breve para agendar a sua aula.
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

            {/* Senhas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="relative">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Senha</label>
                <input 
                  type={mostrarSenha ? "text" : "password"} required placeholder="Mínimo 6 caracteres"
                  value={formData.senha}
                  onChange={(e) => setFormData({...formData, senha: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                />
                <button 
                  type="button" 
                  onClick={() => setMostrarSenha(!mostrarSenha)} 
                  className="absolute right-4 top-9 text-slate-500 hover:text-slate-300"
                >
                  {mostrarSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar Senha</label>
                <input 
                  type={mostrarConfirmarSenha ? "text" : "password"} required placeholder="Repita a senha"
                  value={formData.confirmarSenha}
                  onChange={(e) => setFormData({...formData, confirmarSenha: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                />
                <button 
                  type="button" 
                  onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)} 
                  className="absolute right-4 top-9 text-slate-500 hover:text-slate-300"
                >
                  {mostrarConfirmarSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* NOVOS CAMPOS: Sexo e Nível */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Sexo</label>
                <select 
                  required
                  value={formData.sexo}
                  onChange={(e) => setFormData({...formData, sexo: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all appearance-none"
                >
                  <option value="">Selecione...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Outros">Outros</option>
                  <option value="Prefiro não informar">Prefiro não informar</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nível no Futevôlei</label>
                <select 
                  required
                  value={formData.nivel_experiencia}
                  onChange={(e) => setFormData({...formData, nivel_experiencia: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all appearance-none"
                >
                  <option value="">Selecione o seu nível...</option>
                  <option value="Aprendiz">Aprendiz</option>
                  <option value="Iniciante">Iniciante</option>
                  <option value="Intermediário">Intermediário</option>
                  <option value="Avançado">Avançado</option>
                </select>
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
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Tem preferência por um professor?</label>
              {carregando ? (
                <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> A carregar professores...
                </div>
              ) : (
                <select 
                  value={formData.professor_id}
                  onChange={(e) => setFormData({...formData, professor_id: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all appearance-none"
                >
                  <option value="">Qualquer professor (Recomendado)</option>
                  {professores.map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.nome}
                    </option>
                  ))}
                </select>
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