import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehMesa, faltaMigration, svc } from "@/lib/chat-partners";

export const dynamic = "force-dynamic";

async function pessoaDaMesa() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await svc().from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return ehMesa(p?.role as string) ? (p as { id: string; full_name: string | null }) : null;
}

// Notas internas da conversa: só a Mesa vê (tabela separada de chat_messages).
export async function GET(req: NextRequest) {
  if (!(await pessoaDaMesa())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const room_id = req.nextUrl.searchParams.get("room_id");
  if (!room_id) return NextResponse.json({ error: "room_id obrigatório" }, { status: 400 });
  const { data, error } = await svc().from("chat_notas_internas").select("*").eq("room_id", room_id).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ notas: [], semMigration: faltaMigration(error) });
  return NextResponse.json({ notas: data ?? [] });
}

export async function POST(req: NextRequest) {
  const eu = await pessoaDaMesa();
  if (!eu) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { room_id, conteudo } = (await req.json().catch(() => ({}))) as { room_id?: string; conteudo?: string };
  if (!room_id || !conteudo?.trim()) return NextResponse.json({ error: "Escreva a nota" }, { status: 400 });
  const { data, error } = await svc().from("chat_notas_internas")
    .insert({ room_id, conteudo: conteudo.trim().slice(0, 4000), autor_id: eu.id, autor_nome: eu.full_name ?? "Mesa V3" })
    .select().single();
  if (error) {
    return NextResponse.json({ error: faltaMigration(error) ? "Disponível depois da atualização do banco (migration do chat)." : error.message }, { status: 500 });
  }
  return NextResponse.json({ nota: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const eu = await pessoaDaMesa();
  if (!eu) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const { error } = await svc().from("chat_notas_internas").delete().eq("id", id).eq("autor_id", eu.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
