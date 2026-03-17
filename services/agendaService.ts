import { supabase } from "@/lib/supabase";
import { Matricula } from "@/types";

const STATUS_AGENDA_VISIVEIS: Matricula["status"][] = [
  "experimental",
  "ativo",
  "aguardando_dados",
  "aguardando_pagamento",
];

export async function buscarMinhaAgenda(): Promise<Matricula[]> {
  // 1. Obtém a sessão do utilizador
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    throw new Error("Utilizador não autenticado");
  }

  // 2. Busca as matrículas com os dados da turma e dos colegas (perfis)
  const { data, error } = await supabase
    .from('matriculas')
    .select(`
      id, 
      status, 
      perfil_id,
      turma_id,
      turmas (
        id,
        dia_semana, 
        horario, 
        nivel, 
        professor_id,
        professor:perfis!turmas_professor_id_fkey (
          id,
          nome
        ),
        matriculas (
          perfis:perfis!matriculas_perfil_id_fkey (
            nome
          )
        )
      )
    `)
    .eq('perfil_id', session.user.id)
    .in("status", STATUS_AGENDA_VISIVEIS);

  if (error) {
    console.error("Erro ao buscar agenda:", error);
    return [];
  }

  const matriculas = (data as unknown as Matricula[]) || [];

  return matriculas.map((matricula) => ({
    ...matricula,
    turmas: matricula.turmas
      ? {
          ...matricula.turmas,
          matriculas: matricula.turmas.matriculas?.filter((colega) =>
            STATUS_AGENDA_VISIVEIS.includes(colega.status)
          ),
        }
      : matricula.turmas,
  }));
}
