import { supabase } from "@/lib/supabase";
import { HorarioQuadra, ReservaQuadra } from "@/types";

export async function buscarDadosAgendamentoQuadra(nomeDiaBanco: string, dataReal: string) {
  // 1. Busca horários configurados para aquele dia (ex: Segunda)
  const { data: slotsBase } = await supabase
    .from('horarios_quadra')
    .select('*')
    .eq('dia_semana', nomeDiaBanco)
    .order('horario_inicio', { ascending: true });
  
  // 2. Busca reservas já confirmadas para aquela data específica
  const { data: reservas } = await supabase
    .from('reservas_quadra')
    .select('horario_inicio')
    .eq('data_reserva', dataReal)
    .eq('status', 'confirmado');

  return {
    horarios: (slotsBase as HorarioQuadra[]) || [],
    reservas: (reservas as ReservaQuadra[]) || []
  };
}