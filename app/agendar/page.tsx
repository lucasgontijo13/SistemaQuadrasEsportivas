"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, Users, CheckCircle2, Loader2, 
  X, ArrowRight, Lock, Eye, EyeOff 
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
const diasSemana = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

// Função de Máscara para WhatsApp
const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(-\d{4})\d+?$/, "$1");
};

export default function AgendarPage() {
  const router = useRouter();
  const [diaSelecionado, setDiaSelecionado] = useState("Segunda");
  const [turmas, setTurmas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [turmaSelecionada, setTurmaSelecionada] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  
  // Estados para controle de visualização de senha
  const [verSenha, setVerSenha] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);

  const [dadosAluno, setDadosAluno] = useState({ 
    nome: "", 
    email: "", 
    whatsapp: "", 
    senha: "", 
    confirmarSenha: "" 
  });
  const [erroAgendamento, setErroAgendamento] = useState("");

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
    setErroAgendamento("");
    setModalAberto(true);
  };

  const confirmarAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErroAgendamento("");

    const whatsappLimpo = dadosAluno.whatsapp.replace(/\D/g, "");

    // 1. Verificar se o Telefone/WhatsApp já existe
    const { data: telefoneExiste } = await supabase
      .from('perfis')
      .select('id')
      .eq('whatsapp', whatsappLimpo)
      .single();

    if (telefoneExiste) {
      setErroAgendamento("Este número de WhatsApp já está cadastrado em nosso sistema.");
      setSalvando(false);
      return;
    }

    // 2. Criar conta no Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: dadosAluno.email,
      password: dadosAluno.senha,
    });

    if (authError) {
      setErroAgendamento(authError.message);
      setSalvando(false);
      return;
    }

    if (authData.user) {
      // 3. Insere o perfil e a matrícula
      await supabase.from('perfis').insert([{
        id: authData.user.id,
        nome: dadosAluno.nome,
        whatsapp: whatsappLimpo,
        email: dadosAluno.email,
        tipo: 'aluno'
      }]);

      await supabase.from('matriculas').insert([{
        perfil_id: authData.user.id,
        turma_id: turmaSelecionada.id,
        status: 'experimental'
      }]);

      setSucesso(true); 
    
    }
    setSalvando(false);
  };

  const turmasDoDia = turmas.filter((turma) => turma.dia_semana === diaSelecionado);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-orange-500 selection:text-white pb-20 relative">
      
      <AnimatePresence>
        {modalAberto && turmaSelecionada && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalAberto(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }} 
              className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-2xl w-full max-w-md relative z-10 max-h-[90vh] overflow-y-auto scrollbar-hide"
            >
              <button onClick={() => setModalAberto(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white bg-slate-800/50 p-2 rounded-full"><X className="w-5 h-5" /></button>
              
              {!sucesso ? (
                <>
                  <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Aula Experimental</h2>
                  <p className="text-slate-400 text-sm mb-6">Turma de {turmaSelecionada.dia_semana} às {turmaSelecionada.horario.substring(0,5)}</p>

                  <form onSubmit={confirmarAgendamento} className="space-y-4">
                    {erroAgendamento && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm font-medium mb-4">
                        {erroAgendamento}
                      </div>
                    )}
                    
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nome Completo</label>
                      <input type="text" required placeholder="Ex: Lucas Silva" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500" value={dadosAluno.nome} onChange={e => setDadosAluno({...dadosAluno, nome: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">WhatsApp</label>
                        <input 
                          type="tel" 
                          required 
                          placeholder="(00) 00000-0000" 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500" 
                          value={dadosAluno.whatsapp} 
                          onChange={e => setDadosAluno({...dadosAluno, whatsapp: maskPhone(e.target.value)})} 
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">E-mail</label>
                        <input type="email" required placeholder="seu@email.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-orange-500" value={dadosAluno.email} onChange={e => setDadosAluno({...dadosAluno, email: e.target.value})} />
                      </div>
                    </div>

                    {/* CAMPOS DE SENHA */}
                    <div className="space-y-4">
                      <div className="relative">
                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block text-orange-400 flex items-center gap-2">
                          <Lock className="w-3 h-3" /> Criar Senha
                        </label>
                        <div className="relative">
                          <input 
                            type={verSenha ? "text" : "password"} 
                            required 
                            minLength={6}
                            placeholder="Mínimo 6 caracteres" 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-10 text-white outline-none focus:border-orange-500 transition-all" 
                            value={dadosAluno.senha} 
                            onChange={e => setDadosAluno({...dadosAluno, senha: e.target.value})} 
                          />
                          <button 
                            type="button" 
                            onClick={() => setVerSenha(!verSenha)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                          >
                            {verSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Confirmar Senha</label>
                        <div className="relative">
                          <input 
                            type={verConfirmar ? "text" : "password"} 
                            required 
                            placeholder="Repita sua senha" 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-10 text-white outline-none focus:border-orange-500 transition-all" 
                            value={dadosAluno.confirmarSenha} 
                            onChange={e => setDadosAluno({...dadosAluno, confirmarSenha: e.target.value})} 
                          />
                          <button 
                            type="button" 
                            onClick={() => setVerConfirmar(!verConfirmar)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                          >
                            {verConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
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
                  <p className="text-slate-400 mb-8">
                    Te esperamos na areia! Agora sua vaga está garantida e sua conta está pronta.
                  </p>
                  
                  {/* Botão de redirecionamento manual */}
                  <Link 
                    href="/agenda" 
                    className="block w-full py-4 bg-orange-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-orange-600 transition-colors text-center"
                  >
                    Concluir
                  </Link>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cabeçalho e Listagem de Horários permanecem iguais ao seu código original */}
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

        {/* ... Restante da sua Main (Filtros e Cards) ... */}
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
          <div className="flex flex-col items-center justify-center py-20 text-slate-500"><Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-4" /><p>Buscando turmas...</p></div>
        ) : (
          <motion.div className="space-y-4">
            {turmasDoDia.map((turma) => (
              <motion.div key={turma.id} className="p-5 rounded-2xl border bg-slate-900/80 border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold bg-slate-800 text-white">{turma.horario.substring(0, 5)}</div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">{turma.nivel}</h3>
                    <div className="text-sm text-slate-400 flex items-center gap-1.5"><Users className="w-4 h-4" /> Prof. {turma.professor}</div>
                  </div>
                </div>
                <button onClick={() => abrirModal(turma)} className="px-8 py-3 rounded-full font-bold text-sm bg-white text-slate-950 hover:bg-slate-200 shadow-lg">
                  Fazer Aula Experimental
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}