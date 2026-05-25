import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { default as Anthropic } from "@anthropic-ai/sdk";
import { renderAnalisePDF, type AnaliseCredito } from "@/lib/analise-credito-pdf";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET = "credit-documents";
const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
const COMITE_EMAIL = "hamilton@v3partners.com.br";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Lê um documento do Storage e tenta extrair texto legível */
async function fetchDocText(storage_path: string, file_name: string): Promise<string> {
  const { data, error } = await svc().storage.from(BUCKET).download(storage_path);
  if (error || !data) return `[${file_name}: não foi possível ler]`;

  // Se for PDF ou imagem, retorna apenas o nome e tipo (Claude não lê binário via texto)
  // Para text/* tenta extrair
  const isProbablyText = /\.(txt|csv|json|md)$/i.test(file_name);
  if (isProbablyText) {
    try {
      return `=== ${file_name} ===\n${await data.text()}\n`;
    } catch {
      return `[${file_name}: erro ao ler texto]`;
    }
  }
  // Para PDFs e imagens: apenas informa o nome para o Claude considerar na análise
  return `[Documento: ${file_name} — arquivo binário anexado à proposta]`;
}

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles").select("id, full_name, role").eq("id", user.id).single();

  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Acesso restrito à mesa operacional" }, { status: 403 });
  }

  const { proposal_id } = await req.json();
  if (!proposal_id) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  // Busca proposta completa
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

  // Monta contexto de documentos
  const docs = Array.isArray(proposal.documents) ? proposal.documents as Array<{ doc_id: string; file_name: string; storage_path: string }> : [];
  const docTexts = await Promise.all(docs.map(d => fetchDocText(d.storage_path, d.file_name)));

  // Monta comentários
  const comments = Array.isArray(proposal.mesa_comments)
    ? (proposal.mesa_comments as Array<{ author: string; text: string; created_at: string }>)
        .map(c => `[${new Date(c.created_at).toLocaleDateString("pt-BR")}] ${c.author}: ${c.text}`)
        .join("\n")
    : "Nenhum comentário registrado.";

  // Monta notas de nível
  const notasNivel = [
    proposal.level1_notes && `Nível 1 (${proposal.level1_at ? new Date(proposal.level1_at).toLocaleDateString("pt-BR") : ""}): ${proposal.level1_notes}`,
    proposal.level2_notes && `Nível 2 (${proposal.level2_at ? new Date(proposal.level2_at).toLocaleDateString("pt-BR") : ""}): ${proposal.level2_notes}`,
    proposal.level3_notes && `Nível 3 (${proposal.level3_at ? new Date(proposal.level3_at).toLocaleDateString("pt-BR") : ""}): ${proposal.level3_notes}`,
  ].filter(Boolean).join("\n") || "Sem notas de analistas.";

  const meta = (proposal.metadata as Record<string, unknown>) ?? {};
  const partnerName = (proposal.partner as { full_name?: string } | null)?.full_name ?? "Não identificado";

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const contextoProposta = `
PROPOSTA: ${proposal.code}
CLIENTE: ${proposal.client_name}
CPF/CNPJ: ${proposal.client_cpf_cnpj ?? "Não informado"}
LINHA DE CRÉDITO: ${proposal.credit_line}
NÍVEL: ${proposal.current_level}
CAPITAL SOLICITADO: ${fmtCurrency(proposal.requested_value)}
CAPITAL APROVADO: ${proposal.approved_value ? fmtCurrency(proposal.approved_value) : "Não aprovado"}
STATUS: ${proposal.status}
STAGE: ${proposal.stage ?? "RECEBIDO"}
PARTNER: ${partnerName}
DATA: ${new Date(proposal.created_at).toLocaleDateString("pt-BR")}

DADOS DO CLIENTE (metadata):
- Tipo: ${(meta.client_type as string) ?? "Não informado"}
- Email: ${(meta.email as string) ?? "Não informado"}
- Telefone: ${(meta.telefone as string) ?? "Não informado"}
- Renda/Faturamento mensal: ${meta.renda_mensal ? fmtCurrency(meta.renda_mensal as number) : meta.faturamento_mensal ? fmtCurrency(meta.faturamento_mensal as number) : "Não informado"}
- Prazo desejado: ${(meta.prazo as string) ?? "Não informado"}
- Finalidade: ${(meta.finalidade as string) ?? "Não informada"}
- Restrições: ${(meta.restricao_cliente as string) ?? "Não informado"}
- Endereço: ${(meta.endereco_rua as string) ?? ""} ${(meta.endereco_cidade as string) ?? ""} ${(meta.endereco_uf as string) ?? ""}

NOTAS DOS ANALISTAS:
${notasNivel}

COMENTÁRIOS DA MESA:
${comments}

DOCUMENTOS ANEXADOS (${docs.length}):
${docTexts.join("\n")}
`;

  // QW-4: system estático separado do contexto dinâmico — permite prompt caching
  const ANALYST_SYSTEM = `Você é um analista sênior de crédito de uma boutique financeira brasileira (V3 Partners) especializada em securitização, real estate e crédito estruturado. Analise a proposta fornecida e gere um relatório completo para o Comitê de Crédito usando a tool "relatorio_comite". Preencha todos os campos obrigatórios com base exclusivamente nos dados da proposta.`;

  const prompt = `${contextoProposta}

Retorne APENAS um objeto JSON válido com EXATAMENTE esta estrutura (sem markdown, sem texto extra):

{
  "resumo_executivo": "Síntese objetiva da operação e recomendação em 3-4 frases",
  "parecer": "FAVORÁVEL" | "DESFAVORÁVEL" | "CONDICIONADO",
  "score_risco": "BAIXO" | "MÉDIO" | "ALTO",
  "cinco_cs": {
    "carater": "Análise do histórico, restrições, tempo de mercado, comportamento de pagamento",
    "capacidade": "Análise do fluxo de caixa, renda comprovada vs declarada, capacidade de honrar a dívida",
    "capital": "Análise do patrimônio líquido, reservas, solidez financeira",
    "colateral": "Análise das garantias oferecidas versus o capital solicitado, LTV se aplicável",
    "condicoes": "Análise do momento de mercado, setor de atuação, finalidade do crédito, cenário macro"
  },
  "analise_financeira": "Análise detalhada dos indicadores financeiros extraídos dos documentos e dados fornecidos",
  "capacidade_pagamento": "Valor estimado de parcela máxima suportável pelo cliente (ex: R$ 8.500/mês)",
  "comprometimento_renda": "Percentual de comprometimento da renda com a operação (ex: 32% da renda mensal)",
  "gap_analise": "Análise do gap entre o capital solicitado e a real capacidade financeira demonstrada",
  "pontos_criticos": ["ponto 1", "ponto 2"],
  "pontos_atencao": ["ponto 1", "ponto 2"],
  "pontos_positivos": ["ponto 1", "ponto 2"],
  "analise_documentos": "Resumo dos documentos analisados, dados extraídos e inconsistências identificadas",
  "historico_operacao": "Resumo do histórico de movimentações, comentários e notas dos analistas",
  "parecer_final": "Recomendação final detalhada ao comitê, incluindo condicionantes se houver, próximos passos e estrutura sugerida para aprovação"
}`;

  // Chama Claude via tool_use para garantir JSON válido
  let analiseJson: Record<string, unknown>;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [{ type: "text", text: ANALYST_SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [{
        name: "relatorio_comite",
        description: "Gera o relatório estruturado de comitê de crédito",
        input_schema: {
          type: "object" as const,
          properties: {
            resumo_executivo:    { type: "string" },
            parecer:             { type: "string", enum: ["FAVORÁVEL", "DESFAVORÁVEL", "CONDICIONADO"] },
            score_risco:         { type: "string", enum: ["BAIXO", "MÉDIO", "ALTO"] },
            cinco_cs: {
              type: "object",
              properties: {
                carater:    { type: "string" },
                capacidade: { type: "string" },
                capital:    { type: "string" },
                colateral:  { type: "string" },
                condicoes:  { type: "string" },
              },
              required: ["carater", "capacidade", "capital", "colateral", "condicoes"],
            },
            analise_financeira:   { type: "string" },
            capacidade_pagamento: { type: "string" },
            comprometimento_renda:{ type: "string" },
            gap_analise:          { type: "string" },
            pontos_criticos:      { type: "array", items: { type: "string" } },
            pontos_atencao:       { type: "array", items: { type: "string" } },
            pontos_positivos:     { type: "array", items: { type: "string" } },
            analise_documentos:   { type: "string" },
            historico_operacao:   { type: "string" },
            parecer_final:        { type: "string" },
          },
          required: [
            "resumo_executivo", "parecer", "score_risco", "cinco_cs",
            "analise_financeira", "capacidade_pagamento", "comprometimento_renda",
            "gap_analise", "pontos_criticos", "pontos_atencao", "pontos_positivos",
            "analise_documentos", "historico_operacao", "parecer_final",
          ],
        },
      }],
      tool_choice: { type: "tool" as const, name: "relatorio_comite" },
      messages: [{ role: "user", content: prompt }],
    });

    // Extrai o input da tool call — é sempre JSON válido garantido pelo SDK
    const toolUse = response.content.find(b => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude não retornou tool_use");
    }
    analiseJson = toolUse.input as Record<string, unknown>;
  } catch (e) {
    console.error("[analyze] Erro Claude:", e);
    return NextResponse.json({ error: `Erro na análise IA: ${String(e)}` }, { status: 500 });
  }

  // Monta dados do PDF
  const analiseData: AnaliseCredito = {
    proposal_code: proposal.code,
    client_name: proposal.client_name,
    credit_line: proposal.credit_line,
    current_level: proposal.current_level,
    requested_value: proposal.requested_value,
    partner_name: partnerName,
    created_at: proposal.created_at,
    generated_at: new Date().toISOString(),
    resumo_executivo: String(analiseJson.resumo_executivo ?? ""),
    parecer: (analiseJson.parecer as AnaliseCredito["parecer"]) ?? "CONDICIONADO",
    score_risco: (analiseJson.score_risco as AnaliseCredito["score_risco"]) ?? "MÉDIO",
    cinco_cs: (analiseJson.cinco_cs as AnaliseCredito["cinco_cs"]) ?? {
      carater: "", capacidade: "", capital: "", colateral: "", condicoes: "",
    },
    analise_financeira: String(analiseJson.analise_financeira ?? ""),
    capacidade_pagamento: String(analiseJson.capacidade_pagamento ?? ""),
    comprometimento_renda: String(analiseJson.comprometimento_renda ?? ""),
    gap_analise: String(analiseJson.gap_analise ?? ""),
    pontos_criticos: (analiseJson.pontos_criticos as string[]) ?? [],
    pontos_atencao: (analiseJson.pontos_atencao as string[]) ?? [],
    pontos_positivos: (analiseJson.pontos_positivos as string[]) ?? [],
    analise_documentos: String(analiseJson.analise_documentos ?? ""),
    historico_operacao: String(analiseJson.historico_operacao ?? ""),
    parecer_final: String(analiseJson.parecer_final ?? ""),
  };

  // Gera PDF (não bloqueia se falhar)
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await renderAnalisePDF(analiseData);
  } catch (e) {
    console.error("[analyze] Erro PDF:", e);
    // Continua sem PDF — análise já foi gerada
  }

  // Salva análise no metadata da proposta
  const currentMeta = ((proposal.metadata as Record<string, unknown>) ?? {});
  await svc()
    .from("credit_desk_proposals")
    .update({
      metadata: { ...currentMeta, ai_analysis: { ...analiseData, generated_at: new Date().toISOString() } },
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposal_id);

  // Envia e-mail com PDF em anexo (apenas se PDF foi gerado)
  if (process.env.RESEND_API_KEY && pdfBuffer) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const parecerEmoji = analiseData.parecer === "FAVORÁVEL" ? "✅" : analiseData.parecer === "DESFAVORÁVEL" ? "❌" : "⚠️";
      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Relatório de Comitê</title></head>
<body style="margin:0;padding:0;background:#07101E;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#0C1929;border-radius:12px;overflow:hidden;border:1px solid #1B3050;">
    <div style="padding:24px 32px;border-bottom:1px solid #1B3050;background:#07101E;">
      <span style="font-size:16px;font-weight:800;color:#E5B96A;letter-spacing:0.08em;">V3 PARTNERS</span>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#C8D4E3;">
        ${parecerEmoji} Relatório de Comitê — ${proposal.code}
      </h2>
      <div style="background:#07101E;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1B3050;">
          <span style="color:#7A96AF;font-size:13px;">Cliente</span>
          <span style="color:#C8D4E3;font-size:13px;font-weight:600;">${proposal.client_name}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1B3050;">
          <span style="color:#7A96AF;font-size:13px;">Linha</span>
          <span style="color:#C8D4E3;font-size:13px;font-weight:600;">${proposal.credit_line}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1B3050;">
          <span style="color:#7A96AF;font-size:13px;">Capital Solicitado</span>
          <span style="color:#C9A84C;font-size:13px;font-weight:700;">${fmtCurrency(proposal.requested_value)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;">
          <span style="color:#7A96AF;font-size:13px;">Parecer IA</span>
          <span style="font-size:13px;font-weight:700;color:${analiseData.parecer === "FAVORÁVEL" ? "#10B981" : analiseData.parecer === "DESFAVORÁVEL" ? "#EF4444" : "#F59E0B"};">
            ${analiseData.parecer} · RISCO ${analiseData.score_risco}
          </span>
        </div>
      </div>
      <p style="font-size:13px;color:#C8D4E3;line-height:1.6;margin-bottom:16px;">
        <strong>Resumo:</strong> ${analiseData.resumo_executivo}
      </p>
      <p style="font-size:12px;color:#7A96AF;">O relatório completo de comitê está em anexo (PDF).</p>
    </div>
    <div style="padding:18px 32px;border-top:1px solid #1B3050;background:#07101E;">
      <p style="margin:0;font-size:11px;color:#7A96AF;">V3 Partners — Documento Confidencial · Análise gerada por IA</p>
    </div>
  </div>
</body>
</html>`;

      await resend.emails.send({
        from: process.env.EMAIL_FROM || "V3 Partners <onboarding@resend.dev>",
        to: COMITE_EMAIL,
        subject: `${parecerEmoji} Relatório de Comitê — ${proposal.code} | ${proposal.client_name}`,
        html,
        attachments: pdfBuffer ? [{
          filename: `relatorio-comite-${proposal.code}.pdf`,
          content: pdfBuffer,
        }] : [],
      });
    } catch { /* silent — não bloqueia */ }
  }

  // Retorna análise + PDF em base64 para o frontend
  return NextResponse.json({
    ok: true,
    analise: analiseData,
    pdf_base64: pdfBuffer ? pdfBuffer.toString("base64") : null,
  });
}
