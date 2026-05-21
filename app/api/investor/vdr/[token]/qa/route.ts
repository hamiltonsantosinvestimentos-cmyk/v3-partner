import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

// Rota pública — investidor envia pergunta via link VDR sem auth Supabase
function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type RouteContext = { params: Promise<{ token: string }> };

// POST — investidor submete pergunta
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { subject, content } = body;

  if (!subject?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "subject e content são obrigatórios" }, { status: 422 });
  }

  const db = svc();

  // Validar token
  const { data: invite, error } = await db
    .from("deal_room_invites")
    .select("id, status, token_expires_at, deal_rooms(deal_id)")
    .eq("token", token)
    .single();

  if (error || !invite) return NextResponse.json({ error: "Token inválido." }, { status: 404 });
  if (invite.status === "revoked") return NextResponse.json({ error: "Acesso revogado." }, { status: 410 });
  if (new Date(invite.token_expires_at) < new Date()) return NextResponse.json({ error: "Link expirado." }, { status: 410 });

  // NDA deve estar assinado para perguntar
  const { data: nda } = await db.from("nda_signatures").select("id").eq("invite_id", invite.id).single();
  if (!nda) {
    return NextResponse.json({ error: "Assine o NDA antes de enviar perguntas.", requires_nda: true }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dealId = (invite.deal_rooms as any)?.deal_id;
  if (!dealId) return NextResponse.json({ error: "Deal não encontrado." }, { status: 404 });

  // Criar thread de Q&A no banco
  const { data: thread, error: threadErr } = await db
    .from("deal_qa_threads")
    .insert({
      deal_id:      dealId,
      subject:      subject.trim(),
      category:     "geral",
      priority:     "normal",
      status:       "open",
      initiated_by: "buyer",
      initiator_ref: invite.id,
    })
    .select("id")
    .single();

  if (threadErr) return NextResponse.json({ error: threadErr.message }, { status: 500 });

  // Inserir mensagem do investidor
  await db.from("deal_qa_messages").insert({
    thread_id:   thread.id,
    sender_type: "buyer",
    content:     content.trim(),
    is_published: true,
  });

  return NextResponse.json({ thread_id: thread.id, status: "open", message: "Pergunta enviada. Aguarde resposta da equipe V3 Partners." });
}

// GET — investidor consulta suas perguntas e respostas
export async function GET(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const db = svc();

  const { data: invite, error } = await db
    .from("deal_room_invites")
    .select("id, status, token_expires_at, deal_rooms(deal_id)")
    .eq("token", token)
    .single();

  if (error || !invite) return NextResponse.json({ error: "Token inválido." }, { status: 404 });
  if (new Date(invite.token_expires_at) < new Date()) return NextResponse.json({ error: "Link expirado." }, { status: 410 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dealId = (invite.deal_rooms as any)?.deal_id;

  const { data: threads } = await db
    .from("deal_qa_threads")
    .select(`
      id, subject, status, created_at,
      deal_qa_messages(id, sender_type, content, is_published, created_at)
    `)
    .eq("deal_id", dealId)
    .eq("initiator_ref", invite.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ threads: threads ?? [] });
}
