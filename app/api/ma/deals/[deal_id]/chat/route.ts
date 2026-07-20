import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ALLOWED = ["ADMIN", "GESTAO", "MESA", "MESA_OPERACIONAL"];

interface Message { role: "user" | "assistant"; content: string; ts?: string; }

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface PendingDoc { doc_name: string | null; status: string | null; tipo_documento?: string | null; }

function buildDealContext(
  deal: Record<string, unknown>,
  extractions: Record<string, unknown>[],
  pendingDocs: PendingDoc[]
): string {
  const asset = (deal.asset_data as Record<string, unknown>) ?? {};
  const forja = asset.forja_result as Record<string, unknown> | null;

  const fmt = (v: unknown) =>
    v ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "não informado";

  let ctx = `DEAL: ${deal.title ?? deal.code} (${deal.v3_code ?? deal.code})
Setor: ${deal.sector ?? "não informado"}
Localização: ${deal.location ?? "não informada"}
Valor do deal: ${fmt(deal.deal_value)}
EBITDA TTM: ${fmt(deal.ebitda_ttm)}
Receita TTM: ${fmt(deal.revenue_ttm)}
Notas internas: ${deal.notes ?? "nenhuma"}`;

  if (forja) {
    const teseRaw = forja.tese_investimento;
    const tese = Array.isArray(teseRaw) ? teseRaw.join(" ") : String(teseRaw ?? "N/A");

    const missingRaw = forja.missing;
    const missing = Array.isArray(missingRaw)
      ? (missingRaw as Record<string, unknown>[])
          .map(m => `${m.field ?? "?"} (${m.priority ?? "?"})`)
          .join("; ")
      : "nenhum";

    const riscosRaw = asset.riscos;
    const riscos = Array.isArray(riscosRaw)
      ? (riscosRaw as Record<string, unknown>[])
          .map(r => `[${r.nivel ?? "?"}] ${r.descricao ?? "?"}`)
          .join("; ")
      : "não informado";

    ctx += `\n\nANÁLISE FORJA:
Score: ${forja.score ?? "N/A"} / 100
Status: ${asset.forja_status ?? forja.recommendation ?? "N/A"}
Justificativa: ${forja.recommendation_note ?? "N/A"}
Tese de investimento: ${tese.slice(0, 1200)}
Gaps críticos (missing): ${missing.slice(0, 800)}
Riscos declarados: ${riscos.slice(0, 600)}`;
  }

  if (extractions.length > 0) {
    ctx += "\n\nDOCUMENTOS EXTRAÍDOS VIA OCR:";
    for (const ext of extractions) {
      const isLowConf = ext.status === "needs_review";
      const confLabel = isLowConf
        ? `confiabilidade: ${ext.confiabilidade ?? "?"}% — ATENÇÃO: documento com baixa confiança, aguardando revisão manual`
        : `confiabilidade: ${ext.confiabilidade ?? "?"}%`;
      ctx += `\n\n[${ext.tipo_documento ?? ext.doc_name}] (${confLabel})`;
      if (ext.resumo) ctx += `\nResumo: ${String(ext.resumo).slice(0, 1500)}`;
      if (ext.dados_extraidos) {
        ctx += `\nDados: ${JSON.stringify(ext.dados_extraidos).slice(0, 800)}`;
      }
    }
  }

  if (pendingDocs.length > 0) {
    const statusLabel: Record<string, string> = {
      pending: "aguardando processamento OCR",
      needs_review: "necessita revisão manual",
      failed: "falha na extração OCR",
    };
    ctx += `\n\nDOCUMENTOS AINDA NÃO PROCESSADOS (${pendingDocs.length} arquivo${pendingDocs.length > 1 ? "s" : ""}):`;
    for (const doc of pendingDocs) {
      const label = statusLabel[doc.status ?? ""] ?? doc.status ?? "status desconhecido";
      ctx += `\n- ${doc.doc_name ?? doc.tipo_documento ?? "documento sem nome"} — ${label}`;
    }
    ctx += `\nATENÇÃO: Os documentos acima existem no sistema mas ainda não foram lidos pelo OCR. Suas informações NÃO estão disponíveis neste contexto. Informe a equipe quando esses dados forem relevantes para a pergunta.`;
  }

  return ctx;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deal_id: string }> }
) {
  const { deal_id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? ""))
    return NextResponse.json({ error: "Acesso restrito a ADMIN, GESTAO, MESA e MESA_OPERACIONAL" }, { status: 403 });

  const { message, session_id } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });

  // Carrega deal
  const { data: deal } = await db
    .from("ma_deals")
    .select("id, code, title, sector, deal_value, ebitda_ttm, revenue_ttm, notes, asset_data, v3_code, location")
    .eq("id", deal_id)
    .single();

  if (!deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  // Carrega extrações concluídas + needs_review + done (até 5 mais recentes)
  const { data: extractions } = await db
    .from("ma_document_extractions")
    .select("doc_name, tipo_documento, resumo, dados_extraidos, confiabilidade, status")
    .eq("deal_id", deal_id)
    .in("status", ["completed", "needs_review", "done"])
    .order("extracted_at", { ascending: false })
    .limit(5);

  // Documentos ainda não processados (apenas pending / failed — needs_review já entra no contexto)
  const { data: unprocessed } = await db
    .from("ma_document_extractions")
    .select("doc_name, tipo_documento, status")
    .eq("deal_id", deal_id)
    .in("status", ["pending", "failed"]);

  const pendingDocs: PendingDoc[] = (unprocessed ?? []).map(d => ({
    doc_name: d.doc_name as string | null,
    status: d.status as string | null,
    tipo_documento: d.tipo_documento as string | null,
  }));

  const dealContext = buildDealContext(
    deal as Record<string, unknown>,
    (extractions ?? []) as Record<string, unknown>[],
    pendingDocs
  );

  const systemPrompt = `Você é o analista de IA dedicado ao deal "${deal.title ?? deal.code}" da V3 Partners — Mesa M&A interna.

REGRA ABSOLUTA — ANTI-ALUCINAÇÃO:
Você conhece APENAS o que está no CONTEXTO abaixo. Não invente valores, nomes, datas, percentuais ou quaisquer dados que não estejam explicitamente neste contexto. Se uma informação não constar, diga exatamente: "essa informação não está disponível nos documentos deste deal." Nunca extrapole, nunca assuma.

Sua função é ajudar a equipe interna da Mesa M&A a:
1. Validar e construir a tese de investimento com base nos dados reais
2. Identificar inconsistências ou lacunas na documentação
3. Ajustar narrativa e argumentação com base nos documentos extraídos
4. Responder perguntas específicas sobre o ativo usando os dados como fonte primária

Tom: técnico, direto, institucional. Interlocutor é equipe sênior de M&A.

━━━ CONTEXTO DO DEAL ━━━
${dealContext}
━━━━━━━━━━━━━━━━━━━━━━━`;

  // Histórico da sessão (carregado do banco — nunca do cliente)
  let dbHistory: Message[] = [];
  if (session_id) {
    const { data: existing } = await db
      .from("agent_sessions")
      .select("messages")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .eq("deal_id", deal_id)
      .single();
    dbHistory = (existing?.messages as Message[]) ?? [];
  }

  const claudeMessages = [
    ...dbHistory.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "API key não configurada" }, { status: 500 });

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: claudeMessages,
    });

    const assistantText = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");

    const now = new Date().toISOString();
    const newMessages: Message[] = [
      ...dbHistory,
      { role: "user", content: message, ts: now },
      { role: "assistant", content: assistantText, ts: now },
    ];

    let finalSessionId = session_id;
    if (session_id) {
      await db.from("agent_sessions")
        .update({ messages: newMessages, updated_at: now })
        .eq("id", session_id)
        .eq("user_id", user.id);
    } else {
      const title = `Chat IA · ${deal.title ?? deal.code} · ${new Date().toLocaleDateString("pt-BR")}`;
      const { data: newSession } = await db
        .from("agent_sessions")
        .insert({ user_id: user.id, squad_id: "deal-ia", title, messages: newMessages, deal_id })
        .select("id")
        .single();
      finalSessionId = newSession?.id ?? null;
    }

    const docsLoaded = (extractions ?? []).length;
    return NextResponse.json({
      response: assistantText,
      session_id: finalSessionId,
      docs_loaded: docsLoaded,
      docs_pending: pendingDocs.length,
    });
  } catch (err) {
    console.error("[deal-ia-chat]", err);
    return NextResponse.json({ error: "Erro interno no processamento" }, { status: 500 });
  }
}
