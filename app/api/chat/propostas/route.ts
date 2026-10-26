import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehMesa, salaDoPartner, svc } from "@/lib/chat-partners";

export const dynamic = "force-dynamic";

// GET ?room_id=partner_<id> — propostas do partner da sala (seletor "vincular proposta").
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const room_id = req.nextUrl.searchParams.get("room_id") ?? "";
  if (!room_id.startsWith("partner_")) return NextResponse.json({ propostas: [] });
  const db = svc();
  const { data: p } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ehMesa(p?.role as string) && room_id !== salaDoPartner(user.id)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { data, error } = await db.from("credit_desk_proposals")
    .select("id, code, client_name, credit_line, requested_value, stage, status, pending_reason")
    .eq("partner_id", room_id.slice(8)).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ propostas: data ?? [] });
}
