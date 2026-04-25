import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET — últimas sessões de conversa do usuário
export async function GET() {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error } = await serviceClient()
    .from("ai_conversations")
    .select("id, title, messages, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ sessions: [] });
  return NextResponse.json({ sessions: data ?? [] });
}

// POST — salva ou atualiza uma sessão de conversa
export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { session_id, messages, title } = body as {
    session_id?: string;
    messages: Array<{ role: string; content: string }>;
    title?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const sessionTitle = title ?? (messages[0]?.content?.slice(0, 80) ?? "Nova conversa");
  const svc = serviceClient();
  const now = new Date().toISOString();

  if (session_id) {
    // Atualiza sessão existente
    const { data, error } = await svc
      .from("ai_conversations")
      .update({ messages, title: sessionTitle, updated_at: now })
      .eq("id", session_id)
      .eq("user_id", user.id)
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, session_id: data.id });
  }

  // Cria nova sessão
  const { data, error } = await svc
    .from("ai_conversations")
    .insert({ user_id: user.id, messages, title: sessionTitle, created_at: now, updated_at: now })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, session_id: data.id });
}

// DELETE — remove uma sessão
export async function DELETE(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "session_id obrigatório" }, { status: 400 });

  await serviceClient()
    .from("ai_conversations")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
