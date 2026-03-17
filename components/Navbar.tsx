"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation"; // Importados para navegação
import { motion, AnimatePresence } from "framer-motion";
import { 
  User as UserIcon, LogOut, Loader2, ShieldCheck, 
  CalendarDays, Bell, ChevronLeft, AlertTriangle
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js"; // Importa o tipo oficial do Supabase
import { AlertaPendenciaMatricula, Perfil } from "@/types"; // Importa a sua interface de perfil
import { buscarAlertasPendenciasEquipe } from "@/services/adminService";
import { formatarTempoAbertoPendencia, obterLabelStatusPendencia } from "@/utils/matriculaPendencia";


export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const isAdminRoute = pathname.startsWith("/admin");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const notificacaoRef = useRef<HTMLDivElement | null>(null);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [usuarioLogado, setUsuarioLogado] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);
  const [temPendencia, setTemPendencia] = useState(false);
  const [alertasEquipe, setAlertasEquipe] = useState<AlertaPendenciaMatricula[]>([]);
  const [notificacaoAberta, setNotificacaoAberta] = useState(false);

  useEffect(() => {
    // Transformamos a busca de dados numa função que recebe a sessão atual
    async function atualizarEstado(session: Session | null) {
      try {
        if (session) {
          setUsuarioLogado(session.user);
          let perfilAtual: Perfil | null = null;

          // Busca o Perfil
          const { data: perfilData } = await supabase
            .from('perfis')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (perfilData) {
            perfilAtual = perfilData as Perfil;
            setPerfil(perfilAtual);
          }

          // Busca Pendências de Dados
          const { data: matriculas } = await supabase
            .from('matriculas')
            .select('status')
            .eq('perfil_id', session.user.id)
            .eq('status', 'aguardando_dados')
            .limit(1);

          if (matriculas && matriculas.length > 0) {
            setTemPendencia(true);
          } else {
            setTemPendencia(false);
          }

          const tipoPerfilAtual =
            perfilAtual?.tipo ||
            (typeof session.user.user_metadata?.tipo === "string" ? session.user.user_metadata.tipo : "") ||
            (typeof session.user.app_metadata?.tipo === "string" ? session.user.app_metadata.tipo : "") ||
            (typeof session.user.app_metadata?.role === "string" ? session.user.app_metadata.role : "") ||
            "aluno";

          if (tipoPerfilAtual === "admin" || tipoPerfilAtual === "professor") {
            const alertas = await buscarAlertasPendenciasEquipe(session.user.id, tipoPerfilAtual);
            setAlertasEquipe(alertas);
          } else {
            setAlertasEquipe([]);
          }
        } else {
          // Se não houver sessão, limpa os dados
          setUsuarioLogado(null);
          setPerfil(null);
          setTemPendencia(false);
          setAlertasEquipe([]);
        }
      } catch (error) {
        console.error("Erro ao atualizar navbar:", error);
        setTemPendencia(false);
        setAlertasEquipe([]);
      } finally {
        setCarregando(false);
      }
    }

    // 1. Executa a busca inicial (quando o utilizador dá F5)
    supabase.auth.getSession().then(({ data: { session } }) => {
      atualizarEstado(session);
    });

    // 2. "Escuta" ativamente logins e logouts em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      atualizarEstado(session);
    });


    const recarregarNavbar = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        atualizarEstado(session);
      });
    };
    window.addEventListener("perfilAtualizado", recarregarNavbar);
    window.addEventListener("painelAtualizado", recarregarNavbar);

    // Limpeza dos listeners quando o componente é desmontado
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("perfilAtualizado", recarregarNavbar); // NOVO
      window.removeEventListener("painelAtualizado", recarregarNavbar);
    };
  }, []);

  useEffect(() => {
    const fecharAoClicarFora = (event: MouseEvent | TouchEvent) => {
      const alvo = event.target as Node;

      if (menuRef.current && !menuRef.current.contains(alvo)) {
        setMenuAberto(false);
      }

      if (notificacaoRef.current && !notificacaoRef.current.contains(alvo)) {
        setNotificacaoAberta(false);
      }
    };

    document.addEventListener("mousedown", fecharAoClicarFora);
    document.addEventListener("touchstart", fecharAoClicarFora);

    return () => {
      document.removeEventListener("mousedown", fecharAoClicarFora);
      document.removeEventListener("touchstart", fecharAoClicarFora);
    };
  }, []);

  const fazerLogout = async () => {
    await supabase.auth.signOut();
    setUsuarioLogado(null);
    setPerfil(null);
    setMenuAberto(false);
    router.push("/entrar");
  };

  const painelLabel =
    perfil?.tipo === "admin"
      ? "Painel Admin"
      : perfil?.tipo === "professor"
        ? "Painel Professor"
        : "Painel";
  const possuiNotificacoes = temPendencia || alertasEquipe.length > 0;
  const alertasEquipeVisiveis = alertasEquipe.slice(0, 4);

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
              onClick={() => {
                if (isAdminRoute) {
                  router.push("/");
                  return;
                }

                router.back();
              }}
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
        <div className="flex-1 flex justify-end gap-2 sm:gap-3 items-center">
          {carregando ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          ) : usuarioLogado && perfil ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative" ref={menuRef}>
                <button 
                  onClick={() => {
                    setMenuAberto((prev) => {
                      const proximo = !prev;
                      if (proximo) setNotificacaoAberta(false);
                      return proximo;
                    });
                  }}
                  className="flex items-center gap-3 hover:bg-slate-900 p-1.5 pr-2 sm:pr-4 rounded-full border border-slate-800 transition-all"
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
                      {(perfil.tipo === 'admin' || perfil.tipo === 'professor') && (
                        <>
                          <Link
                            href="/admin"
                            onClick={() => setMenuAberto(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <ShieldCheck className="w-4 h-4" /> {painelLabel}
                          </Link>
                          <div className="h-px bg-slate-800 my-2"></div>
                        </>
                      )}
                      <Link href="/agenda" onClick={() => setMenuAberto(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                        <CalendarDays className="w-4 h-4" /> Minha Agenda
                      </Link>
                      <Link href="/perfil" onClick={() => setMenuAberto(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
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

              <div className="relative" ref={notificacaoRef}>
                <button 
                  onClick={() => {
                    setNotificacaoAberta((prev) => {
                      const proximo = !prev;
                      if (proximo) setMenuAberto(false);
                      return proximo;
                    });
                  }}
                  className="p-2 text-slate-400 hover:text-white transition-colors relative bg-slate-900/50 rounded-full border border-slate-800/50 hover:border-orange-500/50"
                >
                  <Bell className="w-6 h-6" />
                  {possuiNotificacoes && (
                    <span className="absolute top-2 right-2 w-3 h-3 bg-orange-500 rounded-full border-2 border-slate-950 animate-pulse"></span>
                  )}
                </button>

                <AnimatePresence>
                  {notificacaoAberta && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-80 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-4 z-50"
                    >
                      <h4 className="text-white font-bold mb-2 text-sm">Notificações</h4>
                      <div className="h-px bg-slate-800 mb-3" />
                      {alertasEquipe.length > 0 || temPendencia ? (
                        <div className="space-y-3">
                          {alertasEquipe.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Pendências vencidas
                              </p>
                              {alertasEquipeVisiveis.map((alerta) => {
                                const atrasoHoras = Math.max(1, alerta.horas_em_aberto - alerta.prazo_horas);
                                const complemento =
                                  alerta.total_turmas_relacionadas > 1
                                    ? `${alerta.total_turmas_relacionadas} turmas`
                                    : alerta.dia_semana && alerta.horario
                                      ? `${alerta.dia_semana.substring(0, 3)} ${alerta.horario.substring(0, 5)}`
                                      : "Abrir em Matriculados";

                                return (
                                  <Link
                                    key={alerta.chave}
                                    href="/admin/matriculas"
                                    onClick={() => setNotificacaoAberta(false)}
                                    className="block rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 hover:bg-amber-500/15 transition-all"
                                  >
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-amber-300">
                                          {obterLabelStatusPendencia(alerta.status)} vencida
                                        </p>
                                        <p className="mt-0.5 text-[12px] font-semibold text-white leading-tight">
                                          {alerta.nome_aluno}
                                        </p>
                                        <p className="mt-1 text-[11px] text-slate-300 leading-tight">
                                          Há {formatarTempoAbertoPendencia(atrasoHoras)} • {complemento}
                                        </p>
                                      </div>
                                    </div>
                                  </Link>
                                );
                              })}
                              {alertasEquipe.length > alertasEquipeVisiveis.length && (
                                <Link
                                  href="/admin/matriculas"
                                  onClick={() => setNotificacaoAberta(false)}
                                  className="block text-center text-[11px] font-bold text-orange-400 hover:text-orange-300 transition-colors"
                                >
                                  Ver todas em Matriculados
                                </Link>
                              )}
                            </div>
                          )}

                          {temPendencia && (
                            <>
                              {alertasEquipe.length > 0 && <div className="h-px bg-slate-800" />}
                              <Link 
                                href="/perfil" 
                                onClick={() => setNotificacaoAberta(false)}
                                className="block p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl hover:bg-orange-500/20 transition-all"
                              >
                                <p className="text-xs text-orange-400 font-bold mb-1">Dados pendentes</p>
                                <p className="text-[11px] text-slate-400 leading-tight">Complete seus dados no perfil para validar a matrícula.</p>
                              </Link>
                            </>
                          )}
                        </div>
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
