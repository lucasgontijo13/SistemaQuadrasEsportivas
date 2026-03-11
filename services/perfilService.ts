import { supabase } from "@/lib/supabase";
import { DadosCompletarPerfil } from "@/types";
import { Perfil } from "@/types";


export async function buscarPerfilUsuario(): Promise<Perfil | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', session.user.id)
    .single();

  return (data as Perfil) || null;
}

export async function atualizarPerfilUsuario(perfil: Perfil) {
  // 1. Atualiza os dados básicos (limpando máscaras)
  const { error: erroPerfil } = await supabase
    .from('perfis')
    .update({
      nome: perfil.nome,
      whatsapp: perfil.whatsapp.replace(/\D/g, ""),
      contato_emergencia: perfil.contato_emergencia?.replace(/\D/g, ""),
      cpf: perfil.cpf?.replace(/\D/g, ""),
      data_nascimento: perfil.data_nascimento || null
    })
    .eq('id', perfil.id);

  if (erroPerfil) throw new Error(erroPerfil.message);

  // 2. Máquina de Estados: Se o cadastro estiver completo, avança as matrículas travadas
  const cadastroCompleto = perfil.cpf && perfil.data_nascimento && perfil.contato_emergencia;

  if (cadastroCompleto) {
    await supabase
      .from('matriculas')
      .update({ status: 'aguardando_pagamento' })
      .eq('perfil_id', perfil.id)
      .eq('status', 'aguardando_dados');
  }

  return true;
}

export async function completarPerfilUsuario(dados: DadosCompletarPerfil) {
  // 1. Obtém o utilizador atual
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Sessão não encontrada");

  // 2. Se foi fornecida uma nova senha, atualiza no Auth
  if (dados.senha && dados.senha.length >= 6) {
    const { error: authError } = await supabase.auth.updateUser({
      password: dados.senha 
    });
    if (authError) throw new Error(authError.message);
  }

  // 3. Atualiza os dados na tabela 'perfis'
  const { error: profileError } = await supabase
    .from('perfis')
    .update({
      cpf: dados.cpf,
      data_nascimento: dados.data_nascimento,
      cep: dados.cep,
      rua: dados.rua,
      numero: dados.numero,
      contato_emergencia: dados.contato_emergencia,
      status: 'aguardando_pagamento' // Marcamos que o cadastro está pronto para cobrança
    })
    .eq('id', session.user.id);

  if (profileError) throw new Error(profileError.message);

  return { sucesso: true };
}