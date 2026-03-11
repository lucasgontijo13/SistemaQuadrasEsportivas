import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Turma, Perfil, DadosAgendamento } from "@/types";

// 1. O retorno agora é Promise<Turma[]>
export async function buscarTurmasComAlunos(): Promise<Turma[]> {
  const { data: turmasData, error } = await supabase
    .from('turmas')
    .select(`
      *,
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

// 2. Retorna um User (do Supabase) e o nosso Perfil
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

// 3. O parâmetro dadosAluno agora exige o formato DadosAgendamento
export async function processarAgendamento(dadosAluno: DadosAgendamento, turmaId: number) {
  const whatsappLimpo = dadosAluno.whatsapp.replace(/\D/g, "");

  // A. Verificar se o Telefone/WhatsApp já existe
  const { data: telefoneExiste } = await supabase
    .from('perfis')
    .select('id')
    .eq('whatsapp', whatsappLimpo)
    .single();

  if (telefoneExiste) {
    return { sucesso: false, erro: "Este número de WhatsApp já está cadastrado em nosso sistema." };
  }
  if (!dadosAluno.senha) {
    return { sucesso: false, erro: "A senha é obrigatória para criar o cadastro." };
  }

  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: dadosAluno.email,
    password: dadosAluno.senha,
  });

  if (authError) {
    return { sucesso: false, erro: authError.message };
  }

  if (authData.user) {
    // C. Insere o perfil e a matrícula
    await supabase.from('perfis').insert([{
      id: authData.user.id,
      nome: dadosAluno.nome,
      whatsapp: whatsappLimpo,
      email: dadosAluno.email,
      tipo: 'aluno'
    }]);

    await supabase.from('matriculas').insert([{
      perfil_id: authData.user.id,
      turma_id: turmaId,
      status: 'experimental'
    }]);

    return { sucesso: true, erro: null };
  }

  return { sucesso: false, erro: "Erro desconhecido ao criar usuário." };
}