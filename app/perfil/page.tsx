"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, Save, AlertTriangle, CheckCircle2, Loader2, User, PhoneCall } from "lucide-react";
import { supabase } from "@/lib/supabase";

// --- FUNÇÕES DE MÁSCARA E VALIDAÇÃO ---

const maskCPF = (value: string) => {
  return value
    .replace(/\D/g, "") // Tira tudo que não é número
    .replace(/(\d{3})(\d)/, "$1.$2") // Coloca o primeiro ponto
    .replace(/(\d{3})(\d)/, "$1.$2") // Coloca o segundo ponto
    .replace(/(\d{3})(\d{1,2})/, "$1-$2") // Coloca o traço
    .replace(/(-\d{2})\d+?$/, "$1"); // Impede de digitar mais que 11 números
};

const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(-\d{4})\d+?$/, "$1"); // Máx 15 caracteres: (00) 00000-0000
};

const validarCPF = (cpf: string) => {
  cpf = cpf.replace(/[^\d]+/g, ""); // Tira a máscara para validar
  if (cpf === "" || cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false; // Rejeita 000.000.000-00, etc.

  let soma = 0;
  for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;

  return true;
};

// --- COMPONENTE PRINCIPAL ---

export default function PerfilPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });
  
  const [perfil, setPerfil] = useState({
    id: "",
    nome: "",
    whatsapp: "",
    contato_emergencia: "",
    cpf: "",
    data_nascimento: "",
    nivel: "",
    tipo: ""
  });

  useEffect(() => {
    async function carregarPerfil() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push("/entrar");
        return;
      }

      const { data } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setPerfil({
          id: data.id,
          nome: data.nome || "",
          whatsapp: data.whatsapp ? maskPhone(data.whatsapp) : "",
          contato_emergencia: data.contato_emergencia ? maskPhone(data.contato_emergencia) : "",
          cpf: data.cpf ? maskCPF(data.cpf) : "",
          data_nascimento: data.data_nascimento || "",
          nivel: data.nivel || "Iniciante",
          tipo: data.tipo || "aluno"
        });
      }
      setCarregando(false);
    }
    carregarPerfil();
  }, [router]);

  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem({ tipo: "", texto: "" });

    // 1. VALIDAÇÃO DE CPF
    if (perfil.cpf && !validarCPF(perfil.cpf)) {
      setMensagem({ tipo: "erro", texto: "CPF Inválido! Verifique a numeração e tente novamente." });
      setSalvando(false);
      return;
    }

    // 2. VALIDAÇÃO DE EMERGÊNCIA (NÃO PODE SER IGUAL)
    // Tiramos tudo que não é número para comparar apenas os dígitos reais
    const zapApenasNumeros = perfil.whatsapp.replace(/\D/g, "");
    const emergenciaApenasNumeros = perfil.contato_emergencia.replace(/\D/g, "");
    
    if (zapApenasNumeros && emergenciaApenasNumeros && zapApenasNumeros === emergenciaApenasNumeros) {
      setMensagem({ tipo: "erro", texto: "O Contato de Emergência não pode ser igual ao seu WhatsApp pessoal." });
      setSalvando(false);
      return;
    }

    const dataFormatada = perfil.data_nascimento ? perfil.data_nascimento : null;

    // 3. SALVANDO NO BANCO
    const { error } = await supabase
      .from('perfis')
      .update({
        nome: perfil.nome,
        whatsapp: perfil.whatsapp,
        contato_emergencia: perfil.contato_emergencia,
        cpf: perfil.cpf,
        data_nascimento: dataFormatada 
      })
      .eq('id', perfil.id);

    if (error) {
      console.error("ERRO DETALHADO SUPABASE:", error);
      setMensagem({ tipo: "erro", texto: `Falha: ${error.message} (Código: ${error.code})` });
    } else {
      setMensagem({ tipo: "sucesso", texto: "Perfil atualizado com sucesso!" });
    }
    setSalvando(false);
  };

  const cadastroPendente = !perfil.cpf || !perfil.data_nascimento || !perfil.contato_emergencia;

  if (carregando) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-orange-500 selection:text-white pb-20">
      
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
            <span className="font-medium text-sm">Voltar</span>
          </Link>
          <div className="font-bold text-xl tracking-tighter text-white">Arena<span className="text-orange-500">.Pro</span></div>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <User className="w-8 h-8 text-orange-500" /> Meu Perfil
          </h1>
          <p className="text-slate-400 mt-2">Gerencie suas informações pessoais e dados de matrícula.</p>
        </motion.div>

        {cadastroPendente && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="mb-8 p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex gap-4 items-start"
          >
            <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-orange-400 text-lg">Cadastro Incompleto</h3>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                Para validar sua matrícula e garantir sua segurança, precisamos que preencha os dados pendentes abaixo.
              </p>
            </div>
          </motion.div>
        )}

        <form onSubmit={salvarPerfil} className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-[2rem] shadow-xl space-y-6">
          
          {mensagem.texto && (
            <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${mensagem.tipo === 'sucesso' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {mensagem.tipo === 'sucesso' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              {mensagem.texto}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nome Completo</label>
              <input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 transition-colors" value={perfil.nome} onChange={e => setPerfil({...perfil, nome: e.target.value})} />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Número WhatsApp</label>
              {/* MUDANÇA: onChange passando pela função maskPhone */}
              <input type="tel" required placeholder="(00) 00000-0000" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 transition-colors" value={perfil.whatsapp} onChange={e => setPerfil({...perfil, whatsapp: maskPhone(e.target.value)})} />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block text-orange-400 flex items-center gap-1">
                Contato de Emergência {cadastroPendente && !perfil.contato_emergencia && <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <PhoneCall className="w-4 h-4" />
                </div>
                {/* MUDANÇA: onChange passando pela função maskPhone */}
                <input 
                  type="tel" 
                  required 
                  placeholder="(00) 00000-0000" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 pl-10 pr-4 text-white outline-none focus:border-orange-500 transition-colors" 
                  value={perfil.contato_emergencia} 
                  onChange={e => setPerfil({...perfil, contato_emergencia: maskPhone(e.target.value)})} 
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block text-orange-400 flex items-center gap-1">
                CPF {cadastroPendente && !perfil.cpf && <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>}
              </label>
              {/* MUDANÇA: onChange passando pela função maskCPF */}
              <input type="text" required placeholder="000.000.000-00" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 transition-colors" value={perfil.cpf} onChange={e => setPerfil({...perfil, cpf: maskCPF(e.target.value)})} />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block text-orange-400 flex items-center gap-1">
                Data de Nascimento {cadastroPendente && !perfil.data_nascimento && <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>}
              </label>
              <input type="date" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" value={perfil.data_nascimento} onChange={e => setPerfil({...perfil, data_nascimento: e.target.value})} />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Seu Nível Atual</label>
              <div className="w-full bg-slate-950/50 border border-slate-800/50 rounded-xl p-3.5 text-slate-400 cursor-not-allowed flex items-center justify-between">
                <span>{perfil.nivel}</span>
                <span className="text-[10px] bg-slate-800 px-2 py-1 rounded-md uppercase tracking-wider">Apenas Professor</span>
              </div>
            </div>
          </div>

          <button type="submit" disabled={salvando} className="w-full sm:w-auto px-8 py-4 bg-orange-500 text-slate-950 font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-4 float-right">
            {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Salvar Alterações</>}
          </button>
          
          <div className="clear-both"></div>
        </form>
      </main>
    </div>
  );
}