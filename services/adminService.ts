import { supabase } from "@/lib/supabase";
import { Turma, HorarioQuadra, Matricula, Perfil } from "@/types";

// 1. Verifica se o utilizador tem permissão para aceder ao painel
export async function verificarPermissaoAdmin(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const { data: perfil } = await supabase
    .from('perfis')
    .select('tipo')
    .eq('id', session.user.id)
    .single();

  return perfil?.tipo === 'admin' || perfil?.tipo === 'professor';
}

// 2. Busca todos os dados necessários para o painel de uma só vez
export async function buscarDadosPainel() {
  // Busca Turmas
  const { data: turmasData } = await supabase
    .from('turmas')
    .select(`*, matriculas (id, status, perfis (id, nome, nivel, whatsapp, cpf, data_nascimento, contato_emergencia))`)
    .order('id', { ascending: true });

  // Busca Quadras
  const { data: quadrasData } = await supabase
    .from('horarios_quadra')
    .select('*')
    .order('horario_inicio', { ascending: true });

  // Busca Matrículas (Exclusivo para preencher a aba "Alunos")
  const { data: matriculasData } = await supabase
    .from('matriculas')
    .select(`id, status, perfil_id, turma_id, perfis (*), turmas (*)`)
    .order('id', { ascending: false });

  return {
    turmas: (turmasData as Turma[]) || [],
    horariosQuadra: (quadrasData as HorarioQuadra[]) || [],
    matriculas: (matriculasData as unknown as Matricula[]) || [] // Usamos any[] aqui temporariamente se a tipagem da Matricula não tiver a turma expandida
  };
}

// 3. Função genérica para excluir um registo
export async function excluirRegistro(tabela: 'turmas' | 'horarios_quadra' | 'matriculas', id: number) {
  const { error } = await supabase.from(tabela).delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

// 4. Salvar ou Atualizar Turma
export async function salvarTurma(dados: Partial<Turma>, idEdicao: number | null) {
  if (idEdicao) {
    const { error } = await supabase.from('turmas').update(dados).eq('id', idEdicao);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('turmas').insert([dados]);
    if (error) throw new Error(error.message);
  }
  return true;
}

// 5. Salvar ou Atualizar Quadra
export async function salvarQuadra(dados: Partial<HorarioQuadra>, idEdicao: number | null) {
  if (idEdicao) {
    const { error } = await supabase.from('horarios_quadra').update(dados).eq('id', idEdicao);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('horarios_quadra').insert([dados]);
    if (error) throw new Error(error.message);
  }
  return true;
}

// 6. Aprovar/Efetivar Aluno (Muda de experimental para ativo)
export async function efetivarMatricula(matriculaId: number) {
  const { error } = await supabase
    .from('matriculas')
    .update({ status: 'ativo' })
    .eq('id', matriculaId);
  if (error) throw new Error(error.message);
  return true;
}


export async function atualizarPerfil(perfilId: string, dados: Partial<Perfil>) {
  const { error } = await supabase
    .from('perfis')
    .update(dados)
    .eq('id', perfilId);

  if (error) throw new Error(error.message);
  return true;
}