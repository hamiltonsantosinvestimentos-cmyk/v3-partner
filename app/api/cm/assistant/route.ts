import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { getThesisTemplate } from "@/lib/thesis-templates";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA", "MESA_OPERACIONAL"];

interface AssistantMessage { role: "user" | "assistant"; content: string; ts?: string; }

async function requireAssistantUser(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) return null;
  return user;
}

// GET /api/cm/assistant?listing_id=... — devolve a conversa ja existente do
// usuario logado para este ativo, pra reidratar o chat ao reabrir o modal
// (antes desta correcao, o historico vivia so em useState e era perdido a
// cada fechamento).
export async function GET(req: NextRequest) {
  const user = await requireAssistantUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const listingId = req.nextUrl.searchParams.get("listing_id");
  if (!listingId) return NextResponse.json({ error: "listing_id obrigatório" }, { status: 422 });

  const { data: session } = await svc()
    .from("cm_asset_assistant_sessions")
    .select("messages")
    .eq("listing_id", listingId)
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ messages: (session?.messages as AssistantMessage[]) ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await requireAssistantUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { listing_id, question } = await req.json();
  if (!listing_id || !question) {
    return NextResponse.json({ error: "listing_id e question obrigatórios" }, { status: 422 });
  }

  const db = svc();

  // Historico real da conversa (listing_id + user), carregado do banco —
  // nunca do cliente, mesmo padrao de seguranca do chat dos Squads IA
  // (app/api/agentes/chat/route.ts, QW-6: previne prompt injection via
  // history vindo do front). Sem isso, a IA nao tinha memoria nem das
  // perguntas anteriores na MESMA sessao aberta.
  const { data: existingSession } = await db
    .from("cm_asset_assistant_sessions")
    .select("messages")
    .eq("listing_id", listing_id)
    .eq("user_id", user.id)
    .single();
  const dbHistory = (existingSession?.messages as AssistantMessage[]) ?? [];

  const { data: listing } = await db
    .from("cm_asset_listings")
    .select("anonymous_id, asset_type, ente_devedor, esfera, tribunal, natureza, valor_face, valor_atualizado, desagio_pretendido, tir_estimada, prazo_estimado_meses, risk_score, listing_status, conditional_blocks, metadata, selected_thesis_template")
    .eq("id", listing_id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });

  const { data: docs } = await db
    .from("cm_listing_documents")
    .select("document_type, original_filename, ocr_result, validation_status")
    .eq("listing_id", listing_id)
    .order("created_at", { ascending: true });

  const docContext = (docs ?? [])
    .filter((d) => d.ocr_result)
    .map((d) => {
      const label = d.document_type === "AUDIO" ? "TRANSCRIÇÃO DE ÁUDIO" : `DOCUMENTO (${d.document_type})`;
      const content = typeof d.ocr_result === "string" ? d.ocr_result : JSON.stringify(d.ocr_result);
      return `--- ${label}: ${d.original_filename ?? "sem nome"} ---\n${content}`;
    })
    .join("\n\n");

  const thesis = getThesisTemplate(listing.selected_thesis_template as string | null);

  const systemPrompt = `Você é o Assistente do Ativo ${listing.anonymous_id} da V3 Partners.
Sua função é responder perguntas EXCLUSIVAMENTE com base nos documentos e dados deste ativo.
NUNCA invente informações. Se a resposta não estiver nos documentos, diga "Não encontrei essa informação nos documentos disponíveis."
${thesis ? `\nTESE COMERCIAL ATIVA PARA ESTE ATIVO (Switcher de Teses): ${thesis.label}. ${thesis.promptFragment}\nEnquadre suas respostas comerciais dentro desse ângulo sempre que fizer sentido, sem nunca inventar dado que não esteja nos documentos.\n` : ""}

DADOS DO ATIVO:
- ID: ${listing.anonymous_id}
- Tipo: ${listing.asset_type}
- Ente Devedor: ${listing.ente_devedor ?? "N/I"}
- Esfera: ${listing.esfera ?? "N/I"} | Tribunal: ${listing.tribunal ?? "N/I"}
- Natureza: ${listing.natureza ?? "N/I"}
- Valor de Face: R$ ${listing.valor_face?.toLocaleString("pt-BR") ?? "N/I"}
- Deságio Pretendido: ${listing.desagio_pretendido ?? "N/I"}%
- TIR Estimada: ${listing.tir_estimada ?? "N/I"}%
- Prazo Estimado: ${listing.prazo_estimado_meses ?? "N/I"} meses
- Risk Score: ${listing.risk_score ?? "N/I"}/100
- Status: ${listing.listing_status}

${docContext ? `DOCUMENTOS DISPONÍVEIS (${docs?.length ?? 0}):\n${docContext}` : "NENHUM DOCUMENTO DISPONÍVEL."}`;

  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      ...dbHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: question },
    ],
  });

  const answer = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const now = new Date().toISOString();
  const newMessages: AssistantMessage[] = [
    ...dbHistory,
    { role: "user", content: question, ts: now },
    { role: "assistant", content: answer, ts: now },
  ];

  await db.from("cm_asset_assistant_sessions").upsert(
    { listing_id, user_id: user.id, messages: newMessages },
    { onConflict: "listing_id,user_id" }
  );

  return NextResponse.json({
    answer,
    listing_id,
    anonymous_id: listing.anonymous_id,
    docs_loaded: docs?.filter((d) => d.ocr_result).length ?? 0,
  });
}
