"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, ChevronLeft, CheckCircle2, Loader2, CalendarDays, Plus, 
  Trash2, X, Clock, MapPin, Edit2, UserCheck, Shield, UserPlus, AlertCircle, AlertTriangle 
} from "lucide-react";

import { Turma, HorarioQuadra, Matricula, Perfil } from "@/types";
import { 
  verificarPermissaoAdmin, buscarDadosPainel, excluirRegistro, salvarTurma, 
  salvarQuadra, efetivarMatricula, atualizarPerfil,
  cadastrarNovoProfessor, excluirProfessor 
} from "@/services/adminService";



const maskPhone = (value: string) => {
  if (!value) return "";
  
  return value
    .replace(/\D/g, "") // Tira tudo que não é número
    .replace(/(\d{2})(\d)/, "($1) $2") // Coloca o parênteses DDD
    .replace(/(\d{5})(\d)/, "$1-$2") // Coloca o hífen depois do 5º dígito
    .replace(/(-\d{4})\d+?$/, "$1"); // Impede de digitar mais que 15 caracteres
};

export default function AdminDashboard() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"alunos" | "turmas" | "aluguel" | "professores">("alunos");
  const [modalConfirmacao, setModalConfirmacao] = useState({ aberto: false, titulo: "", mensagem: "", acao: () => {} });
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [horariosQuadra, setHorariosQuadra] = useState<HorarioQuadra[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [tipoLogado, setTipoLogado] = useState<string>(""); // Para saber se é admin ou professor
  const [professores, setProfessores] = useState<Perfil[]>([]); // Lista de professores
  

  // Adicione o modal de sucesso junto do modal de confirmação
  const [modalSucesso, setModalSucesso] = useState({ aberto: false, titulo: "", mensagem: "" });
  
  // Atualize o tipoModal para aceitar "editar_professor"
  const [tipoModal, setTipoModal] = useState<"turma" | "quadra" | "editar_turma" | "efetivar_aluno" | "ver_aluno" | "editar_aluno" | "professor" | "editar_professor">("turma");
  
  // Novo estado para guardar o ID do professor que está a ser editado
  const [idEdicaoProfessor, setIdEdicaoProfessor] = useState<string | null>(null);

  // Adicione 'professor' no tipoModal
  
  const [novoProfessor, setNovoProfessor] = useState({ nome: "", email: "", whatsapp: "", senha: "" });

  const [erroModal, setErroModal] = useState("");
  // 2. Adicione este estado para controlar o nível no formulário
  const [nivelEdicao, setNivelEdicao] = useState("");
  
  const [idEdicao, setIdEdicao] = useState<number | null>(null);
  const [alunoSelecionado, setAlunoSelecionado] = useState<Matricula | null>(null);
  const [novaTurma, setNovaTurma] = useState({ dia_semana: "Segunda", horario: "18:00", nivel: "Iniciante", professor: "João Paulo", vagas_totais: 6 });
  const [novoHorarioQuadra, setNovoHorarioQuadra] = useState({ dia_semana: "Sábado", horario_inicio: "08:00", horario_fim: "09:00", preco: "R$ 80,00" });
  
  

  const [dadosEfetivacao, setDadosEfetivacao] = useState<{ matriculaId: number, perfilId: string, nomeAluno: string, nivel: string, turmasIds: number[], cadastroCompleto: boolean }>({ 
    matriculaId: 0, perfilId: "", nomeAluno: "", nivel: "Iniciante", turmasIds: [], cadastroCompleto: false 
  });
  
  const [diaFiltroModal, setDiaFiltroModal] = useState("Segunda");
  const diasDaSemanaModal = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

  const abrirDetalhesAluno = (matricula: Matricula) => {
    setAlunoSelecionado(matricula);
    setTipoModal("ver_aluno");
    setModalAberto(true);
  };

  const buscarDados = async () => {
    try {
      const dados = await buscarDadosPainel();
      setTurmas(dados.turmas);
      setHorariosQuadra(dados.horariosQuadra);
      setMatriculas(dados.matriculas as Matricula[]);
      setProfessores(dados.professores); // Salva a lista de professores
    } catch (error) { console.error("Erro ao buscar:", error); }
  };

  const abrirModalEdicaoProfessor = (prof: Perfil) => {
    setNovoProfessor({ 
      nome: prof.nome, 
      email: prof.email, 
      whatsapp: prof.whatsapp || "", 
      senha: "" // A senha não é carregada (e será ocultada no formulário de edição)
    });
    setIdEdicaoProfessor(prof.id);
    setTipoModal("editar_professor");
    setModalAberto(true);
  };

  const abrirEdicaoNivel = (matricula: Matricula) => {
    setAlunoSelecionado(matricula);
    setNivelEdicao(matricula.perfis?.nivel || "Iniciante");
    setTipoModal("editar_aluno");
    setModalAberto(true);
  };

  useEffect(() => {
    async function verificarAcesso() {
      const { autorizado, tipo } = await verificarPermissaoAdmin(); // Desestrutura o retorno
      if (!autorizado) {
        router.push("/");
        return;
      }
      setTipoLogado(tipo); // Salva o tipo (admin/professor) no estado
      setAutorizado(true);
      await buscarDados();
      setCarregando(false);
    }
    verificarAcesso();
  }, [router]);

  

  const abrirModalEfetivar = (mat: Matricula) => {
    const p = mat.perfis;
    const isCompleto = p?.cpf && p?.data_nascimento && p?.contato_emergencia;

    setDadosEfetivacao({
      matriculaId: mat.id,
      perfilId: mat.perfil_id || p?.id || "",
      nomeAluno: p?.nome || "Aluno",
      nivel: p?.nivel || "Iniciante",
      turmasIds: [mat.turma_id],
      cadastroCompleto: !!isCompleto
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
    setErroModal(""); 

    try {
      if (tipoModal === "turma" || tipoModal === "editar_turma") {
        await salvarTurma(novaTurma, idEdicao);
      } 
      else if (tipoModal === "editar_aluno" && alunoSelecionado?.perfil_id) {
        await atualizarPerfil(alunoSelecionado.perfil_id, { nivel: nivelEdicao });
      }
      else if (tipoModal === "quadra") {
        await salvarQuadra(novoHorarioQuadra, idEdicao);
      } 
      else if (tipoModal === "efetivar_aluno" && alunoSelecionado) {
        await efetivarMatricula(alunoSelecionado.id);
      }
      else if (tipoModal === "professor") {
        await cadastrarNovoProfessor(novoProfessor);
        setModalSucesso({ aberto: true, titulo: "Professor Cadastrado", mensagem: "O novo professor já tem acesso ao sistema." });
      }
      else if (tipoModal === "editar_professor" && idEdicaoProfessor) {
        await atualizarPerfil(idEdicaoProfessor, { 
          nome: novoProfessor.nome, 
          whatsapp: novoProfessor.whatsapp.replace(/\D/g, "") 
        });
        setModalSucesso({ aberto: true, titulo: "Professor Atualizado", mensagem: "Os dados foram salvos com sucesso." });
      }
      
      setModalAberto(false);
      buscarDados(); // Atualiza a vista com os novos dados
      
    } catch (error) {
      // 1. Captura a mensagem de erro bruta
      let mensagemErro = error instanceof Error ? error.message : "Ocorreu um erro desconhecido ao guardar as informações.";

      // 2. Traduz os erros de forma clara
      if (mensagemErro === "whatsapp_duplicado" || (mensagemErro.includes("duplicate key") && mensagemErro.includes("whatsapp"))) {
        mensagemErro = "Este número de WhatsApp já está cadastrado para outro utilizador no sistema.";
      } 
      else if (mensagemErro.includes("User already registered") || mensagemErro.includes("already exists")) {
        mensagemErro = "Este e-mail já está cadastrado no sistema.";
      }

      // 3. Joga o erro traduzido para a UI vermelha
      setErroModal(mensagemErro);
    } finally {
      setCarregando(false);
    }
  };
  
  const excluirItem = async (id: number, tabela: 'turmas' | 'horarios_quadra' | 'matriculas') => {
    const isTurma = tabela === 'turmas';
    const titulo = isTurma ? "Excluir Turma" : "Excluir Horário de Quadra";
    const mensagem = isTurma 
      ? "Tem a certeza que deseja excluir esta turma? Todos os alunos matriculados ficarão sem turma."
      : "Tem a certeza que deseja excluir este horário de locação?";

    setModalConfirmacao({
      aberto: true,
      titulo: titulo,
      mensagem: mensagem,
      acao: async () => {
        setModalConfirmacao(prev => ({ ...prev, aberto: false }));
        setCarregando(true);
        try {
          await excluirRegistro(tabela, id);
          await buscarDados(); 
          setModalSucesso({ 
            aberto: true, 
            titulo: "Excluído!", 
            mensagem: isTurma ? "A turma foi removida do sistema com sucesso." : "O horário foi removido com sucesso." 
          });
        } catch (error) {
          console.error(error); 
          // Verificação segura de tipo sem usar 'any'
          const mensagemErro = error instanceof Error ? error.message : "Erro ao excluir registo.";
          setErroModal(mensagemErro);
        } finally {
          setCarregando(false);
        }
      }
    });
  };

  const abrirModal = (tipo: "turma" | "quadra") => {
    setIdEdicao(null);
    if (tipo === "turma") setNovaTurma({ dia_semana: "Segunda", horario: "18:00", nivel: "Iniciante", professor: "João Paulo", vagas_totais: 6 });
    setTipoModal(tipo);
    setModalAberto(true);
  };

  const abrirModalEdicao = (turmaExistente: Turma) => {
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
      
      <AnimatePresence>
        {modalAberto && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalAberto(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className={`bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-[2rem] shadow-2xl w-full relative z-10 max-h-[85vh] overflow-y-auto scrollbar-hide ${tipoModal === "efetivar_aluno" ? "max-w-lg sm:max-w-xl" : "max-w-md"}`}
            >
              
              <button onClick={() => setModalAberto(false)} className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors bg-slate-800/50 p-2 rounded-full"><X className="w-5 h-5" /></button>
              
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 tracking-tight pr-10">
                {tipoModal === "turma" ? "Nova Turma" : tipoModal === "editar_turma" ? "Editar Turma" : tipoModal === "quadra" ? "Novo Horário" : "Efetivar Aluno"}
              </h2>

              <form onSubmit={salvarDados} className="space-y-4">
                {erroModal && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm font-medium mb-4">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{erroModal}</p>
                  </div>
                )}
                {/* --- NOVA SECÇÃO: FICHA DO ALUNO --- */}
                {tipoModal === "ver_aluno" && alunoSelecionado && (
                  <div className="space-y-4 pb-2">
                    <div className="flex items-center gap-4 mb-4 border-b border-slate-800 pb-4">
                      <div className="w-14 h-14 bg-orange-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-2xl flex-shrink-0">
                        {alunoSelecionado.perfis?.nome?.charAt(0) || "?"}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg leading-tight">{alunoSelecionado.perfis?.nome || "Aluno"}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md uppercase tracking-wider font-bold">
                            Nível {alunoSelecionado.perfis?.nivel || "N/A"}
                          </span>
                          {/* BOTÃO PARA EDITAR NÍVEL */}
                          <button 
                            type="button"
                            onClick={() => abrirEdicaoNivel(alunoSelecionado)}
                            className="text-[10px] text-orange-500 hover:underline font-bold"
                          >
                            (Alterar)
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">WhatsApp</p>
                        <p className="text-sm text-slate-300 font-medium">{alunoSelecionado.perfis?.whatsapp || "Não preenchido"}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">CPF</p>
                          <p className="text-sm text-slate-300">{alunoSelecionado.perfis?.cpf || "Pendente"}</p>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Nascimento</p>
                          <p className="text-sm text-slate-300">{alunoSelecionado.perfis?.data_nascimento || "Pendente"}</p>
                        </div>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Contacto de Emergência</p>
                        <p className="text-sm text-slate-300">{alunoSelecionado.perfis?.contato_emergencia || "Pendente"}</p>
                      </div>
                    </div>
                  </div>
                )}
                {(tipoModal === "professor" || tipoModal === "editar_professor") && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Nome Completo</label>
                      <input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm" value={novoProfessor.nome} onChange={e => setNovoProfessor({...novoProfessor, nome: e.target.value})} />
                    </div>
                    
                    {/* E-mail: Só permite digitar se estiver CRIANDO um professor */}
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">E-mail</label>
                      <input 
                        type="email" required 
                        disabled={tipoModal === "editar_professor"} // Desabilita na edição
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                        value={novoProfessor.email} 
                        onChange={e => setNovoProfessor({...novoProfessor, email: e.target.value})} 
                      />
                    </div>

                    <div className={`grid ${tipoModal === "professor" ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
                      <div>
                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">WhatsApp</label>
                        <input 
                          type="tel" required placeholder="(00) 00000-0000" 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm" 
                          value={novoProfessor.whatsapp} 
                          onChange={e => setNovoProfessor({...novoProfessor, whatsapp: maskPhone(e.target.value)})} 
                        />
                      </div>
                      
                      {/* Senha: Só aparece ao CRIAR um professor */}
                      {tipoModal === "professor" && (
                        <div>
                          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Senha Provisória</label>
                          <input type="password" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500 text-sm" value={novoProfessor.senha} onChange={e => setNovoProfessor({...novoProfessor, senha: e.target.value})} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
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

                      <div className="flex flex-col gap-3 mt-4">
                        {turmasFiltradasNoModal.length === 0 ? (
                          <p className="text-xs text-slate-500 py-6 text-center bg-slate-950 rounded-xl border border-slate-800">
                            Nenhuma turma disponível neste dia.
                          </p>
                        ) : (
                          turmasFiltradasNoModal.map(t => {
                            const selecionado = dadosEfetivacao.turmasIds.includes(t.id);
                            const lotacao = t.matriculas?.length || 0;
                            const estaCheia = lotacao >= t.vagas_totais;
                            const disabled = estaCheia && !selecionado; // Impede seleção se estiver cheia (e não for a atual)
                            
                            // Verifica se o aluno que estamos a efetivar já faz parte desta turma (como experimental)
                            const alunoJaNaTurma = t.matriculas?.some((m: Matricula) => m.perfis?.id === dadosEfetivacao.perfilId);

                            return (
                              <div 
                                key={t.id} 
                                onClick={() => { if (!disabled) toggleTurmaEfetivacao(t.id) }}
                                className={`border rounded-2xl p-4 transition-all relative overflow-hidden flex flex-col gap-3 ${
                                  disabled ? "bg-slate-950/50 border-slate-800/50 cursor-not-allowed opacity-60" :
                                  selecionado ? "bg-orange-500/5 border-orange-500 cursor-pointer shadow-[0_0_15px_rgba(249,115,22,0.1)]" : "bg-slate-950 border-slate-800 cursor-pointer hover:border-slate-700 hover:bg-slate-900"
                                }`}
                              >
                                {/* HEADER DO CARD: Info e Lotação */}
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`font-bold text-base ${selecionado ? "text-white" : "text-slate-200"}`}>{t.dia_semana}</span>
                                      <span className={selecionado ? "text-orange-400 font-bold text-base" : "text-slate-400 font-bold text-base"}>{t.horario.substring(0,5)}</span>
                                    </div>
                                    <div className={`text-[10px] font-bold uppercase tracking-wider ${selecionado ? "text-orange-500/80" : "text-slate-500"}`}>{t.nivel}</div>
                                  </div>

                                  <div className="flex flex-col items-end gap-2">
                                    {/* Ícone de check ou status */}
                                    {selecionado ? (
                                      <CheckCircle2 className="w-6 h-6 text-orange-500" />
                                    ) : disabled ? (
                                      <span className="text-[10px] font-bold text-red-500 uppercase">Lotada</span>
                                    ) : (
                                      <div className="w-6 h-6 rounded-full border-2 border-slate-700"></div>
                                    )}
                                    
                                    {/* Etiqueta de vagas */}
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider mt-1 ${
                                      estaCheia ? "bg-red-500/10 text-red-500" :
                                      selecionado ? "bg-orange-500/20 text-orange-500" : "bg-slate-800 text-slate-400"
                                    }`}>
                                      {lotacao} / {t.vagas_totais} vagas
                                    </span>
                                  </div>
                                </div>

                                {/* LISTA DE AVATARES DOS ALUNOS */}
                                <div className="border-t border-slate-800/50 pt-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase shrink-0">Alunos na turma:</span>
                                    <div className="flex flex-wrap gap-1.5 flex-1">
                                      {t.matriculas && t.matriculas.length > 0 ? (
                                        t.matriculas.map((mat: Matricula, idx: number) => {
                                          const nomeCompleto = mat.perfis?.nome || "Aluno";
                                          const primeiroNome = nomeCompleto.split(" ")[0];
                                          const isExp = mat.status === 'experimental';
                                          const isCurrentStudent = mat.perfis?.id === dadosEfetivacao.perfilId;

                                          return (
                                            <div
                                              key={idx}
                                              title={`${nomeCompleto} ${isExp ? '(Experimental)' : ''}`}
                                              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold cursor-help ring-2 ring-slate-950 ${
                                                isCurrentStudent ? 'bg-emerald-500 text-slate-950 ring-emerald-500/30' :
                                                isExp ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-800 text-slate-300'
                                              }`}
                                            >
                                              {primeiroNome.charAt(0).toUpperCase()}
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <span className="text-xs text-slate-600 font-medium">Turma vazia</span>
                                      )}

                                      {/* PREVIEW: Mostra um avatar "+1" fantasma se a turma for selecionada e o aluno ainda não estiver nela */}
                                      {selecionado && !alunoJaNaTurma && (
                                         <div 
                                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-slate-950 bg-orange-500 text-slate-950 border border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.4)] animate-pulse" 
                                            title="Novo Aluno (Preview)"
                                         >
                                           +1
                                         </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
                {tipoModal === "editar_aluno" && alunoSelecionado && (
                  <div className="space-y-4">
                    <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl mb-4">
                      <p className="text-sm text-orange-400 font-medium text-center">
                        Alterando nível de: <span className="text-white font-bold">{alunoSelecionado.perfis?.nome}</span>
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Selecione o Novo Nível</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-orange-500"
                        value={nivelEdicao}
                        onChange={(e) => setNivelEdicao(e.target.value)}
                      >
                        <option value="Iniciante">Iniciante</option>
                        <option value="Intermediário">Intermediário</option>
                        <option value="Avançado">Avançado</option>
                        <option value="Pró">Pró</option>
                      </select>
                    </div>
                  </div>
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

                {tipoModal !== "ver_aluno" && (
                  <button type="submit" disabled={carregando} className="w-full mt-6 py-4 bg-orange-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-orange-600 transition-colors shadow-lg disabled:opacity-50">
                    {carregando ? "Processando..." : tipoModal === "editar_turma" ? "Salvar Alterações" : tipoModal === "efetivar_aluno" ? "Confirmar Matrículas" : "Salvar no Sistema"}
                  </button>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Painel de Controle</h1>
          <p className="text-sm sm:text-base text-slate-400 mt-1">Gerencie alunos e horários.</p>
        </div>

        <div className="flex bg-slate-900 p-1 rounded-xl mb-8 border border-slate-800 max-w-4xl overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setAbaAtiva("alunos")} 
            className={`flex-none sm:flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-3 px-5 text-xs sm:text-sm font-bold rounded-lg transition-all ${abaAtiva === "alunos" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
          >
            <Users className="w-4 h-4" /> Alunos
          </button>
          
          <button 
            onClick={() => setAbaAtiva("turmas")} 
            className={`flex-none sm:flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-3 px-5 text-xs sm:text-sm font-bold rounded-lg transition-all ${abaAtiva === "turmas" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
          >
            <CalendarDays className="w-4 h-4" /> Turmas
          </button>
          
          <button 
            onClick={() => setAbaAtiva("aluguel")} 
            className={`flex-none sm:flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-3 px-5 text-xs sm:text-sm font-bold rounded-lg transition-all ${abaAtiva === "aluguel" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
          >
            <MapPin className="w-4 h-4" /> Quadras
          </button>
          
          {tipoLogado === "admin" && (
            <button 
              onClick={() => setAbaAtiva("professores")} 
              className={`flex-none sm:flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-3 px-5 text-xs sm:text-sm font-bold rounded-lg transition-all ${abaAtiva === "professores" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
            >
              <Shield className="w-4 h-4" /> Professores
            </button>
          )}
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
                            {/* MUDANÇA: Etiquetas coloridas representando o Funil/Máquina de Estados */}
                            <h3 className="font-bold text-white flex flex-wrap items-center gap-2 text-sm sm:text-base leading-tight">
                              {mat.perfis?.nome || "Aluno"}
                              {mat.status === "experimental" && <span className="text-[9px] sm:text-[10px] bg-orange-500/10 border border-orange-500/20 text-orange-500 px-2 py-0.5 rounded-md uppercase">Experimental</span>}
                              {mat.status === "aguardando_dados" && <span className="text-[9px] sm:text-[10px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-md uppercase">Aguardando Dados</span>}
                              {mat.status === "aguardando_pagamento" && <span className="text-[9px] sm:text-[10px] bg-sky-500/10 border border-sky-500/20 text-sky-400 px-2 py-0.5 rounded-md uppercase">Aguardando Pgto</span>}
                              {mat.status === "ativo" && <span className="text-[9px] sm:text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-md uppercase">Ativo</span>}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                              Nível {mat.perfis?.nivel || "N/A"} • {mat.turmas?.dia_semana.substring(0,3)} às {mat.turmas?.horario?.substring(0,5)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 w-full sm:w-auto border-t border-slate-800 pt-3 sm:border-t-0 sm:pt-0">
                          {mat.status === "experimental" && (
                            <button onClick={() => abrirModalEfetivar(mat)} className="flex-1 sm:flex-none justify-center px-4 py-2 sm:py-2.5 bg-emerald-500 text-slate-950 font-bold text-xs sm:text-sm rounded-xl hover:bg-emerald-600 transition-colors flex items-center gap-2"><UserCheck className="w-4 h-4" /> Efetivar</button>
                          )}
                          <button 
                            onClick={() => abrirEdicaoNivel(mat)} 
                            className="flex-1 sm:flex-none flex justify-center p-2.5 text-slate-400 bg-slate-800 sm:bg-transparent hover:text-white hover:bg-slate-800 rounded-xl transition-all sm:opacity-0 group-hover:opacity-100 flex-shrink-0"
                          >
                            <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <button 
                            onClick={() => {
                              setModalConfirmacao({
                                aberto: true,
                                titulo: "Remover Aluno da Turma",
                                mensagem: "Tem a certeza? O perfil continuará no sistema para evitar novos cadastros gratuitos, mas ele será removido desta turma.",
                                acao: async () => {
                                  setModalConfirmacao(prev => ({ ...prev, aberto: false }));
                                  setCarregando(true);
                                  try {
                                    // Lógica original: Exclui APENAS a matrícula
                                    await excluirRegistro('matriculas', mat.id);
                                    await buscarDados();
                                  } catch (error) {
                                    alert("Erro ao remover matrícula.");
                                  } finally {
                                    setCarregando(false);
                                  }
                                }
                              });
                            }} 
                            className="p-2 sm:p-2.5 text-slate-500 bg-slate-800 sm:bg-transparent hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all sm:opacity-0 group-hover:opacity-100 flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
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
                    <div key={`turma-${turma.id}`} className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:justify-between sm:items-start group gap-4">
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-base sm:text-lg">{turma.dia_semana}</span>
                          <span className="text-orange-500 font-bold text-base sm:text-lg">{turma.horario.substring(0,5)}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 mb-4">{turma.nivel} • Professor(a) responsável</p>
                        
                        {/* --- NOVA SEÇÃO: AVATARES E LOTAÇÃO --- */}
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {turma.matriculas && turma.matriculas.length > 0 ? (
                              turma.matriculas.map((matricula: Matricula, idx: number) => {
                                const nomeCompleto = matricula.perfis?.nome || "Aluno";
                                const primeiroNome = nomeCompleto.split(" ")[0];
                                const inicial = primeiroNome.charAt(0).toUpperCase();
                                const isExperimental = matricula.status === 'experimental';
                                
                                return (
                                  <button 
                                    key={idx} 
                                    type="button"
                                    onClick={() => abrirDetalhesAluno(matricula)}
                                    title={`${nomeCompleto} (${isExperimental ? 'Aula Experimental' : 'Matriculado'})`}
                                    className={`relative flex items-center justify-center shrink-0 h-8 w-8 rounded-full ring-2 ring-slate-900 text-xs font-bold cursor-pointer transition-transform hover:scale-110 hover:z-10 ${
                                      isExperimental 
                                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }`}
                                  >
                                    <span className="leading-none mt-[1px]">{inicial}</span>
                                  </button>
                                );
                              })
                            ) : (
                              <span className="text-xs text-slate-500 font-medium bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800">
                                Sem alunos
                              </span>
                            )}
                          </div>
                          
                          {/* Contador de Lotação */}
                          <span className="text-xs font-medium px-2 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-400 flex items-center gap-1">
                            <span className={(turma.matriculas?.length || 0) >= turma.vagas_totais ? "text-orange-500 font-bold" : "text-emerald-400 font-bold"}>
                              {turma.matriculas?.length || 0}
                            </span> 
                            / {turma.vagas_totais} vagas
                          </span>
                        </div>
                        {/* --------------------------------------- */}

                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto border-t border-slate-800 pt-3 sm:border-t-0 sm:pt-0 sm:opacity-0 group-hover:opacity-100 transition-opacity justify-end">
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
            {abaAtiva === "professores" && tipoLogado === "admin" && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Corpo Docente</h2>
                    <p className="text-xs sm:text-sm text-slate-400">Gerencie os professores da arena.</p>
                  </div>
                  <button onClick={() => { setTipoModal("professor"); setModalAberto(true); }} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-slate-950 px-4 py-3 sm:py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
                    <UserPlus className="w-4 h-4" /> Novo Professor
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {professores.map(prof => (
                    <div key={`prof-${prof.id}`} className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex items-center justify-between group gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 flex-shrink-0">{prof.nome.charAt(0)}</div>
                        <div>
                          <h3 className="font-bold text-white text-base leading-tight">{prof.nome}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{prof.email}</p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Botão de Editar */}
                        <button 
                          onClick={() => abrirModalEdicaoProfessor(prof)} 
                          title="Editar Professor" 
                          className="p-2.5 text-slate-400 bg-slate-800 hover:text-white rounded-xl transition-all"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        
                        {/* Botão de Excluir */}
                        <button 
                          onClick={() => {
                            setModalConfirmacao({
                              aberto: true,
                              titulo: "Excluir Professor",
                              mensagem: "Deseja EXCLUIR DEFINITIVAMENTE este professor? O acesso dele será permanentemente revogado e ele perderá o vínculo com as turmas.",
                              acao: async () => {
                                setModalConfirmacao(prev => ({ ...prev, aberto: false }));
                                setCarregando(true);
                                try {
                                  await excluirProfessor(prof.id); 
                                  await buscarDados();
                                  setModalSucesso({ aberto: true, titulo: "Professor Removido", mensagem: "O acesso deste professor foi revogado com sucesso." });
                                } catch (error) {
                                  // Verificação segura de tipo sem usar 'any'
                                  const mensagemErro = error instanceof Error ? error.message : "Erro ao excluir professor.";
                                  setErroModal(mensagemErro);
                                } finally {
                                  setCarregando(false);
                                }
                              }
                            });
                          }} 
                          title="Excluir Professor Definitivamente" 
                          className="p-2.5 text-slate-400 bg-slate-800 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
        <AnimatePresence>
          {modalConfirmacao.aberto && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
               {/* Fundo escuro */}
               <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                onClick={() => setModalConfirmacao({ ...modalConfirmacao, aberto: false })}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
              />

              {/* Caixa do Modal */}
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.95, opacity: 0 }} 
                className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-2xl w-full max-w-sm text-center relative z-10"
              >
                <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                
                <h2 className="text-xl font-bold text-white mb-2">{modalConfirmacao.titulo}</h2>
                <p className="text-sm text-slate-400 mb-8 leading-relaxed">{modalConfirmacao.mensagem}</p>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setModalConfirmacao({ ...modalConfirmacao, aberto: false })} 
                    className="flex-1 py-3.5 bg-slate-800 text-white font-bold text-sm rounded-xl hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={modalConfirmacao.acao} 
                    className="flex-1 py-3.5 bg-red-600 text-white font-bold text-sm rounded-xl hover:bg-red-700 transition-colors"
                  >
                    Sim, Remover
                  </button>
                </div>
              </motion.div>
            </div>
          )}
          {modalSucesso.aberto && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                onClick={() => setModalSucesso({ ...modalSucesso, aberto: false })}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} 
                className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-2xl w-full max-w-sm text-center relative z-10"
              >
                <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">{modalSucesso.titulo}</h2>
                <p className="text-sm text-slate-400 mb-8 leading-relaxed">{modalSucesso.mensagem}</p>
                <button 
                  onClick={() => setModalSucesso({ ...modalSucesso, aberto: false })} 
                  className="w-full py-3.5 bg-emerald-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-emerald-600 transition-colors"
                >
                  Continuar
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}