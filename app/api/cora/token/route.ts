import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCoraToken, CORA_BASE } from "@/lib/cora";

// Testa a autenticação e retorna informações básicas da conta
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO", "FINANCEIRO"].includes((profile as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const token = await getCoraToken();
    return NextResponse.json({ ok: true, env: process.env.CORA_ENV, base: CORA_BASE, tokenPreview: token.slice(0, 20) + "..." });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
