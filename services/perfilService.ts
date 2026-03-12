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

  const cpfLimpo = perfil.cpf?.replace(/\D/g, "");


  if (cpfLimpo) {
    const { data: cpfExistente } = await supabase
      .from('perfis')
      .select('id')
      .eq('cpf', cpfLimpo)
      .neq('id', perfil.id) // Ignora o próprio utilizador (para ele poder salvar o próprio perfil sem dar erro)
      .maybeSingle(); // maybeSingle retorna os dados se achar, ou null se não achar (sem dar erro)

    // Se encontrou alguém com esse CPF que não seja o utilizador atual, bloqueia!
    if (cpfExistente) {
      throw new Error("Este CPF já está cadastrado em outra conta.");
    }
  }


  const { error: erroPerfil } = await supabase
    .from('perfis')
    .update({
      nome: perfil.nome,
      whatsapp: perfil.whatsapp.replace(/\D/g, ""),
      contato_emergencia: perfil.contato_emergencia?.replace(/\D/g, ""),
      cpf: cpfLimpo,
      data_nascimento: perfil.data_nascimento || null
    })
    .eq('id', perfil.id);

  if (erroPerfil) throw new Error(erroPerfil.message);

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