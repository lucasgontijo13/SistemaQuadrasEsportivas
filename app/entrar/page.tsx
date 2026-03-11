"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, Loader2, ArrowRight, AlertCircle, ChevronLeft, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const fazerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro("");

    let emailFinal = email; // Começa assumindo que o usuário digitou um e-mail

    // Se o que foi digitado NÃO tem "@", tratamos como WhatsApp
    if (!email.includes("@")) {
      const whatsappLimpo = email.replace(/\D/g, "");

      // Busca o e-mail atrelado a esse WhatsApp na tabela perfis
      const { data: perfilEncontrado, error: erroBusca } = await supabase
        .from('perfis')
        .select('email')
        .eq('whatsapp', whatsappLimpo)
        .single();

      if (erroBusca || !perfilEncontrado?.email) {
        setErro("Nenhum usuário encontrado com este WhatsApp.");
        setCarregando(false);
        return;
      }

      emailFinal = perfilEncontrado.email;
    }

    // Agora faz o login oficial usando o e-mail descoberto
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailFinal,
      password: senha,
    });

    if (authError) {
      setErro("Credenciais incorretas. Verifique seus dados.");
      setCarregando(false);
      return;
    }

    // Redirecionamento (sua lógica original)
    if (authData.user) {
      const { data: perfil } = await supabase
        .from('perfis')
        .select('tipo')
        .eq('id', authData.user.id)
        .single();

      if (perfil?.tipo === 'admin' || perfil?.tipo === 'professor') {
        router.push("/admin");
      } else {
        router.push("/agenda");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-orange-500 selection:text-white relative">
      
      {/* Botão de Voltar discreto no topo */}
      <div className="absolute top-6 sm:top-10 left-6 sm:left-10">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
          <span className="font-medium text-sm">Voltar</span>
        </Link>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="font-bold text-3xl tracking-tighter text-white mb-2">
            Arena<span className="text-orange-500">.Pro</span>
          </div>
          <p className="text-slate-400 text-sm">Acesse sua conta para continuar.</p>
        </div>

        <form onSubmit={fazerLogin} className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-[2rem] shadow-2xl space-y-5">
          
          {/* Mensagem de Erro (Só aparece se errar a senha) */}
          {erro && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p>{erro}</p>
            </motion.div>
          )}

          <div>
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">
              E-mail ou Número de WhatsApp
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                {email.includes("@") ? <Mail className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
              </div>
              <input 
                type="text" 
                required 
                placeholder="seu@email.com ou 37999999999" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none focus:border-orange-500 transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Sua Senha</label>
              <Link href="/recuperar-senha" className="text-xs font-bold text-orange-500 hover:text-orange-400 transition-colors">Esqueceu a senha?</Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-5 h-5" />
              </div>
              <input 
                type="password" 
                required 
                placeholder="••••••••" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none focus:border-orange-500 transition-colors"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={carregando} 
            className="w-full mt-2 py-4 bg-orange-500 text-slate-950 font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {carregando ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>Entrar no Sistema <ArrowRight className="w-5 h-5" /></>
            )}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-8">
          Ainda não tem conta? <Link href="/agendar" className="text-orange-500 font-bold hover:underline">Agende uma aula</Link>
        </p>
      </motion.div>
    </div>
  );
}