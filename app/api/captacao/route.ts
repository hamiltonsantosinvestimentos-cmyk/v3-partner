import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — valida token (público, sem auth)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { data, error } = await svc
    .from("captacao_links")
    .select("id, token, partner_id, partner_name, active, uses_count, created_at")
    .eq("token", token)
    .single();

  if (error || !data) return NextResponse.json({ error: "Link inválido ou não encontrado" }, { status: 404 });
  if (!data.active) return NextResponse.json({ error: "Este link foi desativado" }, { status: 410 });

  return NextResponse.json({ ok: true, partner_name: data.partner_name });
}

// POST — gera novo link (autenticado, PARTNER / PARTNER_PRO / ADMIN)
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("id, full_name, role").eq("id", user.id).single();

  if (!["PARTNER", "PARTNER_PRO", "ADMIN"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Apenas Partners podem gerar links de captação" }, { status: 403 });
  }

  const token = randomBytes(20).toString("hex");
  const svc = serviceClient();

  const { data, error } = await svc.from("captacao_links").insert({
    token,
    partner_id: user.id,
    partner_name: profile?.full_name ?? "Partner",
    active: true,
    uses_count: 0,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, token: data.token, id: data.id });
}

// PATCH — ativa/desativa link
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id, active } = await req.json();
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { error } = await svc.from("captacao_links").update({ active }).eq("id", id).eq("partner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// GET /api/captacao/links — lista links do partner (chamada separada via query param)
// Reutilizamos o mesmo GET com ?list=1
