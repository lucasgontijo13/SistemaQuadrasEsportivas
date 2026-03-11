"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, Clock, MapPin, Loader2 } from "lucide-react";

// Tipos e Serviços
import { HorarioQuadra, ReservaQuadra, DiaSeletor } from "@/types";
import { buscarDadosAgendamentoQuadra } from "@/services/quadraService";

const gerarProximosDias = (): DiaSeletor[] => {
  const dias = [];
  const nomesDiasBanco = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const nomesDiasAbreviados = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  
  for (let i = 0; i < 5; i++) {
    const data = new Date();
    data.setDate(data.getDate() + i);
    dias.push({
      id: i,
      dataReal: data.toISOString().split('T')[0],
      nomeDiaBanco: nomesDiasBanco[data.getDay()],
      nomeDiaVisual: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : nomesDiasAbreviados[data.getDay()],
      dataVisual: `${data.getDate()} ${data.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}`
    });
  }
  return dias;
};

const diasDisponiveis = gerarProximosDias();

export default function AgendarQuadraPage() {
  const [dataSelecionada, setDataSelecionada] = useState<DiaSeletor>(diasDisponiveis[0]);
  const [horariosDoDia, setHorariosDoDia] = useState<HorarioQuadra[]>([]);
  const [reservasFeitas, setReservasFeitas] = useState<ReservaQuadra[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarDados() {
      setCarregando(true);
      const { horarios, reservas } = await buscarDadosAgendamentoQuadra(
        dataSelecionada.nomeDiaBanco, 
        dataSelecionada.dataReal
      );
      setHorariosDoDia(horarios);
      setReservasFeitas(reservas);
      setCarregando(false);
    }
    carregarDados();
  }, [dataSelecionada]);

  const verificarDisponibilidade = (horarioSlot: string) => {
    const hFormat = horarioSlot.substring(0, 5);
    return !reservasFeitas.some(r => r.horario_inicio.substring(0, 5) === hFormat);
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
          <div className="font-bold text-xl tracking-tighter text-white">Arena<span className="text-orange-500">.Pro</span></div>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">Alugar Quadra</h1>
          <p className="text-slate-400">Reserve a quadra por 1 hora e venha jogar com seus amigos.</p>
        </motion.div>

        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6 sm:mx-0 sm:px-0 mb-10">
          {diasDisponiveis.map((dia) => (
            <button
              key={dia.id}
              onClick={() => setDataSelecionada(dia)}
              className={`flex flex-col items-center justify-center min-w-[80px] h-20 rounded-2xl border transition-all ${
                dataSelecionada.id === dia.id ? "bg-orange-500 border-orange-400 text-slate-950 shadow-lg" : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <span className={`text-[10px] font-bold uppercase mb-1 ${dataSelecionada.id === dia.id ? "text-slate-900" : "text-slate-500"}`}>{dia.nomeDiaVisual}</span>
              <span className={`text-lg font-bold ${dataSelecionada.id === dia.id ? "text-slate-950" : "text-white"}`}>{dia.dataVisual}</span>
            </button>
          ))}
        </div>

        {carregando ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="grid sm:grid-cols-2 gap-4">
            {horariosDoDia.map((slot) => {
              const disponivel = verificarDisponibilidade(slot.horario_inicio);
              return (
                <motion.div key={slot.id} variants={item} className={`p-5 rounded-2xl border ${!disponivel ? "bg-slate-900/30 border-slate-800/50 opacity-60" : "bg-slate-900/80 border-slate-800 hover:border-slate-700"}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-500" />
                        <h3 className="text-2xl font-bold text-white tracking-tight">{slot.horario_inicio.substring(0, 5)} <span className="text-slate-500 text-lg font-medium">às {slot.horario_fim.substring(0, 5)}</span></h3>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-400 mt-2"><MapPin className="w-4 h-4" /> Quadra Principal</div>
                    </div>
                    {!disponivel && <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded-md uppercase font-bold">Ocupado</span>}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                    <span className={`text-lg font-bold ${disponivel ? "text-emerald-400" : "text-slate-500"}`}>{disponivel ? slot.preco : "Indisponível"}</span>
                    <button disabled={!disponivel} className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all ${!disponivel ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-white text-slate-950 hover:bg-slate-200 active:scale-95"}`}>
                      Reservar
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