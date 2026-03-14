import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Turma, Perfil } from "@/types";

// Retorna as turmas com os alunos matriculados
export async function buscarTurmasComAlunos(): Promise<Turma[]> {
  const { data: turmasData, error } = await supabase
    .from('turmas')
    .select(`
      id,
      dia_semana,
      horario,
      nivel,
      professor_id,
      professor:perfis!turmas_professor_id_fkey (
        id,
        nome
      ),
      vagas_totais,
      ativa,
      matriculas (
        status,
        perfis ( nome )
      )
    `);
    
  if (error) {
    console.error("Erro ao buscar turmas:", error);
    return [];
  }
  return (turmasData as Turma[]) || [];
}

// Retorna o usuário autenticado e o seu perfil
export async function buscarPerfilLogado(): Promise<{ usuario: User | null; perfil: Perfil | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return { usuario: null, perfil: null };

  const { data: perfilData } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', session.user.id)
    .single();

  return { 
    usuario: session.user, 
    perfil: (perfilData as Perfil) || null 
  };
}
