import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface Params { params: Promise<{ id: string }> }

// GET — histórico de pedidos de um Link de Serviço específico (14/09/2026,
// pedido de João: "visualizar o histórico dos links gerados"). Antes só
// existia o total agregado (total_uses/total_paid_cents) na listagem, sem
// nenhuma forma de ver quem de fato usou cada link.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = ["ADMIN", "GESTAO"].includes((profile as { role: string } | null)?.role ?? "");

  const db = svc();

  const { data: link } = await db
    .from("partner_service_links")
    .select("id, partner_id, title")
    .eq("id", id)
    .single();
  if (!link) return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
  if (!isAdmin && link.partner_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { data: orders, error } = await db
    .from("partner_service_orders")
    .select("id, client_name, client_email, status, amount_cents, created_at, paid_at")
    .eq("link_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link_title: link.title, orders: orders ?? [] });
}
