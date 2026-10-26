import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehMesa, marcarLido, salaDoPartner, svc } from "@/lib/chat-partners";

// POST { room_id } — marca a conversa como lida pelo lado de quem chama (Mesa ou partner).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { room_id } = (await req.json().catch(() => ({}))) as { room_id?: string };
  if (!room_id) return NextResponse.json({ error: "room_id obrigatório" }, { status: 400 });
  const db = svc();
  const { data: p } = await db.from("profiles").select("role").eq("id", user.id).single();
  const mesa = ehMesa(p?.role as string);
  if (!mesa && room_id !== salaDoPartner(user.id)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return NextResponse.json(await marcarLido(db, room_id, mesa ? "mesa" : "partner"));
}
