"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, Clock, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Função para gerar os próximos 5 dias com os nomes exatos do banco de dados
const gerarProximosDias = () => {
  const dias = [];
  const nomesDiasBanco = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const nomesDiasAbreviados = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  
  for (let i = 0; i < 5; i++) {
    const data = new Date();
    data.setDate(data.getDate() + i);
    dias.push({
      id: i,
      dataReal: data.toISOString().split('T')[0], // YYYY-MM-DD para checar reservas
      nomeDiaBanco: nomesDiasBanco[data.getDay()], // "Segunda" para buscar na tabela horarios_quadra
      nomeDiaVisual: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : nomesDiasAbreviados[data.getDay()],
      dataVisual: `${data.getDate()} ${data.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}`
    });
  }
  return dias;
};

const diasDisponiveis = gerarProximosDias();

export default function AgendarQuadraPage() {
  const [dataSelecionada, setDataSelecionada] = useState(diasDisponiveis[0]);
  
  // Estados para guardar os dados do banco
  const [horariosDoDia, setHorariosDoDia] = useState<any[]>([]);
  const [reservasFeitas, setReservasFeitas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function buscarDadosDaQuadra() {
      setCarregando(true);
      
      // 1. Busca os horários configurados pelo Admin para este dia da semana (Ex: "Segunda")
      const { data: slotsBase } = await supabase
        .from('horarios_quadra')
        .select('*')
        .eq('dia_semana', dataSelecionada.nomeDiaBanco)
        .order('horario_inicio', { ascending: true });
      
      // 2. Busca as reservas que já foram feitas para esta DATA específica (Ex: "2026-03-11")
      const { data: reservas } = await supabase
        .from('reservas_quadra')
        .select('horario_inicio')
        .eq('data_reserva', dataSelecionada.dataReal)
        .eq('status', 'confirmado');
      
      if (slotsBase) setHorariosDoDia(slotsBase);
      if (reservas) setReservasFeitas(reservas);
      
      setCarregando(false);
    }
    
    buscarDadosDaQuadra();
  }, [dataSelecionada]);

  // Função que cruza os horários base com as reservas para ver se está livre
  const verificarDisponibilidade = (horarioSlot: string) => {
    const horarioFormatado = horarioSlot.substring(0, 5); // "18:00:00" -> "18:00"
    return !reservasFeitas.some(reserva => reserva.horario_inicio.substring(0, 5) === horarioFormatado);
  };

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-orange-500 selection:text-white pb-20">
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
            <span className="font-medium text-sm">Voltar</span>
          </Link>
          <div className="font-bold text-xl tracking-tighter text-white">
            Arena<span className="text-orange-500">.Pro</span>
          </div>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">Alugar Quadra</h1>
          <p className="text-slate-400">Reserve a quadra por 1 hora e venha jogar com seus amigos.</p>
        </motion.div>

        {/* Seletor de Datas */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-10">
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6 sm:mx-0 sm:px-0">
            {diasDisponiveis.map((dia) => {
              const ativo = dataSelecionada.id === dia.id;
              return (
                <button
                  key={dia.id}
                  onClick={() => setDataSelecionada(dia)}
                  className={`flex flex-col items-center justify-center min-w-[80px] h-20 rounded-2xl border transition-all ${
                    ativo ? "bg-orange-500 border-orange-400 text-slate-950 shadow-[0_0_20px_rgba(249,115,22,0.3)]" : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className={`text-xs font-semibold uppercase tracking-wider mb-1 ${ativo ? "text-slate-900" : "text-slate-500"}`}>{dia.nomeDiaVisual}</span>
                  <span className={`text-lg font-bold ${ativo ? "text-slate-950" : "text-white"}`}>{dia.dataVisual}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Lista de Horários do Banco */}
        {carregando ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        ) : horariosDoDia.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/50 text-slate-500">
            Nenhum horário de aluguel configurado para {dataSelecionada.nomeDiaBanco.toLowerCase()}.
          </div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="grid sm:grid-cols-2 gap-4">
            {horariosDoDia.map((slot) => {
              const disponivel = verificarDisponibilidade(slot.horario_inicio);
              const horaInicio = slot.horario_inicio.substring(0, 5);
              const horaFim = slot.horario_fim.substring(0, 5);

              return (
                <motion.div key={slot.id} variants={item} className={`p-5 rounded-2xl border ${!disponivel ? "bg-slate-900/30 border-slate-800/50 opacity-60" : "bg-slate-900/80 border-slate-800 hover:border-slate-700"} transition-colors flex flex-col justify-between gap-6`}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-500" />
                        <h3 className="text-2xl font-bold text-white tracking-tight">{horaInicio} <span className="text-slate-500 text-lg font-medium">às {horaFim}</span></h3>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-400 mt-2"><MapPin className="w-4 h-4" /> Quadra Principal</div>
                    </div>
                    {!disponivel && <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded-md uppercase tracking-wider font-bold">Ocupado</span>}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-2">
                    <div>{disponivel ? <span className="text-lg font-bold text-emerald-400">{slot.preco}</span> : <span className="text-sm font-medium text-slate-500">Indisponível</span>}</div>
                    <button disabled={!disponivel} className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all ${!disponivel ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-white text-slate-950 hover:bg-slate-200 active:scale-95 shadow-lg"}`}>
                      {disponivel ? "Reservar" : "Indisponível"}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>
    </div>
  );
}