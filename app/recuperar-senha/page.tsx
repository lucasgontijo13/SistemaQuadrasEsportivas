"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Phone, ArrowRight, Loader2, AlertCircle, CheckCircle2, ChevronLeft } from "lucide-react";
import { solicitarLinkRecuperacao } from "@/services/authService";

export default function RecuperarSenhaPage() {
  const [identificador, setIdentificador] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  const handleRecuperacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    setSucesso(false);

    try {
      await solicitarLinkRecuperacao(identificador);
      setSucesso(true);
    } catch (err) {
      // Tratamento seguro de erro para evitar 'any'
      const mensagem = err instanceof Error ? err.message : "Erro ao processar sua solicitação.";
      setErro(mensagem);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-orange-500 selection:text-white relative">
      <div className="absolute top-6 sm:top-10 left-6 sm:left-10">
        <Link href="/entrar" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
          <span className="font-medium text-sm">Voltar para Login</span>
        </Link>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="font-bold text-3xl tracking-tighter text-white mb-2">
            Arena<span className="text-orange-500">.Pro</span>
          </div>
          <p className="text-slate-400 text-sm">Recuperação de conta</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-[2rem] shadow-2xl">
          {sucesso ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">E-mail enviado!</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Enviamos um link de recuperação para o seu e-mail cadastrado. Verifique sua caixa de entrada.
              </p>
              <Link href="/entrar" className="block w-full py-4 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors">
                Voltar para o Login
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleRecuperacao} className="space-y-5">
              <p className="text-slate-400 text-sm mb-6 leading-relaxed text-center sm:text-left">
                Digite seu e-mail ou WhatsApp cadastrado. Enviaremos um link seguro para você redefinir sua senha.
              </p>

              {erro && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p>{erro}</p>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Identificação</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    {identificador.includes("@") ? <Mail className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                  </div>
                  <input 
                    type="text" 
                    required 
                    placeholder="seu@email.com ou 37999999999" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none focus:border-orange-500 transition-colors"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={carregando} 
                className="w-full mt-2 py-4 bg-orange-500 text-slate-950 font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {carregando ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Enviar Link <ArrowRight className="w-5 h-5" /></>
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}