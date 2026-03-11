"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// Importamos o novo serviço
import { atualizarSenhaUsuario } from "@/services/authService";

export default function AtualizarSenhaPage() {
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    // Verificamos se estamos no navegador (evita erros de SSR)
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      
      if (hash.includes("error_description")) {
        const params = new URLSearchParams(hash.replace("#", "?"));
        const mensagemErro = params.get("error_description")?.replace(/\+/g, " ");

        queueMicrotask(() => {
          if (mensagemErro?.includes("expired")) {
            setErro("O link de recuperação expirou ou já foi usado. Por favor, solicite um novo link.");
          } else {
            setErro(mensagemErro || "Erro ao validar o link de recuperação.");
          }
        });
      }
    }
  }, []);

  const handleAtualizarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    // Validações básicas de UI
    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem. Verifique e tente novamente.");
      return;
    }

    if (senha.length < 6) {
      setErro("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setCarregando(true);

    // Chamada ao serviço isolado
    const resultado = await atualizarSenhaUsuario(senha);

    if (!resultado.sucesso) {
      setErro(resultado.erro || "Erro ao atualizar senha.");
    } else {
      setSucesso(true);
    }
    
    setCarregando(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-orange-500 selection:text-white">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        
        <div className="text-center mb-10">
          <div className="font-bold text-3xl tracking-tighter text-white mb-2">
            Arena<span className="text-orange-500">.Pro</span>
          </div>
          <p className="text-slate-400 text-sm">Crie sua nova senha</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-[2rem] shadow-2xl">
          {sucesso ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Senha atualizada!</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Sua nova senha foi salva com sucesso. Por favor, faça login novamente para acessar sua conta.
              </p>
              
              <Link href="/entrar" className="block w-full py-4 bg-orange-500 text-slate-950 font-bold rounded-xl hover:bg-orange-600 transition-colors text-center">
                Ir para o Login
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleAtualizarSenha} className="space-y-5">
              
              {erro && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p>{erro}</p>
                    {erro.includes("expirou") && (
                      <Link href="/recuperar-senha" className="inline-block text-orange-500 hover:text-orange-400 underline font-bold">
                        Solicitar novo link
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {!erro.includes("expirou") && (
                <>
                  <div className="space-y-4">
                    {/* Input Nova Senha */}
                    <div className="relative">
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nova Senha</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-5 h-5" />
                        </div>
                        <input 
                          type={verSenha ? "text" : "password"} 
                          required 
                          placeholder="••••••••" 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 pl-11 pr-10 text-white outline-none focus:border-orange-500 transition-colors"
                          value={senha}
                          onChange={(e) => setSenha(e.target.value)}
                        />
                        <button type="button" onClick={() => setVerSenha(!verSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                          {verSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Input Confirmar Senha */}
                    <div className="relative">
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Confirmar Nova Senha</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-5 h-5" />
                        </div>
                        <input 
                          type={verConfirmar ? "text" : "password"} 
                          required 
                          placeholder="••••••••" 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 pl-11 pr-10 text-white outline-none focus:border-orange-500 transition-colors"
                          value={confirmarSenha}
                          onChange={(e) => setConfirmarSenha(e.target.value)}
                        />
                        <button type="button" onClick={() => setVerConfirmar(!verConfirmar)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                          {verConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={carregando} className="w-full mt-2 py-4 bg-orange-500 text-slate-950 font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                    {carregando ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar Nova Senha"}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}