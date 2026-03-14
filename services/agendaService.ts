import { supabase } from "@/lib/supabase";
import { Matricula } from "@/types";

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
          perfis (
            nome
          )
        )
      )
    `)
    .eq('perfil_id', session.user.id);

  if (error) {
    console.error("Erro ao buscar agenda:", error);
    return [];
  }

  // Forçamos a tipagem para Matricula[] usando unknown como ponte
  return (data as unknown as Matricula[]) || [];
}
