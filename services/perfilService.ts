import { supabase } from "@/lib/supabase";
import { DadosCompletarPerfil } from "@/types";
import { Perfil } from "@/types";

const normalizarTelefone = (valor?: string | null) => valor?.replace(/\D/g, "") || null;
const normalizarDocumento = (valor?: string | null) => valor?.replace(/\D/g, "") || null;

const perfilEstaCompleto = (perfil: Pick<Perfil, "cpf" | "data_nascimento" | "contato_emergencia" | "cep" | "rua" | "numero">) =>
  !!perfil.cpf &&
  !!perfil.data_nascimento &&
  !!perfil.contato_emergencia &&
  !!perfil.cep &&
  !!perfil.rua &&
  !!perfil.numero;

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
  const cpfLimpo = normalizarDocumento(perfil.cpf);
  const whatsappLimpo = normalizarTelefone(perfil.whatsapp);
  const contatoEmergenciaLimpo = normalizarTelefone(perfil.contato_emergencia);
  const cepLimpo = normalizarDocumento(perfil.cep);

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
      whatsapp: whatsappLimpo,
      contato_emergencia: contatoEmergenciaLimpo,
      cpf: cpfLimpo,
      data_nascimento: perfil.data_nascimento || null,
      cep: cepLimpo,
      rua: perfil.rua?.trim() || null,
      numero: perfil.numero?.trim() || null,
    })
    .eq('id', perfil.id);

  if (erroPerfil) throw new Error(erroPerfil.message);

  const cadastroCompleto = perfilEstaCompleto({
    cpf: cpfLimpo || undefined,
    data_nascimento: perfil.data_nascimento,
    contato_emergencia: contatoEmergenciaLimpo || undefined,
    cep: cepLimpo || undefined,
    rua: perfil.rua?.trim() || undefined,
    numero: perfil.numero?.trim() || undefined,
  });

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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Sessão não encontrada");

  if (dados.senha && dados.senha.length >= 6) {
    const { error: authError } = await supabase.auth.updateUser({
      password: dados.senha 
    });
    if (authError) throw new Error(authError.message);
  }

  const cpfLimpo = normalizarDocumento(dados.cpf);
  const contatoEmergenciaLimpo = normalizarTelefone(dados.contato_emergencia);
  const cepLimpo = normalizarDocumento(dados.cep);

  if (cpfLimpo) {
    const { data: cpfExistente } = await supabase
      .from("perfis")
      .select("id")
      .eq("cpf", cpfLimpo)
      .neq("id", session.user.id)
      .maybeSingle();

    if (cpfExistente) {
      throw new Error("Este CPF já está cadastrado em outra conta.");
    }
  }

  const { error: profileError } = await supabase
    .from('perfis')
    .update({
      cpf: cpfLimpo,
      data_nascimento: dados.data_nascimento,
      cep: cepLimpo,
      rua: dados.rua.trim(),
      numero: dados.numero.trim(),
      contato_emergencia: contatoEmergenciaLimpo,
    })
    .eq('id', session.user.id);

  if (profileError) throw new Error(profileError.message);

  const cadastroCompleto = perfilEstaCompleto({
    cpf: cpfLimpo || undefined,
    data_nascimento: dados.data_nascimento,
    contato_emergencia: contatoEmergenciaLimpo || undefined,
    cep: cepLimpo || undefined,
    rua: dados.rua.trim() || undefined,
    numero: dados.numero.trim() || undefined,
  });

  if (cadastroCompleto) {
    const { error: matriculasError } = await supabase
      .from("matriculas")
      .update({ status: "aguardando_pagamento" })
      .eq("perfil_id", session.user.id)
      .eq("status", "aguardando_dados");

    if (matriculasError) throw new Error(matriculasError.message);
  }

  return { sucesso: true };
}
