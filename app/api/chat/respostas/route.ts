import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehMesa, faltaMigration, svc } from "@/lib/chat-partners";

export const dynamic = "force-dynamic";

async function idDaMesa() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await svc().from("profiles").select("role").eq("id", user.id).single();
  return ehMesa(p?.role as string) ? user.id : null;
}
const atalhoLimpo = (s: string) => s.trim().toLowerCase().replace(/^\//, "").replace(/[^a-z0-9-]/g, "-").slice(0, 30);

// Respostas prontas: /atalho no campo de mensagem da Mesa.
export async function GET() {
  if (!(await idDaMesa())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { data, error } = await svc().from("chat_respostas_prontas").select("*").order("atalho");
  if (error) return NextResponse.json({ respostas: [], semMigration: faltaMigration(error) });
  return NextResponse.json({ respostas: data ?? [] });
}

// POST { id?, atalho, titulo, texto } — cria ou edita
export async function POST(req: NextRequest) {
  const eu = await idDaMesa();
  if (!eu) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; atalho?: string; titulo?: string; texto?: string };
  const atalho = atalhoLimpo(b.atalho ?? "");
  if (!atalho || !b.titulo?.trim() || !b.texto?.trim()) return NextResponse.json({ error: "Preencha atalho, título e texto" }, { status: 400 });
  const linha = { atalho, titulo: b.titulo.trim().slice(0, 80), texto: b.texto.trim().slice(0, 4000), updated_at: new Date().toISOString() };
  const db = svc();
  const r = b.id
    ? await db.from("chat_respostas_prontas").update(linha).eq("id", b.id).select().single()
    : await db.from("chat_respostas_prontas").insert({ ...linha, criado_por: eu }).select().single();
  if (r.error) {
    const msg = faltaMigration(r.error) ? "Disponível depois da atualização do banco (migration do chat)."
      : r.error.code === "23505" ? `Já existe uma resposta com o atalho /${atalho}.` : r.error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ resposta: r.data });
}

export async function DELETE(req: NextRequest) {
  if (!(await idDaMesa())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const { error } = await svc().from("chat_respostas_prontas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
