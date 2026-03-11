"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, User, MapPin, Phone, CreditCard, Lock, Loader2 } from "lucide-react";
import { completarPerfilUsuario } from "@/services/perfilService";
import { DadosCompletarPerfil } from "@/types";

export default function CompletarPerfilPage() {
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState("");

  const [form, setForm] = useState<DadosCompletarPerfil>({
    senha: "",
    cpf: "",
    data_nascimento: "",
    cep: "",
    rua: "",
    numero: "",
    contato_emergencia: ""
  });

  const finalizarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");

    try {
      await completarPerfilUsuario(form);
      setConcluido(true);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Ocorreu um erro ao salvar seu perfil.";
      setErro(mensagem);
      setSalvando(false);
    }
  };

  if (concluido) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] max-w-sm w-full shadow-2xl">
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Perfil Completo!</h2>
          <p className="text-slate-400 mb-8">Sua senha foi atualizada e seus dados foram salvos. Gerando sua fatura...</p>
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 pt-10 px-6 relative">
      <div className="max-w-md mx-auto relative z-10">
        <div className="text-center mb-10">
          <div className="font-bold text-2xl tracking-tighter text-white mb-2">Arena<span className="text-orange-500">.Pro</span></div>
          <h1 className="text-xl font-bold text-white">Complete sua Ficha</h1>
          <p className="text-slate-400 text-sm mt-1">Informe seus dados para gerarmos sua matrícula e acesso.</p>
        </div>

        <motion.form 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          onSubmit={finalizarCadastro} 
          className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-[2rem] space-y-6 shadow-2xl"
        >
          {erro && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs">{erro}</div>}

          <div className="space-y-4">
            <h3 className="text-orange-500 font-bold text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <Lock className="w-4 h-4" /> Acesso ao Sistema
            </h3>
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Senha Definitiva</label>
              <input type="password" required minLength={6} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-orange-500 font-bold text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <User className="w-4 h-4" /> Dados Pessoais
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1 block">CPF</label>
                <input type="text" required maxLength={11} placeholder="000.000.000-00" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500" value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1 block">Nascimento</label>
                <input type="date" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500" value={form.data_nascimento} onChange={e => setForm({...form, data_nascimento: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-orange-500 font-bold text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <MapPin className="w-4 h-4" /> Endereço
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="text-xs text-slate-400 font-medium mb-1 block">CEP</label>
                <input type="text" required placeholder="00000-000" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500" value={form.cep} onChange={e => setForm({...form, cep: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 font-medium mb-1 block">Rua</label>
                <input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500" value={form.rua} onChange={e => setForm({...form, rua: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Número</label>
              <input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500" value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-orange-500 font-bold text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <Phone className="w-4 h-4" /> Emergência
            </h3>
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Contato de Emergência</label>
              <input type="text" required placeholder="Nome - (00) 00000-0000" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500" value={form.contato_emergencia} onChange={e => setForm({...form, contato_emergencia: e.target.value})} />
            </div>
          </div>

          <button type="submit" disabled={salvando} className="w-full mt-8 py-4 bg-orange-500 text-slate-950 font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
            {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5" /> Salvar e Ir para Pagamento</>}
          </button>
        </motion.form>
      </div>
    </div>
  );
}