"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, User, MapPin, Phone, CreditCard, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function CompletarPerfilPage() {
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  // Estados dos novos campos
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");

  const finalizarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    
    // 1. Atualiza a senha definitiva do usuário no Auth do Supabase
    // (Em um cenário real com usuário logado, essa função atualiza a senha dele com segurança)
    /*
    await supabase.auth.updateUser({
      password: senha
    });
    */

    // 2. Simula o envio dos dados (CPF, Endereço, etc) para o banco de dados e Asaas
    setTimeout(() => {
      setSalvando(false);
      setConcluido(true);
    }, 1500);
  };

  if (concluido) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] max-w-sm w-full shadow-2xl">
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Perfil Completo!</h2>
          <p className="text-slate-400 mb-8">Sua senha foi atualizada com sucesso. Gerando sua fatura da mensalidade...</p>
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-orange-500 selection:text-white pb-20 pt-10 px-6 relative">
      <div className="max-w-md mx-auto relative z-10">
        
        <div className="text-center mb-10">
          <div className="font-bold text-2xl tracking-tighter text-white mb-2">
            Arena<span className="text-orange-500">.Pro</span>
          </div>
          <h1 className="text-xl font-bold text-white">Complete sua Ficha</h1>
          <p className="text-slate-400 text-sm mt-1">Defina sua senha definitiva e informe seus dados para gerarmos a matrícula.</p>
        </div>

        <motion.form 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          onSubmit={finalizarCadastro} 
          className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-[2rem] space-y-6 shadow-2xl"
        >
          {/* Acesso ao Sistema (Senha Definitiva) */}
          <div className="space-y-4">
            <h3 className="text-orange-500 font-bold text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <Lock className="w-4 h-4" /> Acesso ao Sistema
            </h3>
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Crie sua Senha Definitiva</label>
              <input 
                type="password" 
                required 
                minLength={6}
                placeholder="Mínimo de 6 caracteres" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 transition-colors"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
          </div>

          {/* Dados Pessoais */}
          <div className="space-y-4">
            <h3 className="text-orange-500 font-bold text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2 mt-6">
              <User className="w-4 h-4" /> Dados Pessoais (Asaas)
            </h3>
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">CPF (Apenas números)</label>
              <input 
                type="text" 
                required 
                maxLength={11}
                placeholder="00000000000" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 transition-colors"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Data de Nascimento</label>
              <input type="date" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 transition-colors" />
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <h3 className="text-orange-500 font-bold text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2 mt-6">
              <MapPin className="w-4 h-4" /> Endereço
            </h3>
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">CEP</label>
              <input type="text" required placeholder="00000-000" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 transition-colors" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-slate-400 font-medium mb-1 block">Rua</label>
                <input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1 block">Nº</label>
                <input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 transition-colors" />
              </div>
            </div>
          </div>

          {/* Saúde e Emergência */}
          <div className="space-y-4">
            <h3 className="text-orange-500 font-bold text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2 mt-6">
              <Phone className="w-4 h-4" /> Emergência
            </h3>
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Contato de Emergência</label>
              <input type="text" required placeholder="Ex: Maria (Mãe) - 37 99999-9999" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 transition-colors" />
            </div>
          </div>

          <button type="submit" disabled={salvando} className="w-full mt-8 py-4 bg-orange-500 text-slate-950 font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
            {salvando ? "Salvando Perfil..." : <><CreditCard className="w-5 h-5" /> Salvar e Ir para Pagamento</>}
          </button>
        </motion.form>

      </div>
    </div>
  );
}