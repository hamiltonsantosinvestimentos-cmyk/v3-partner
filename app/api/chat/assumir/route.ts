import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehMesa, salvarConversa, svc } from "@/lib/chat-partners";

// POST { room_id, soltar? } — a pessoa da Mesa assume (ou solta) a conversa.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { room_id, soltar } = (await req.json().catch(() => ({}))) as { room_id?: string; soltar?: boolean };
  if (!room_id) return NextResponse.json({ error: "room_id obrigatório" }, { status: 400 });
  const db = svc();
  const { data: p } = await db.from("profiles").select("full_name, role").eq("id", user.id).single();
  if (!ehMesa(p?.role as string)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const nome = (p?.full_name as string) ?? "Mesa V3";
  const r = await salvarConversa(db, room_id, soltar ? { responsavel_id: null, responsavel_nome: null } : { responsavel_id: user.id, responsavel_nome: nome });
  if (r.semMigration) return NextResponse.json({ error: "Disponível depois da atualização do banco (migration do chat)." }, { status: 503 });
  return NextResponse.json({ ok: r.ok, responsavel: soltar ? null : { id: user.id, nome } });
}
