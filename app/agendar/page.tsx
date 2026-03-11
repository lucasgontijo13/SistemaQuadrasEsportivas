"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Users, CheckCircle2, Loader2, X, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

const diasSemana = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default function AgendarPage() {
  const [diaSelecionado, setDiaSelecionado] = useState("Segunda");
  const [turmas, setTurmas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estados do Modal do Aluno
  const [modalAberto, setModalAberto] = useState(false);
  const [turmaSelecionada, setTurmaSelecionada] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  
  // Dados rápidos do Aluno
  const [dadosAluno, setDadosAluno] = useState({ nome: "", email: "", whatsapp: "" });

  useEffect(() => {
    async function buscarTurmas() {
      setCarregando(true);
      const { data } = await supabase.from('turmas').select('*');
      if (data) setTurmas(data);
      setCarregando(false);
    }
    buscarTurmas();
  }, []);

  const abrirModal = (turma: any) => {
    setTurmaSelecionada(turma);
    setSucesso(false);
    setModalAberto(true);
  };

  const confirmarAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);

    // 1. Cria o usuário "silenciosamente" no Auth do Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: dadosAluno.email,
      password: `Arena${dadosAluno.whatsapp}` // Senha temporária baseada no whats
    });

    if (authData.user) {
      // 2. Salva o Perfil
      await supabase.from('perfis').insert([{
        id: authData.user.id,
        nome: dadosAluno.nome,
        whatsapp: dadosAluno.whatsapp,
        tipo: 'aluno'
      }]);

      // 3. Vincula o aluno à turma como 'experimental'
      await supabase.from('matriculas').insert([{
        perfil_id: authData.user.id,
        turma_id: turmaSelecionada.id,
        status: 'experimental'
      }]);

      setSucesso(true);
    } else {
      alert("Erro ao agendar. Tente novamente.");
    }
    setSalvando(false);
  };

  const turmasDoDia = turmas.filter((turma) => turma.dia_semana === diaSelecionado);

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-orange-500 selection:text-white pb-20 relative">
      
      {/* MODAL DE AGENDAMENTO RÁPIDO */}
      <AnimatePresence>
        {modalAberto && turmaSelecionada && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalAberto(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-slate-900 border-t sm:border border-slate-800 p-8 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-md relative z-10">
              <button onClick={() => setModalAberto(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white bg-slate-800/50 p-2 rounded-full"><X className="w-5 h-5" /></button>
              
              {!sucesso ? (
                <>
                  <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Aula Experimental</h2>
                  <p className="text-slate-400 text-sm mb-6">Turma de {turmaSelecionada.dia_semana} às {turmaSelecionada.horario.substring(0,5)}</p>

                  <form onSubmit={confirmarAgendamento} className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nome Completo</label>
                      <input type="text" required placeholder="Ex: Lucas Silva" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500" value={dadosAluno.nome} onChange={e => setDadosAluno({...dadosAluno, nome: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">WhatsApp</label>
                      <input type="tel" required placeholder="(00) 00000-0000" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500" value={dadosAluno.whatsapp} onChange={e => setDadosAluno({...dadosAluno, whatsapp: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">E-mail</label>
                      <input type="email" required placeholder="seu@email.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500" value={dadosAluno.email} onChange={e => setDadosAluno({...dadosAluno, email: e.target.value})} />
                    </div>

                    <button type="submit" disabled={salvando} className="w-full mt-6 py-4 bg-orange-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-orange-600 transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                      {salvando ? "Reservando vaga..." : "Garantir Minha Vaga"} <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Vaga Confirmada!</h2>
                  <p className="text-slate-400 mb-8">Te esperamos na areia, {dadosAluno.nome.split(" ")[0]}! O professor entrará em contato pelo WhatsApp.</p>
                  <button onClick={() => setModalAberto(false)} className="w-full py-4 bg-slate-800 text-white font-bold text-sm rounded-xl hover:bg-slate-700 transition-colors">Voltar para horários</button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HEADER NORMAL */}
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"><ChevronLeft className="w-5 h-5" /><span className="font-medium text-sm">Voltar</span></Link>
          <div className="font-bold text-xl tracking-tighter text-white">Arena<span className="text-orange-500">.Pro</span></div>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">Grade de Horários</h1>
          <p className="text-slate-400">Escolha o seu dia fixo na semana e garanta sua vaga na turma.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-10">
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6 sm:mx-0 sm:px-0">
            {diasSemana.map((dia) => (
              <button key={dia} onClick={() => setDiaSelecionado(dia)} className={`flex-shrink-0 px-6 py-4 rounded-2xl border transition-all ${diaSelecionado === dia ? "bg-orange-500 border-orange-400 text-slate-950 shadow-[0_0_20px_rgba(249,115,22,0.3)]" : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"}`}>
                <span className={`text-base font-bold tracking-wide ${diaSelecionado === dia ? "text-slate-950" : ""}`}>{dia}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {carregando ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500"><Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-4" /><p>Buscando turmas no banco de dados...</p></div>
        ) : turmasDoDia.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/50 text-slate-500"><p>Nenhuma turma cadastrada para este dia ainda.</p></div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
            {turmasDoDia.map((turma) => (
              <motion.div key={turma.id} variants={item} className={`p-5 rounded-2xl border bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-6`}>
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold bg-slate-800 text-white">{turma.horario.substring(0, 5)}</div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">{turma.nivel}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-400"><span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Prof. {turma.professor}</span></div>
                  </div>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-3 border-t border-slate-800 sm:border-t-0 pt-4 sm:pt-0">
                  <button onClick={() => abrirModal(turma)} className="w-full sm:w-auto px-8 py-3 rounded-full font-bold text-sm transition-all bg-white text-slate-950 hover:bg-slate-200 active:scale-95 shadow-lg">
                    Fazer Aula Experimental
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}