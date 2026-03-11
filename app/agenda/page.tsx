"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, CalendarDays, Loader2, Clock, MapPin, UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AgendaPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [minhasAulas, setMinhasAulas] = useState<any[]>([]);

  useEffect(() => {
    async function carregarAgenda() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push("/entrar");
        return;
      }

      // Busca as matrículas do aluno logado e traz os dados da turma junto
      const { data, error } = await supabase
        .from('matriculas')
        .select(`
          id, 
          status, 
          turmas (
            dia_semana, 
            horario, 
            nivel, 
            professor
          )
        `)
        .eq('perfil_id', session.user.id);

      if (data) setMinhasAulas(data);
      setCarregando(false);
    }
    carregarAgenda();
  }, [router]);

  if (carregando) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-orange-500 selection:text-white pb-20">
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
            <span className="font-medium text-sm">Voltar</span>
          </Link>
          <div className="font-bold text-xl tracking-tighter text-white">Arena<span className="text-orange-500">.Pro</span></div>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-orange-500" /> Minha Agenda
          </h1>
          <p className="text-slate-400 mt-2">Acompanhe os horários das suas aulas e treinos.</p>
        </motion.div>

        {minhasAulas.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/30 rounded-[2rem] border border-slate-800/50">
            <CalendarDays className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400">Você ainda não está matriculado em nenhuma turma.</p>
            <Link href="/agendar" className="inline-block mt-6 px-6 py-3 bg-orange-500 text-slate-950 font-bold rounded-xl hover:bg-orange-600 transition-colors">
              Ver Horários Disponíveis
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {minhasAulas.map((aula, index) => (
              <motion.div 
                key={aula.id} 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: index * 0.1 }}
                className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden"
              >
                {/* Faixa lateral indicando status */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${aula.status === 'experimental' ? 'bg-orange-500' : 'bg-emerald-500'}`}></div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${aula.status === 'experimental' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {aula.status === 'experimental' ? 'Aula Experimental' : 'Aluno Fixo'}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">{aula.turmas.nivel}</h3>
                  <p className="text-slate-400 flex items-center gap-2">
                    <UserCheck className="w-4 h-4" /> Professor {aula.turmas.professor}
                  </p>
                </div>

                <div className="flex flex-row sm:flex-col gap-4 sm:gap-2 text-sm font-medium bg-slate-950 p-4 rounded-2xl border border-slate-800 sm:min-w-[140px]">
                  <div className="flex items-center gap-2 text-slate-300">
                    <CalendarDays className="w-4 h-4 text-orange-500" /> {aula.turmas.dia_semana}
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="w-4 h-4 text-orange-500" /> {aula.turmas.horario.substring(0, 5)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}