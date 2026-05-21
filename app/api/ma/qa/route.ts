import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

const CATEGORY_PROMPT = `Você é um assistente de M&A da V3 Partners.
Analise a pergunta abaixo e retorne um JSON com:
- category: "financeiro" | "juridico" | "operacional" | "estrutura" | "due_diligence" | "geral"
- priority: "low" | "normal" | "high" | "urgent"
- ai_draft: rascunho de resposta em PT-BR (máximo 3 parágrafos, tom institucional)
- ai_confidence: número de 0 a 1 indicando confiança na resposta draft
Responda APENAS com JSON válido, sem markdown.`;

// ── GET /api/ma/qa?deal_id=... ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const deal_id = new URL(req.url).searchParams.get("deal_id");
  if (!deal_id) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  const { data: threads, error } = await db
    .from("deal_qa_threads")
    .select(`
      id, subject, category, priority, status, initiated_by,
      ai_summary, thesis_impact, created_at, updated_at,
      deal_qa_messages (
        id, sender_type, sender_profile_id, content,
        is_ai_draft, is_published, ai_confidence, created_at,
        profiles:sender_profile_id (full_name)
      )
    `)
    .eq("deal_id", deal_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ threads: threads ?? [] });
}

// ── POST /api/ma/qa ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const body = await req.json();
  const { deal_id, subject, content, initiated_by = "mesa" } = body;

  if (!deal_id || !subject || !content) {
    return NextResponse.json({ error: "deal_id, subject e content são obrigatórios" }, { status: 422 });
  }

  // 1. Claude Haiku classifica e gera draft
  let category = "geral";
  let priority = "normal";
  let ai_draft = "";
  let ai_confidence = 0;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const aiRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `${CATEGORY_PROMPT}\n\nPergunta: "${subject}"\n\nContexto adicional: "${content}"`
      }]
    });

    const raw = (aiRes.content[0] as { type: string; text: string }).text.trim();
    const parsed = JSON.parse(raw);
    category = parsed.category ?? "geral";
    priority = parsed.priority ?? "normal";
    ai_draft = parsed.ai_draft ?? "";
    ai_confidence = parsed.ai_confidence ?? 0;
  } catch {
    // Claude falhou — continua sem draft
  }

  // 2. Criar thread
  const { data: thread, error: threadErr } = await db
    .from("deal_qa_threads")
    .insert({ deal_id, subject, category, priority, initiated_by })
    .select()
    .single();

  if (threadErr) return NextResponse.json({ error: threadErr.message }, { status: 500 });

  // 3. Inserir mensagem original
  await db.from("deal_qa_messages").insert({
    thread_id: thread.id,
    sender_type: initiated_by,
    sender_profile_id: user.id,
    content,
    is_published: true,
  });

  // 4. Inserir draft IA se gerado
  if (ai_draft) {
    await db.from("deal_qa_messages").insert({
      thread_id: thread.id,
      sender_type: "ai_draft",
      content: ai_draft,
      ai_confidence,
      is_ai_draft: true,
      is_published: false,
    });
  }

  return NextResponse.json({ thread_id: thread.id, category, priority, has_draft: !!ai_draft });
}
