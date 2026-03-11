import { supabase } from "@/lib/supabase";
import { DadosLogin } from "@/types";

export async function iniciarSessao(dados: DadosLogin) {
  let emailFinal = dados.identificador;

  // 1. Lógica para login via WhatsApp (se não contiver @)
  if (!dados.identificador.includes("@")) {
    const whatsappLimpo = dados.identificador.replace(/\D/g, "");

    const { data: perfil, error: erroBusca } = await supabase
      .from('perfis')
      .select('email')
      .eq('whatsapp', whatsappLimpo)
      .single();

    if (erroBusca || !perfil?.email) {
      throw new Error("Nenhum usuário encontrado com este WhatsApp.");
    }

    emailFinal = perfil.email;
  }

  // 2. Autenticação oficial
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: emailFinal,
    password: dados.senha,
  });

  if (authError) {
    throw new Error("Credenciais incorretas. Verifique seus dados.");
  }

  // 3. Busca o tipo do perfil para decidir o redirecionamento
  if (authData.user) {
    const { data: perfil } = await supabase
      .from('perfis')
      .select('tipo')
      .eq('id', authData.user.id)
      .single();

    return {
      user: authData.user,
      tipo: perfil?.tipo || 'aluno'
    };
  }

  throw new Error("Erro inesperado ao realizar login.");
}

export async function atualizarSenhaUsuario(novaSenha: string) {
  // 1. Tenta atualizar a senha no Supabase Auth
  const { error } = await supabase.auth.updateUser({
    password: novaSenha
  });

  if (error) {
    // Tratamento de erro específico para senhas iguais à anterior
    const msg = error.message.toLowerCase();
    if (msg.includes("different") || msg.includes("same")) {
      return { 
        sucesso: false, 
        erro: "A nova senha precisa ser diferente da sua senha atual." 
      };
    }
    
    return { 
      sucesso: false, 
      erro: "Não foi possível atualizar a senha. O link pode ter expirado." 
    };
  }

  // 2. IMPORTANTE: Encerra a sessão para forçar um novo login com a nova senha
  await supabase.auth.signOut();
  
  return { sucesso: true };
}


export async function solicitarLinkRecuperacao(identificador: string) {
  let emailFinal = identificador;

  // 1. Lógica para identificar via WhatsApp (se não contiver @)
  if (!identificador.includes("@")) {
    const whatsappLimpo = identificador.replace(/\D/g, "");
    const { data: perfilEncontrado, error: erroBusca } = await supabase
      .from('perfis')
      .select('email')
      .eq('whatsapp', whatsappLimpo)
      .single();

    if (erroBusca || !perfilEncontrado?.email) {
      throw new Error("Não encontramos nenhum usuário com este WhatsApp.");
    }
    emailFinal = perfilEncontrado.email;
  }

  // 2. Dispara o e-mail de recuperação oficial do Supabase
  const { error } = await supabase.auth.resetPasswordForEmail(emailFinal, {
    // Define para onde o link do e-mail vai redirecionar o usuário
    redirectTo: `${window.location.origin}/atualizar-senha`, 
  });

  if (error) {
    throw new Error("Erro ao enviar o e-mail de recuperação. Tente novamente mais tarde.");
  }

  return true;
}