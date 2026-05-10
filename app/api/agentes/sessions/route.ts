import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

// GET — list sessions for user
export async function GET(req: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const squad_id = searchParams.get("squad_id");
  const session_id = searchParams.get("session_id");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Busca sessao individual com historico de mensagens
  if (session_id) {
    const { data, error } = await svc
      .from("agent_sessions")
      .select("id, squad_id, title, messages, created_at, updated_at")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
  }

  // Lista sessoes do usuario (sem mensagens para economizar bandwidth)
  let query = svc
    .from("agent_sessions")
    .select("id, squad_id, title, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (squad_id) query = query.eq("squad_id", squad_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessions: data ?? [] });
}

// DELETE — archive session
export async function DELETE(req: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { session_id } = await req.json() as { session_id: string };
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  await svc
    .from("agent_sessions")
    .update({ archived: true })
    .eq("id", session_id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
