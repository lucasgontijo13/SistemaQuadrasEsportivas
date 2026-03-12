"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation"; // Importados para navegação
import { motion, AnimatePresence } from "framer-motion";
import { 
  User as UserIcon, LogOut, Loader2, ShieldCheck, 
  CalendarDays, Bell, ChevronLeft 
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js"; // Importa o tipo oficial do Supabase
import { Perfil } from "@/types"; // Importa a sua interface de perfil


export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [usuarioLogado, setUsuarioLogado] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);
  const [temPendencia, setTemPendencia] = useState(false);
  const [notificacaoAberta, setNotificacaoAberta] = useState(false);

  useEffect(() => {
    async function carregarDadosIniciais() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setUsuarioLogado(session.user);

          // Busca o Perfil
          const { data: perfilData } = await supabase
            .from('perfis')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (perfilData) setPerfil(perfilData);

          // Busca Pendências de Dados
          const { data: matriculas } = await supabase
            .from('matriculas')
            .select('status')
            .eq('perfil_id', session.user.id)
            .eq('status', 'aguardando_dados')
            .limit(1);

          if (matriculas && matriculas.length > 0) {
            setTemPendencia(true);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados da navbar:", error);
      } finally {
        setCarregando(false);
      }
    }

    carregarDadosIniciais();
  }, []);

  const fazerLogout = async () => {
    await supabase.auth.signOut();
    setUsuarioLogado(null);
    setPerfil(null);
    setMenuAberto(false);
    router.push("/entrar");
  };

  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-lg fixed top-0 w-full z-50"
    >
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* LADO ESQUERDO: Botão Voltar */}
        <div className="flex-1">
          {!isHome && (
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium text-sm hidden sm:inline">Voltar</span>
            </button>
          )}
        </div>

        {/* CENTRO: Logo */}
        <Link href="/" className="flex-shrink-0">
          <div className="font-bold text-2xl tracking-tighter text-white text-center">
            Arena<span className="text-orange-500">.Pro</span>
          </div>
        </Link>

        {/* LADO DIREITO: Menu e Ações */}
        <div className="flex-1 flex justify-end gap-4 items-center">
          {carregando ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          ) : usuarioLogado && perfil ? (
            <div className="flex items-center gap-3">
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
                      <Link href="/agenda" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                        <CalendarDays className="w-4 h-4" /> Minha Agenda
                      </Link>
                      <Link href="/perfil" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                        <UserIcon className="w-4 h-4" /> Meu Perfil
                      </Link>
                      <div className="h-px bg-slate-800 my-2"></div>
                      <button onClick={fazerLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left">
                        <LogOut className="w-4 h-4" /> Sair da conta
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <button 
                  onClick={() => setNotificacaoAberta(!notificacaoAberta)}
                  className="p-2 text-slate-400 hover:text-white transition-colors relative bg-slate-900/50 rounded-full border border-slate-800/50 hover:border-orange-500/50"
                >
                  <Bell className="w-6 h-6" />
                  {temPendencia && (
                    <span className="absolute top-2 right-2 w-3 h-3 bg-orange-500 rounded-full border-2 border-slate-950 animate-pulse"></span>
                  )}
                </button>

                <AnimatePresence>
                  {notificacaoAberta && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-72 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-4 z-50"
                    >
                      <h4 className="text-white font-bold mb-2 text-sm">Notificações</h4>
                      <div className="h-px bg-slate-800 mb-3" />
                      {temPendencia ? (
                        <Link 
                          href="/perfil" 
                          onClick={() => setNotificacaoAberta(false)}
                          className="block p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl hover:bg-orange-500/20 transition-all"
                        >
                          <p className="text-xs text-orange-400 font-bold mb-1">📝 Dados pendentes!</p>
                          <p className="text-[11px] text-slate-400 leading-tight">Complete seus dados no perfil para validar a matrícula.</p>
                        </Link>
                      ) : (
                        <p className="text-xs text-slate-500 text-center py-4">Nenhuma notificação nova.</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <Link 
              href="/entrar" 
              className="text-sm font-bold text-slate-300 hover:text-white transition-colors border border-slate-800 px-5 py-2.5 rounded-full hover:bg-slate-900"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </motion.header>
  );
}