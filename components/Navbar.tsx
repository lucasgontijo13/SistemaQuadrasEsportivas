"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { User as UserIcon, LogOut, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function Navbar() {
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    async function verificarSessao() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUsuarioLogado(session.user);
        const { data } = await supabase.from('perfis').select('*').eq('id', session.user.id).single();
        if (data) setPerfil(data);
      }
      setCarregando(false);
    }
    verificarSessao();
  }, []);

  const fazerLogout = async () => {
    await supabase.auth.signOut();
    setUsuarioLogado(null);
    setPerfil(null);
    setMenuAberto(false);
  };

  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-lg fixed top-0 w-full z-50"
    >
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/">
          <div className="font-bold text-2xl tracking-tighter text-white">
            Arena<span className="text-orange-500">.Pro</span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          {carregando ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          ) : usuarioLogado && perfil ? (
            
            <div className="flex items-center gap-3">
              
              {/* ATALHO RÁPIDO: Só aparece se for Admin ou Professor */}
              {(perfil.tipo === 'admin' || perfil.tipo === 'professor') && (
                <Link 
                  href="/admin" 
                  className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-full text-sm font-bold text-slate-300 hover:text-white hover:border-slate-700 transition-all"
                >
                  <ShieldCheck className="w-4 h-4 text-orange-500" />
                  Painel Admin
                </Link>
              )}

    
              <div className="relative">
                <button 
                  onClick={() => setMenuAberto(!menuAberto)}
                  className="flex items-center gap-3 hover:bg-slate-900 p-1.5 pr-4 rounded-full border border-slate-800 transition-all"
                >
                  <div className="w-9 h-9 bg-orange-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-sm">
                    {perfil.nome.charAt(0)}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-bold text-white leading-tight">{perfil.nome.split(" ")[0]}</p>
                    <p className="text-[10px] text-orange-400 uppercase tracking-wider font-bold">{perfil.tipo}</p>
                  </div>
                </button>

                <AnimatePresence>
                  {menuAberto && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                      animate={{ opacity: 1, y: 0, scale: 1 }} 
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden py-2"
                    >
                      <div className="px-4 py-3 border-b border-slate-800 mb-2 sm:hidden">
                        <p className="text-sm font-bold text-white">{perfil.nome}</p>
                        <p className="text-[10px] text-orange-400 uppercase tracking-wider font-bold">{perfil.tipo}</p>
                      </div>

                      <Link href="/perfil" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                        <UserIcon className="w-4 h-4" /> Meu Perfil
                      </Link>

                      {/* Mantemos no celular caso ele esteja usando uma tela pequena */}
                      <div className="sm:hidden">
                        {(perfil.tipo === 'admin' || perfil.tipo === 'professor') && (
                          <Link href="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                            <ShieldCheck className="w-4 h-4" /> Painel Admin
                          </Link>
                        )}
                      </div>

                      <div className="h-px bg-slate-800 my-2"></div>
                      
                      <button onClick={fazerLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left">
                        <LogOut className="w-4 h-4" /> Sair da conta
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          ) : (
            
            /* BOTÕES PARA QUEM ESTÁ DE FORA */
            <div className="flex items-center gap-4">
              <Link 
                href="/entrar" 
                className="bg-orange-500 text-slate-950 px-6 py-2.5 rounded-full font-bold text-sm hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-95"
              >
                Entrar
              </Link>
            </div>

          )}
        </div>
      </div>
    </motion.header>
  );
}