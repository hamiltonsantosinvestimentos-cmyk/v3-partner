import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehMesa, svc } from "@/lib/chat-partners";

export const dynamic = "force-dynamic";

// GET ?q=texto — busca no histórico de todas as conversas (só Mesa).
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = svc();
  const { data: p } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ehMesa(p?.role as string)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().replace(/[%_,()*]/g, " ").slice(0, 80);
  if (q.length < 2) return NextResponse.json({ resultados: [] });
  const { data, error } = await db.from("chat_messages")
    .select("id, room_id, sender_name, content, created_at")
    .or("room_id.like.partner_%,room_id.like.instituicao_%")
    .ilike("content", `%${q}%`).order("created_at", { ascending: false }).limit(40);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ resultados: data ?? [] });
}
