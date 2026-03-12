import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// CRIAR PROFESSOR
export async function POST(req: Request) {
  try {
    const dados = await req.json();
    const whatsappLimpo = dados.whatsapp.replace(/\D/g, "");

    // 1. VERIFICAÇÃO BLINDADA (Via JavaScript)
    const { data: todosPerfis } = await supabaseAdmin.from('perfis').select('whatsapp');
    
    const whatsappJaExiste = todosPerfis?.some(p => {
      if (!p.whatsapp) return false;
      const numBanco = p.whatsapp.replace(/\D/g, "");
      return numBanco === whatsappLimpo;
    });

    if (whatsappJaExiste) {
      return NextResponse.json({ erro: "whatsapp_duplicado" }, { status: 400 });
    }

    // 2. CRIA O USUÁRIO NO AUTH
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: dados.email,
      password: dados.senha,
      email_confirm: true, 
    });

    if (authError) {
      throw new Error(authError.message);
    }

    if (authData.user) {
      // 3. USA UPSERT (Em vez de insert)
      const { error: perfilError } = await supabaseAdmin.from('perfis').upsert([{
        id: authData.user.id,
        nome: dados.nome,
        whatsapp: whatsappLimpo, 
        email: dados.email,
        tipo: 'professor'
      }]);

      if (perfilError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        
        if (perfilError.code === '23505') throw new Error("whatsapp_duplicado");
        throw new Error(perfilError.message);
      }
    }

    return NextResponse.json({ sucesso: true });

  } catch (error) {
    // Verificação de tipo segura para substituir o 'any'
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido";
    return NextResponse.json({ erro: errorMessage }, { status: 400 });
  }
}

// EXCLUIR PROFESSOR DEFINITIVAMENTE
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) throw new Error("ID não fornecido");

    // 1. Deleta a tabela 'perfis'
    const { error: perfilError } = await supabaseAdmin.from('perfis').delete().eq('id', id);
    if (perfilError) throw new Error(perfilError.message);

    // 2. Deleta do "Cofre" de logins do Supabase
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) throw new Error(authError.message);

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    // Verificação de tipo segura para substituir o 'any'
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido";
    return NextResponse.json({ erro: errorMessage }, { status: 400 });
  }
}