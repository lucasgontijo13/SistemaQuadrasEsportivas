"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, Save, AlertTriangle, CheckCircle2, Loader2, User, PhoneCall } from "lucide-react";

import { Perfil } from "@/types";
import { buscarPerfilUsuario, atualizarPerfilUsuario } from "@/services/perfilService";

// Funções de Máscara (permanecem na UI para formatação em tempo real)
const maskCPF = (v: string) => v.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})/, "$1-$2").replace(/(-\d{2})\d+?$/, "$1");
const maskPhone = (v: string) => v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").replace(/(-\d{4})\d+?$/, "$1");

// ADICIONE ESTA FUNÇÃO AQUI:
const validarCPF = (cpf: string) => {
  cpf = cpf.replace(/[^\d]+/g, ''); // Tira pontos e traços
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false; // Bloqueia 11111111111, 00000000000, etc.
  
  let soma = 0, resto;
  for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  
  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  
  return true;
};

export default function PerfilPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [pendenciaBanco, setPendenciaBanco] = useState(false);


  useEffect(() => {
    async function carregar() {
      try {
        const dados = await buscarPerfilUsuario();
        if (!dados) {
          router.push("/entrar");
        } else {
          setPendenciaBanco(!dados.cpf || !dados.data_nascimento || !dados.contato_emergencia);
          setPerfil({
            ...dados,
            whatsapp: maskPhone(dados.whatsapp || ""),
            contato_emergencia: maskPhone(dados.contato_emergencia || ""),
            cpf: maskCPF(dados.cpf || "")
          });
        }
      } catch {
        router.push("/entrar");
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [router]);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil) return;

    if (perfil.cpf && !validarCPF(perfil.cpf)) {
      setMensagem({ tipo: "erro", texto: "O CPF informado é inválido. Verifique os números." });
      return; 
    }

    setSalvando(true);
    setMensagem({ tipo: "", texto: "" });

    try {
      await atualizarPerfilUsuario(perfil);
      
    
      // Ela envia um sinal invisível avisando que o perfil mudou
      window.dispatchEvent(new Event("perfilAtualizado"));
      
      setMensagem({ tipo: "sucesso", texto: "Perfil atualizado com sucesso!" });
      setPendenciaBanco(!perfil.cpf || !perfil.data_nascimento || !perfil.contato_emergencia);
      setTimeout(() => setMensagem({ tipo: "", texto: "" }), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar perfil.";
      setMensagem({ tipo: "erro", texto: msg });
    } finally {
      setSalvando(false);
    }
  };

  if (carregando || !perfil) {
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

        {pendenciaBanco && (
          <div className="mb-8 p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex gap-4 items-start">
            <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-orange-400 text-lg">Cadastro Incompleto</h3>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                Complete os dados de CPF, Nascimento e Emergência para validar sua matrícula.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSalvar} className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-[2rem] shadow-xl space-y-6">
          {mensagem.texto && (
            <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${mensagem.tipo === 'sucesso' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {mensagem.tipo === 'sucesso' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              {mensagem.texto}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nome Completo</label>
              <input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500" value={perfil.nome} onChange={e => setPerfil({...perfil, nome: e.target.value})} />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Número do WhatsApp</label>
              <input 
                type="tel" 
                required 
                placeholder="(00) 00000-0000"
                minLength={14}
                maxLength={15}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500" 
                value={perfil.whatsapp} 
                onChange={e => setPerfil({...perfil, whatsapp: maskPhone(e.target.value)})} 
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Número de Emergência</label>
              <div className="relative">
                <PhoneCall className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="tel" 
                  required 
                  placeholder="(00) 00000-0000"
                  minLength={14}
                  maxLength={15}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 pl-10 pr-4 text-white outline-none focus:border-orange-500" 
                  value={perfil.contato_emergencia || ""} 
                  onChange={e => setPerfil({...perfil, contato_emergencia: maskPhone(e.target.value)})} 
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">CPF</label>
              <input 
                type="text" 
                required 
                placeholder="000.000.000-00"
                minLength={14}
                maxLength={14}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500" 
                value={perfil.cpf || ""} 
                onChange={e => setPerfil({...perfil, cpf: maskCPF(e.target.value)})} 
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nascimento</label>
              <input type="date" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500" value={perfil.data_nascimento || ""} onChange={e => setPerfil({...perfil, data_nascimento: e.target.value})} />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Seu Nível Atual</label>
              <div className="w-full bg-slate-950/50 border border-slate-800/50 rounded-xl p-3.5 text-slate-400 cursor-not-allowed flex items-center justify-between">
                <span>{perfil.nivel}</span>
                <span className="text-[10px] bg-slate-800 px-2 py-1 rounded-md uppercase tracking-wider">Apenas Professor</span>
              </div>
            </div>
          </div>

          <button type="submit" disabled={salvando} className="w-full sm:w-auto px-8 py-4 bg-orange-500 text-slate-950 font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 mt-4 float-right">
            {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Salvar Alterações</>}
          </button>
          <div className="clear-both"></div>
        </form>
      </main>
    </div>
  );
}