import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

type RouteContext = { params: Promise<{ deal_id: string; id: string }> };

async function requireRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED.includes(profile.role as string)) return null;
  return { userId: user.id };
}

// PATCH — a Mesa define/corrige o papel (comprador/vendedor/intermediario).
// Status não é editável aqui de propósito: as transições (prospecto →
// a_performar → performado) são automáticas, ligadas a evento real
// (assinatura de contrato, fechamento do deal), nunca escolha manual — ver
// app/api/ma/clicksign-webhook e app/api/ma-deals (PATCH stage=CLOSED_WON).
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { deal_id: dealId, id } = await ctx.params;

  const body = await req.json();
  const { role } = body as { role?: string | null };
  if (role !== null && role !== undefined && !["comprador", "vendedor", "intermediario"].includes(role)) {
    return NextResponse.json({ error: "Papel inválido: use comprador, vendedor ou intermediario" }, { status: 422 });
  }

  const { data, error } = await svc()
    .from("ma_deal_clients")
    .update({ role: role ?? null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("deal_id", dealId)
    .select("id, role, status, v3_clients(id, document_number, document_type, legal_name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cliente: data });
}

// DELETE — desvincula o cliente deste deal (nunca apaga o v3_clients em si,
// só a relação com este deal específico).
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { deal_id: dealId, id } = await ctx.params;

  const { error } = await svc().from("ma_deal_clients").delete().eq("id", id).eq("deal_id", dealId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
