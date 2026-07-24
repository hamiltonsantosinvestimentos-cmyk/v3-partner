import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { lookupDealByCode } from "@/lib/deal-lookup";

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// ── GET /api/propostas/deal-lookup?code=... ─────────────────────────────────
// Busca um deal por código para pré-preencher o formulário de Nova Proposta.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "Parâmetro 'code' obrigatório" }, { status: 422 });

  const result = await lookupDealByCode(code);
  if (!result.found) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  return NextResponse.json(result);
}
