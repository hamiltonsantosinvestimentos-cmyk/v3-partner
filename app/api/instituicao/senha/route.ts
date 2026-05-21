import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/instituicao/senha — envia email de redefinição de senha
export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: "Email obrigatório." }, { status: 400 });

  // Verifica se o email pertence a uma instituição cadastrada
  const { data: inst } = await svc()
    .from("instituicoes")
    .select("id, email")
    .eq("email", email)
    .single();

  if (!inst) {
    // Retorna sucesso mesmo se não encontrado (segurança)
    return NextResponse.json({ success: true });
  }

  const { error } = await svc().auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/instituicao/redefinir-senha`,
    },
  });

  if (error) return NextResponse.json({ error: "Erro ao enviar email de redefinição." }, { status: 500 });
  return NextResponse.json({ success: true });
}
