import { supabase } from "@/lib/supabase";
import { Turma, HorarioQuadra, Matricula, Perfil, DadosNovoProfessor } from "@/types";

// 1. Alterado para retornar também o 'tipo' exato do utilizador
export async function verificarPermissaoAdmin(): Promise<{ autorizado: boolean; tipo: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { autorizado: false, tipo: '' };

  const { data: perfil } = await supabase
    .from('perfis')
    .select('tipo')
    .eq('id', session.user.id)
    .single();

  return { 
    autorizado: perfil?.tipo === 'admin' || perfil?.tipo === 'professor', 
    tipo: perfil?.tipo || 'aluno'
  };
}

// 2. Atualizado para buscar a lista de professores
export async function buscarDadosPainel() {
  const { data: turmasData } = await supabase.from('turmas').select(`*, matriculas (id, status, perfis (id, nome, nivel, whatsapp, cpf, data_nascimento, contato_emergencia))`).order('id', { ascending: true });
  const { data: quadrasData } = await supabase.from('horarios_quadra').select('*').order('horario_inicio', { ascending: true });
  const { data: matriculasData } = await supabase.from('matriculas').select(`id, status, perfil_id, turma_id, perfis (*), turmas (*)`).order('id', { ascending: false });
  

  const { data: professoresData } = await supabase.from('perfis').select('*').eq('tipo', 'professor').order('nome', { ascending: true });

  return {
    turmas: (turmasData as Turma[]) || [],
    horariosQuadra: (quadrasData as HorarioQuadra[]) || [],
    matriculas: (matriculasData as unknown as Matricula[]) || [],
    professores: (professoresData as Perfil[]) || [] // <-- Adicionado
  };
}



// 7. Cadastrar Novo Professor 
export async function cadastrarNovoProfessor(dados: DadosNovoProfessor) {
  const response = await fetch('/api/professores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(resultado.erro || "Erro ao cadastrar professor");
  }

  return true;
}

// Excluir Professor Definitivamente (Apaga Auth e Banco de Dados)
export async function excluirProfessor(perfilId: string) {
  const response = await fetch(`/api/professores?id=${perfilId}`, {
    method: 'DELETE'
  });
  
  const resultado = await response.json();
  
  if (!response.ok) {
    throw new Error(resultado.erro || "Erro ao excluir professor.");
  }
  
  return true;
}

// 8. Remover Professor (Volta a ser Aluno para não quebrar o banco de dados)
export async function rebaixarProfessor(perfilId: string) {
  const { error } = await supabase.from('perfis').update({ tipo: 'aluno' }).eq('id', perfilId);
  if (error) throw new Error(error.message);
  return true;
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