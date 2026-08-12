import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getRole(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await svc().from("profiles").select("role").eq("id", user.id).single();
    return (data?.role as string) ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const role = await getRole();
  if (!ALLOWED_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { data, error } = await svc()
    .from("instituicoes")
    .select("*, linhas:instituicoes_linhas(*)")
    .order("nome");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ instituicoes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const role = await getRole();
  if (!ALLOWED_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.nome) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const { data, error } = await svc()
    .from("instituicoes")
    .insert([{
      nome: body.nome,
      cnpj: body.cnpj ?? null,
      email: body.email ?? "",
      status: body.status ?? "ativo",
      contato_nome: body.contato_nome ?? null,
      contato_telefone: body.contato_telefone ?? null,
      contato_email: body.contato_email ?? null,
      portal_url: body.portal_url ?? null,
      portal_usuario: body.portal_usuario ?? null,
      portal_senha: body.portal_senha ?? null,
      observacoes: body.observacoes ?? null,
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ instituicao: data });
}
