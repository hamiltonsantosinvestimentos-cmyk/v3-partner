import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

type RouteContext = { params: Promise<{ thread_id: string }> };

// ── POST /api/ma/qa/[thread_id] — responder thread ────────────────────────────
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { thread_id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const body = await req.json();
  const { content, sender_type = "mesa", publish_draft_id } = body;

  // Se estiver publicando um draft IA existente
  if (publish_draft_id) {
    const { error } = await db
      .from("deal_qa_messages")
      .update({ is_published: true, sender_profile_id: user.id })
      .eq("id", publish_draft_id)
      .eq("thread_id", thread_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await db.from("deal_qa_threads")
      .update({ status: "answered" })
      .eq("id", thread_id);

    return NextResponse.json({ published: true });
  }

  if (!content) return NextResponse.json({ error: "content obrigatório" }, { status: 422 });

  // Inserir resposta manual
  const { data: msg, error } = await db
    .from("deal_qa_messages")
    .insert({
      thread_id,
      sender_type,
      sender_profile_id: user.id,
      content,
      is_published: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Atualizar status do thread
  const newStatus = sender_type === "mesa" ? "answered" : "pending_seller";
  await db.from("deal_qa_threads")
    .update({ status: newStatus })
    .eq("id", thread_id);

  return NextResponse.json({ message_id: msg.id });
}

// ── PATCH /api/ma/qa/[thread_id] — atualizar status do thread ─────────────────
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { thread_id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const { status, thesis_impact, ai_summary } = await req.json();

  const updates: Record<string, string> = {};
  if (status) updates.status = status;
  if (thesis_impact) updates.thesis_impact = thesis_impact;
  if (ai_summary) updates.ai_summary = ai_summary;

  const { error } = await db.from("deal_qa_threads").update(updates).eq("id", thread_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ updated: true });
}
