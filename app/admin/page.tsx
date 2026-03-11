"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Activity, ChevronLeft, CheckCircle2, AlertCircle, 
  Loader2, CalendarDays, Plus, Trash2, X, Clock, MapPin, Edit2, UserCheck 
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"alunos" | "turmas" | "aluguel">("alunos");
  
  const [matriculas, setMatriculas] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [horariosQuadra, setHorariosQuadra] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [tipoModal, setTipoModal] = useState<"turma" | "quadra" | "editar_turma" | "efetivar_aluno">("turma");
  const [idEdicao, setIdEdicao] = useState<number | null>(null);
  
  const [novaTurma, setNovaTurma] = useState({ dia_semana: "Segunda", horario: "18:00", nivel: "Iniciante", professor: "João Paulo", vagas_totais: 6 });
  const [novoHorarioQuadra, setNovoHorarioQuadra] = useState({ dia_semana: "Sábado", horario_inicio: "08:00", horario_fim: "09:00", preco: "R$ 80,00" });
  
  const [dadosEfetivacao, setDadosEfetivacao] = useState<{ matriculaId: number, perfilId: string, nomeAluno: string, nivel: string, turmasIds: number[] }>({ 
    matriculaId: 0, perfilId: "", nomeAluno: "", nivel: "Iniciante", turmasIds: [] 
  });
  
  const [diaFiltroModal, setDiaFiltroModal] = useState("Segunda");
  const diasDaSemanaModal = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

  const buscarDados = async () => {
    setCarregando(true);
    const { data: dadosMatriculas } = await supabase.from('matriculas').select(`id, status, perfil_id, turma_id, perfis(id, nome, nivel), turmas(id, dia_semana, horario)`).order('created_at', { ascending: false });
    if (dadosMatriculas) setMatriculas(dadosMatriculas);

    const { data: dadosTurmas } = await supabase.from('turmas').select('*').order('id', { ascending: true });
    if (dadosTurmas) setTurmas(dadosTurmas);

    const { data: dadosQuadra } = await supabase.from('horarios_quadra').select('*').order('id', { ascending: true });
    if (dadosQuadra) setHorariosQuadra(dadosQuadra);
    setCarregando(false);
  };

  useEffect(() => {
    async function verificarAcessoEBuscarDados() {
      // 1. Quem é o usuário logado agora?
      const { data: authData } = await supabase.auth.getUser();
      
      if (!authData.user) {
        // Ninguém logado? Vai pra home.
        router.push("/");
        return;
      }

      // 2. Qual é o tipo desse usuário na nossa tabela de perfis?
      const { data: perfil } = await supabase
        .from('perfis')
        .select('tipo')
        .eq('id', authData.user.id)
        .single();

      if (!perfil || (perfil.tipo !== 'admin' && perfil.tipo !== 'professor')) {
        // É um aluno tentando dar uma de espertinho? Expulsa pra home.
        alert("Acesso negado. Área restrita para professores.");
        router.push("/");
        return;
      }

      // 3. Se chegou aqui, ele é admin/professor! Libera a tela e busca os dados.
      setAutorizado(true);
      
      setCarregando(true);
      const { data: dadosMatriculas } = await supabase.from('matriculas').select(`id, status, perfil_id, turma_id, perfis(id, nome, nivel), turmas(id, dia_semana, horario)`).order('created_at', { ascending: false });
      if (dadosMatriculas) setMatriculas(dadosMatriculas);

      const { data: dadosTurmas } = await supabase.from('turmas').select('*').order('id', { ascending: true });
      if (dadosTurmas) setTurmas(dadosTurmas);

      const { data: dadosQuadra } = await supabase.from('horarios_quadra').select('*').order('id', { ascending: true });
      if (dadosQuadra) setHorariosQuadra(dadosQuadra);
      setCarregando(false);
    }
    
    verificarAcessoEBuscarDados();
  }, [router]);

  const abrirModalEfetivar = (mat: any) => {
    setDadosEfetivacao({
      matriculaId: mat.id,
      perfilId: mat.perfil_id || mat.perfis?.id,
      nomeAluno: mat.perfis?.nome || "Aluno",
      nivel: mat.perfis?.nivel || "Iniciante",
      turmasIds: [mat.turma_id || mat.turmas?.id] 
    });
    setDiaFiltroModal(mat.turmas?.dia_semana || "Segunda"); 
    setTipoModal("efetivar_aluno");
    setModalAberto(true);
  };

  const toggleTurmaEfetivacao = (idTurma: number) => {
    setDadosEfetivacao(prev => {
      const jaSelecionado = prev.turmasIds.includes(idTurma);
      return {
        ...prev,
        turmasIds: jaSelecionado ? prev.turmasIds.filter(id => id !== idTurma) : [...prev.turmasIds, idTurma]
      };
    });
  };

  const salvarDados = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    
    if (tipoModal === "turma") {
      await supabase.from('turmas').insert([novaTurma]);
      buscarDados();
    } 
    else if (tipoModal === "editar_turma" && idEdicao) {
      await supabase.from('turmas').update(novaTurma).eq('id', idEdicao);
      buscarDados();
    } 
    else if (tipoModal === "quadra") {
      await supabase.from('horarios_quadra').insert([novoHorarioQuadra]);
      buscarDados();
    }
    else if (tipoModal === "efetivar_aluno") {
      if (dadosEfetivacao.turmasIds.length === 0) {
        alert("Selecione pelo menos uma turma!");
        setCarregando(false);
        return;
      }
      await supabase.from('perfis').update({ nivel: dadosEfetivacao.nivel }).eq('id', dadosEfetivacao.perfilId);
      await supabase.from('matriculas').delete().eq('id', dadosEfetivacao.matriculaId);
      
      const novasMatriculas = dadosEfetivacao.turmasIds.map(tId => ({
        perfil_id: dadosEfetivacao.perfilId,
        turma_id: tId,
        status: 'ativo'
      }));
      await supabase.from('matriculas').insert(novasMatriculas);
      buscarDados();
    }
    setModalAberto(false);
  };

  const excluirItem = async (id: number, tabela: "turmas" | "horarios_quadra" | "matriculas") => {
    if(!window.confirm("Tem certeza que deseja excluir?")) return;
    await supabase.from(tabela).delete().eq('id', id);
    buscarDados();
  };

  const abrirModal = (tipo: "turma" | "quadra") => {
    setIdEdicao(null);
    if (tipo === "turma") setNovaTurma({ dia_semana: "Segunda", horario: "18:00", nivel: "Iniciante", professor: "João Paulo", vagas_totais: 6 });
    setTipoModal(tipo);
    setModalAberto(true);
  };

  const abrirModalEdicao = (turmaExistente: any) => {
    setNovaTurma({ dia_semana: turmaExistente.dia_semana, horario: turmaExistente.horario, nivel: turmaExistente.nivel, professor: turmaExistente.professor, vagas_totais: turmaExistente.vagas_totais });
    setIdEdicao(turmaExistente.id);
    setTipoModal("editar_turma");
    setModalAberto(true);
  };

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  const turmasFiltradasNoModal = turmas.filter(t => t.dia_semana === diaFiltroModal);
  if (!autorizado) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;
  }
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-orange-500 selection:text-white pb-24 relative">
      
      {/* MODAL FLUTUANTE CENTRALIZADO */}
      <AnimatePresence>
        {modalAberto && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalAberto(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            {/* Agora ele nasce sempre do centro, com as bordas todas arredondadas e flutuando */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-[2rem] shadow-2xl w-full max-w-md relative z-10 max-h-[85vh] overflow-y-auto scrollbar-hide"
            >
              
              <button onClick={() => setModalAberto(false)} className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors bg-slate-800/50 p-2 rounded-full"><X className="w-5 h-5" /></button>
              
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 tracking-tight pr-10">
                {tipoModal === "turma" ? "Nova Turma" : tipoModal === "editar_turma" ? "Editar Turma" : tipoModal === "quadra" ? "Novo Horário" : "Efetivar Aluno"}
              </h2>

              <form onSubmit={salvarDados} className="space-y-4">
                
                {tipoModal === "efetivar_aluno" && (
                  <>
                    <div className="mb-4 p-3 sm:p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-lg sm:text-xl flex-shrink-0">{dadosEfetivacao.nomeAluno.charAt(0)}</div>
                      <div>
                        <h3 className="font-bold text-orange-400 text-sm sm:text-base leading-tight">{dadosEfetivacao.nomeAluno}</h3>
                        <p className="text-xs sm:text-sm text-slate-400">Aula Experimental</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nível do Aluno</label>
                      <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={dadosEfetivacao.nivel} onChange={e => setDadosEfetivacao({...dadosEfetivacao, nivel: e.target.value})}>
                        <option>Iniciante</option><option>Intermediário</option><option>Avançado</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Turmas Definitivas</label>
                        <span className="text-xs font-bold bg-slate-800 text-orange-500 px-2 py-0.5 rounded-md">
                          {dadosEfetivacao.turmasIds.length} selec.
                        </span>
                      </div>
                      
                      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
                        {diasDaSemanaModal.map(dia => {
                          const temTurmaNesteDia = turmas.some(t => t.dia_semana === dia && dadosEfetivacao.turmasIds.includes(t.id));
                          return (
                            <button
                              key={dia}
                              type="button"
                              onClick={() => setDiaFiltroModal(dia)}
                              className={`flex-shrink-0 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                                diaFiltroModal === dia ? "bg-slate-700 text-white" : "bg-slate-950 text-slate-500 border border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              {dia.substring(0,3)}
                              {temTurmaNesteDia && <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>}
                            </button>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {turmasFiltradasNoModal.length === 0 ? (
                          <p className="text-xs text-slate-500 col-span-1 sm:col-span-2 py-3 text-center bg-slate-950 rounded-xl border border-slate-800">
                            Sem turmas neste dia.
                          </p>
                        ) : (
                          turmasFiltradasNoModal.map(t => {
                            const selecionado = dadosEfetivacao.turmasIds.includes(t.id);
                            return (
                              <div 
                                key={t.id} 
                                onClick={() => toggleTurmaEfetivacao(t.id)}
                                className={`cursor-pointer border rounded-xl p-3 text-sm transition-all flex justify-between items-center ${
                                  selecionado ? "bg-orange-500/10 border-orange-500 text-orange-400" : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-bold">{t.dia_semana.substring(0,3)}</span>
                                    <span className={selecionado ? "text-white font-bold" : "text-slate-300 font-bold"}>{t.horario.substring(0,5)}</span>
                                  </div>
                                  <div className="text-[11px] uppercase tracking-wider">{t.nivel}</div>
                                </div>
                                {selecionado && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}

                {(tipoModal === "turma" || tipoModal === "editar_turma" || tipoModal === "quadra") && (
                  <div>
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Dia da Semana</label>
                    <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={tipoModal === "quadra" ? novoHorarioQuadra.dia_semana : novaTurma.dia_semana} onChange={e => tipoModal === "quadra" ? setNovoHorarioQuadra({...novoHorarioQuadra, dia_semana: e.target.value}) : setNovaTurma({...novaTurma, dia_semana: e.target.value})}>
                      <option>Segunda</option><option>Terça</option><option>Quarta</option><option>Quinta</option><option>Sexta</option><option>Sábado</option><option>Domingo</option>
                    </select>
                  </div>
                )}

                {(tipoModal === "turma" || tipoModal === "editar_turma") && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Horário</label><input type="time" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={novaTurma.horario} onChange={e => setNovaTurma({...novaTurma, horario: e.target.value})} /></div>
                      <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Vagas</label><input type="number" min="1" max="12" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={novaTurma.vagas_totais} onChange={e => setNovaTurma({...novaTurma, vagas_totais: Number(e.target.value)})} /></div>
                    </div>
                    <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nível</label><select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={novaTurma.nivel} onChange={e => setNovaTurma({...novaTurma, nivel: e.target.value})}><option>Iniciante</option><option>Intermediário</option><option>Avançado</option></select></div>
                  </>
                )}

                {tipoModal === "quadra" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Início</label><input type="time" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={novoHorarioQuadra.horario_inicio} onChange={e => setNovoHorarioQuadra({...novoHorarioQuadra, horario_inicio: e.target.value})} /></div>
                      <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Fim</label><input type="time" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={novoHorarioQuadra.horario_fim} onChange={e => setNovoHorarioQuadra({...novoHorarioQuadra, horario_fim: e.target.value})} /></div>
                    </div>
                    <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Valor (R$)</label><input type="text" placeholder="Ex: R$ 80,00" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500 text-sm" value={novoHorarioQuadra.preco} onChange={e => setNovoHorarioQuadra({...novoHorarioQuadra, preco: e.target.value})} /></div>
                  </>
                )}

                <button type="submit" disabled={carregando} className="w-full mt-6 py-4 bg-orange-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-orange-600 transition-colors shadow-lg disabled:opacity-50">
                  {carregando ? "Processando..." : tipoModal === "editar_turma" ? "Salvar Alterações" : tipoModal === "efetivar_aluno" ? "Confirmar Matrículas" : "Salvar no Sistema"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="font-bold text-lg sm:text-xl tracking-tighter text-white flex items-center gap-2 sm:gap-3">
            Arena<span className="text-orange-500">.Pro</span>
            <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-slate-800 text-slate-400 text-[10px] sm:text-xs rounded-md uppercase tracking-wider font-semibold">Admin</span>
          </div>
          <Link href="/" className="text-xs sm:text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Sair</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Painel de Controle</h1>
          <p className="text-sm sm:text-base text-slate-400 mt-1">Gerencie alunos e horários.</p>
        </div>

        {/* ABAS COM ROLAGEM HORIZONTAL NO CELULAR */}
        <div className="flex bg-slate-900 p-1 rounded-xl mb-8 border border-slate-800 max-w-3xl overflow-x-auto scrollbar-hide">
          <button onClick={() => setAbaAtiva("alunos")} className={`flex-shrink-0 flex-1 flex items-center justify-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold rounded-lg transition-all ${abaAtiva === "alunos" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}><Users className="w-4 h-4" /> Alunos</button>
          <button onClick={() => setAbaAtiva("turmas")} className={`flex-shrink-0 flex-1 flex items-center justify-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold rounded-lg transition-all ${abaAtiva === "turmas" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}><CalendarDays className="w-4 h-4" /> Turmas</button>
          <button onClick={() => setAbaAtiva("aluguel")} className={`flex-shrink-0 flex-1 flex items-center justify-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold rounded-lg transition-all ${abaAtiva === "aluguel" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}><MapPin className="w-4 h-4" /> Quadras</button>
        </div>

        {carregando && turmas.length === 0 && matriculas.length === 0 ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        ) : (
          <>
            {abaAtiva === "alunos" && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                {matriculas.length === 0 ? (
                  <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/50 text-slate-500 text-sm">Nenhum aluno cadastrado.</div>
                ) : (
                  <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
                    {matriculas.map((mat) => (
                      <motion.div key={mat.id} variants={item} className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 flex-shrink-0">{mat.perfis?.nome?.charAt(0) || "?"}</div>
                          <div>
                            <h3 className="font-bold text-white flex flex-wrap items-center gap-2 text-sm sm:text-base leading-tight">
                              {mat.perfis?.nome || "Aluno"}
                              {mat.status === "experimental" && <span className="text-[9px] sm:text-[10px] bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full uppercase">Exp.</span>}
                              {mat.status === "ativo" && <span className="text-[9px] sm:text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full uppercase">Ativo</span>}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                              Nível {mat.perfis?.nivel || "N/A"} • {mat.turmas?.dia_semana.substring(0,3)} às {mat.turmas?.horario?.substring(0,5)}
                            </p>
                          </div>
                        </div>
                        
                        {/* Botões empilhados no celular, alinhados no PC */}
                        <div className="flex items-center gap-2 w-full sm:w-auto border-t border-slate-800 pt-3 sm:border-t-0 sm:pt-0">
                          {mat.status === "experimental" && (
                            <button onClick={() => abrirModalEfetivar(mat)} className="flex-1 sm:flex-none justify-center px-4 py-2 sm:py-2.5 bg-emerald-500 text-slate-950 font-bold text-xs sm:text-sm rounded-xl hover:bg-emerald-600 transition-colors flex items-center gap-2"><UserCheck className="w-4 h-4" /> Efetivar</button>
                          )}
                          <button onClick={() => excluirItem(mat.id, 'matriculas')} className="p-2 sm:p-2.5 text-slate-500 bg-slate-800 sm:bg-transparent hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all sm:opacity-0 group-hover:opacity-100 flex-shrink-0"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}

            {abaAtiva === "turmas" && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Turmas (Aulas)</h2>
                    <p className="text-xs sm:text-sm text-slate-400">Grade fixa do professor.</p>
                  </div>
                  <button onClick={() => abrirModal("turma")} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-slate-950 px-4 py-3 sm:py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"><Plus className="w-4 h-4" /> Nova Turma</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {turmas.map(turma => (
                    <div key={`turma-${turma.id}`} className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:justify-between sm:items-center group gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1"><span className="font-bold text-white text-base sm:text-lg">{turma.dia_semana}</span><span className="text-orange-500 font-bold text-base sm:text-lg">{turma.horario.substring(0,5)}</span></div>
                        <p className="text-xs sm:text-sm text-slate-400">{turma.nivel} • {turma.vagas_totais} vagas</p>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto border-t border-slate-800 pt-3 sm:border-t-0 sm:pt-0 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => abrirModalEdicao(turma)} className="flex-1 sm:flex-none flex justify-center p-2.5 text-slate-400 bg-slate-800 sm:bg-transparent hover:text-white hover:bg-slate-800 rounded-xl transition-all"><Edit2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                        <button onClick={() => excluirItem(turma.id, 'turmas')} className="flex-1 sm:flex-none flex justify-center p-2.5 text-slate-400 bg-slate-800 sm:bg-transparent hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {abaAtiva === "aluguel" && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Aluguel de Quadra</h2>
                    <p className="text-xs sm:text-sm text-slate-400">Horários para locação.</p>
                  </div>
                  <button onClick={() => abrirModal("quadra")} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 text-white px-4 py-3 sm:py-2.5 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"><Clock className="w-4 h-4 text-orange-500" /> Novo Horário</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {horariosQuadra.map(hq => (
                    <div key={`quadra-${hq.id}`} className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:justify-between sm:items-center group gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1"><span className="font-bold text-white text-base sm:text-lg">{hq.dia_semana}</span><span className="text-orange-500 font-bold text-base sm:text-lg">{hq.horario_inicio.substring(0,5)} às {hq.horario_fim.substring(0,5)}</span></div>
                        <p className="text-xs sm:text-sm text-emerald-400 font-bold">{hq.preco}</p>
                      </div>
                      <div className="flex justify-end w-full sm:w-auto border-t border-slate-800 pt-3 sm:border-t-0 sm:pt-0 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => excluirItem(hq.id, 'horarios_quadra')} className="w-full sm:w-auto flex justify-center p-2.5 text-slate-400 bg-slate-800 sm:bg-transparent hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
      </main>
    </div>
  );
}