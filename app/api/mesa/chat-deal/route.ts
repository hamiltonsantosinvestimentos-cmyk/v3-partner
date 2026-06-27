import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

interface Message { role: "user" | "assistant"; content: string; ts?: string; }

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles").select("id, full_name, role").eq("id", user.id).single();

  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Acesso restrito à mesa operacional" }, { status: 403 });
  }

  const body = await req.json() as {
    proposal_id: string;
    message: string;
    session_id?: string;
  };

  const { proposal_id, message, session_id } = body;
  if (!proposal_id) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });
  if (!message?.trim()) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });

  // ── Busca proposta completa ─────────────────────────────────────────────────
  const { data: proposal, error: propErr } = await svc()
    .from("credit_desk_proposals")
    .select(`
      id, code, title, client_name, client_cpf_cnpj, credit_line,
      requested_value, approved_value, current_level, status, stage,
      level1_notes, level2_notes, level3_notes,
      level1_at, level2_at, level3_at,
      documents, mesa_comments, metadata, created_at,
      partner:profiles!partner_id(id, full_name)
    `)
    .eq("id", proposal_id)
    .single();

  if (propErr || !proposal) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  // ── Monta contexto ──────────────────────────────────────────────────────────
  const meta = (proposal.metadata as Record<string, unknown>) ?? {};
  const partnerName = (proposal.partner as { full_name?: string } | null)?.full_name ?? "Não identificado";
  const docs = Array.isArray(proposal.documents)
    ? (proposal.documents as Array<{ doc_id: string; file_name: string }>)
    : [];

  const comments = Array.isArray(proposal.mesa_comments)
    ? (proposal.mesa_comments as Array<{ author: string; text: string; created_at: string }>)
        .map(c => `[${new Date(c.created_at).toLocaleDateString("pt-BR")}] ${c.author}: ${c.text}`)
        .join("\n")
    : "Nenhum comentário registrado.";

  const notasNivel = [
    proposal.level1_notes && `Nível 1 (${proposal.level1_at ? new Date(proposal.level1_at).toLocaleDateString("pt-BR") : ""}): ${proposal.level1_notes}`,
    proposal.level2_notes && `Nível 2 (${proposal.level2_at ? new Date(proposal.level2_at).toLocaleDateString("pt-BR") : ""}): ${proposal.level2_notes}`,
    proposal.level3_notes && `Nível 3 (${proposal.level3_at ? new Date(proposal.level3_at).toLocaleDateString("pt-BR") : ""}): ${proposal.level3_notes}`,
  ].filter(Boolean).join("\n") || "Sem notas de analistas.";

  // ── OCR resultados ─────────────────────────────────────────────────────────
  type OcrCampo = { campo: string; extraido: string | null; status: string; mensagem: string };
  type OcrResultado = {
    tipo_documento: string;
    resumo: "aprovado" | "atencao" | "reprovado";
    observacoes: string;
    campos: OcrCampo[];
    doc_check?: { resumo_linha: string; cliente_confere: boolean; status: string };
    extrato_info?: { banco: string; periodo: string; media_entrada_mensal: number | null; media_entrada_formatada: string };
  };

  const ocrResultados = (meta.ocr_resultados ?? null) as Record<string, OcrResultado> | null;
  const ocrEntries = ocrResultados ? Object.entries(ocrResultados) : [];

  let ocrCtx = "";
  if (ocrEntries.length > 0) {
    const emoji = { aprovado: "✅", atencao: "⚠️", reprovado: "❌" } as const;
    ocrCtx = "\n\nRESULTADOS OCR DOS DOCUMENTOS ANALISADOS:";
    for (const [, r] of ocrEntries) {
      ocrCtx += `\n\n[${r.tipo_documento}] ${emoji[r.resumo] ?? "?"} ${r.resumo.toUpperCase()}`;
      if (r.doc_check?.resumo_linha) ocrCtx += `\n  Conferência: ${r.doc_check.resumo_linha}`;
      if (r.observacoes) ocrCtx += `\n  Observações: ${r.observacoes}`;
      if (r.extrato_info) {
        const e = r.extrato_info;
        ocrCtx += `\n  Banco: ${e.banco} | Período: ${e.periodo} | Média de entrada: ${e.media_entrada_formatada ?? "não calculada"}`;
      }
      const divergentes = (r.campos ?? []).filter(c => c.status === "divergente" || c.status === "ausente");
      if (divergentes.length > 0) {
        ocrCtx += `\n  Divergências: ${divergentes.map(c => `${c.campo} — ${c.mensagem}`).join("; ")}`;
      }
    }
  } else {
    ocrCtx = "\n\nOCR: Nenhum documento foi analisado via OCR ainda.";
  }

  const contextoProposta = `
PROPOSTA: ${proposal.code}
CLIENTE: ${proposal.client_name}
CPF/CNPJ: ${proposal.client_cpf_cnpj ?? "Não informado"}
LINHA DE CRÉDITO: ${proposal.credit_line}
NÍVEL: ${proposal.current_level ?? "N1"}
CAPITAL SOLICITADO: ${fmtCurrency(proposal.requested_value)}
CAPITAL APROVADO: ${proposal.approved_value ? fmtCurrency(proposal.approved_value) : "Não aprovado"}
STATUS: ${proposal.status}
STAGE ATUAL: ${proposal.stage ?? "RECEBIDO"}
PARTNER RESPONSÁVEL: ${partnerName}
DATA DE ENTRADA: ${new Date(proposal.created_at).toLocaleDateString("pt-BR")}

DADOS DO CLIENTE:
- Tipo: ${(meta.client_type as string) ?? "Não informado"}
- Email: ${(meta.email as string) ?? "Não informado"}
- Telefone: ${(meta.telefone as string) ?? "Não informado"}
- Renda/Faturamento mensal: ${meta.renda_mensal ? fmtCurrency(meta.renda_mensal as number) : meta.faturamento_mensal ? fmtCurrency(meta.faturamento_mensal as number) : "Não informado"}
- Prazo desejado: ${(meta.prazo as string) ?? "Não informado"}
- Finalidade: ${(meta.finalidade as string) ?? "Não informada"}
- Restrições no CPF/CNPJ: ${(meta.restricao_cliente as string) ?? "Não informado"}
- Endereço: ${(meta.endereco_rua as string) ?? ""} ${(meta.endereco_cidade as string) ?? ""} ${(meta.endereco_uf as string) ?? ""}

DOCUMENTOS ANEXADOS (${docs.length}):
${docs.map(d => `- ${d.file_name}`).join("\n") || "Nenhum documento anexado."}

NOTAS DOS ANALISTAS:
${notasNivel}

COMENTÁRIOS DA MESA:
${comments}
${ocrCtx}`;

  const SYSTEM_PROMPT = `Você é um analista sênior de crédito da V3 Partners, boutique institucional de securitização e estruturação financeira.

Você está assistindo a equipe da Mesa Operacional a analisar a proposta de crédito abaixo. Responda perguntas sobre o cliente, avalie riscos, identifique pendências, sugira encaminhamentos e oriente sobre as linhas de crédito disponíveis.

Linhas de crédito V3: Home Equity, Home Cash, Crédito com Garantia de Imóvel (CGI), Crédito com Garantia de Precatórios, Crédito Estruturado, CRI, FIDC.
Ticket mínimo: R$ 500.000. Crédito pessoal/consignado: EXCLUÍDO do escopo.

REGRA ANTI-ALUCINAÇÃO: Baseie suas respostas EXCLUSIVAMENTE nos dados do contexto abaixo. Se uma informação não constar, diga "não disponível nos documentos analisados". Nunca invente valores, datas ou conclusões sem base nos dados fornecidos.

Quando houver resultados de OCR, use-os como fonte primária para validar dados do cliente. Aponte divergências entre o declarado e o extraído dos documentos.

Tom: direto, técnico, institucional. Use bullet points quando listar. Seja objetivo e assertivo.

--- CONTEXTO DA PROPOSTA ---
${contextoProposta}`;

  // ── Carrega histórico do banco ──────────────────────────────────────────────
  let dbHistory: Message[] = [];
  if (session_id) {
    const { data: existingSession } = await svc()
      .from("agent_sessions")
      .select("messages")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .single();
    dbHistory = (existingSession?.messages as Message[]) ?? [];
  }

  // ── Chama Claude ────────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "API key não configurada" }, { status: 500 });

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey });

  const claudeMessages = [
    ...dbHistory.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  let assistantText: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: claudeMessages,
    });
    assistantText = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");
  } catch (err) {
    console.error("[mesa/chat-deal]", err);
    return NextResponse.json({ error: "Erro ao processar mensagem" }, { status: 500 });
  }

  // ── Persiste conversa ───────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const newMessages: Message[] = [
    ...dbHistory,
    { role: "user", content: message, ts: now },
    { role: "assistant", content: assistantText, ts: now },
  ];

  let finalSessionId = session_id;
  if (session_id) {
    await svc().from("agent_sessions")
      .update({ messages: newMessages, updated_at: now })
      .eq("id", session_id).eq("user_id", user.id);
  } else {
    const title = `Chat: ${proposal.client_name} (${proposal.code})`;
    const { data: newSession } = await svc().from("agent_sessions")
      .insert({
        user_id: user.id,
        squad_id: "mesa-op-deal-chat",
        title,
        messages: newMessages,
        deal_id: proposal_id,
      })
      .select("id").single();
    finalSessionId = newSession?.id;
  }

  return NextResponse.json({ response: assistantText, session_id: finalSessionId });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const proposal_id = new URL(req.url).searchParams.get("proposal_id");
  if (!proposal_id) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const { data } = await svc()
    .from("agent_sessions")
    .select("id, messages")
    .eq("deal_id", proposal_id)
    .eq("squad_id", "mesa-op-deal-chat")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ session_id: data?.id ?? null, messages: data?.messages ?? [] });
}
