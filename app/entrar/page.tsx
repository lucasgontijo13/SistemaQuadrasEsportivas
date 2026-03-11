"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Mail, Lock, User, ArrowRight } from "lucide-react";

export default function EntrarPage() {
  // Estado para controlar se mostra "login" ou "cadastro"
  const [modo, setModo] = useState<"login" | "cadastro">("login");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-orange-500 selection:text-white flex flex-col">
      
      {/* Header Simples */}
      <header className="p-6">
        <Link href="/agendar" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
          <span className="font-medium text-sm">Voltar para horários</span>
        </Link>
      </header>

      {/* Container Principal */}
      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden"
        >
          {/* Efeito de luz no fundo do card */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/10 blur-[50px] rounded-full pointer-events-none" />

          {/* Logo Centralizada */}
          <div className="text-center mb-8">
            <div className="font-black text-3xl tracking-tighter text-white mb-2">
              Arena<span className="text-orange-500">.Pro</span>
            </div>
            <p className="text-slate-400 text-sm">
              {modo === "login" ? "Bem-vindo de volta à areia." : "Sua jornada começa aqui."}
            </p>
          </div>

          {/* Abas de Alternância */}
          <div className="flex bg-slate-950 p-1 rounded-xl mb-8 border border-slate-800">
            <button
              onClick={() => setModo("login")}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                modo === "login" 
                  ? "bg-slate-800 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setModo("cadastro")}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                modo === "cadastro" 
                  ? "bg-slate-800 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Formulário com animação de troca */}
          <AnimatePresence mode="wait">
            <motion.form
              key={modo}
              initial={{ opacity: 0, x: modo === "login" ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: modo === "login" ? 20 : -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
              onSubmit={(e) => e.preventDefault()}
            >
              {/* Campo Nome (Aparece só no cadastro) */}
              {modo === "cadastro" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300 pl-1">Nome Completo</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                      <User className="w-5 h-5" />
                    </div>
                    <input 
                      type="text" 
                      placeholder="Ex: Lucas Silva"
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>
              )}

              {/* Campo Email */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 pl-1">E-mail</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input 
                    type="email" 
                    placeholder="seu@email.com"
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center pr-1">
                  <label className="text-sm font-medium text-slate-300 pl-1">Senha</label>
                  {modo === "login" && (
                    <a href="#" className="text-xs text-orange-500 hover:text-orange-400 font-medium">Esqueceu?</a>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Botão de Submit */}
              <button className="w-full bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold py-4 rounded-xl mt-6 transition-colors flex items-center justify-center gap-2 group">
                {modo === "login" ? "Entrar na Plataforma" : "Criar Minha Conta"}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              
            </motion.form>
          </AnimatePresence>

        </motion.div>
      </main>
    </div>
  );
}