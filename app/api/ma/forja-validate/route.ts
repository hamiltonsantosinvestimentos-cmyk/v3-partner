import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { extractUF, extractMatchingFields, stripJsonFences, safeJsonParse } from "@/lib/ma/forja-utils";

export const maxDuration = 300;

type DocEntry = {
  doc_id: string;
  file_name: string;
  storage_path: string;
};

type PdfPayload = {
  base64: string;
  fileName: string;
  mediaType: string;
};

// Remove campos nulos/vazios e irrelevantes antes de enviar à IA.
function sanitizeDeal(deal: Record<string, unknown>): Record<string, unknown> {
  const EXCLUDE_KEYS = new Set([
    // Controle interno
    "id", "dbStage", "createdAt", "assigned_to_id", "responsible",
    "comments", "probability", "stage",
    // FORJA anterior — nunca reenviar
    "forja_result", "forja_status", "forja_score", "forja_validated_at", "forja_reports",
    // Histórico e metadados
    "transfer_history", "teaser_cego_history", "teaser_cego_generated_at",
    "kit_liberado", "kit_liberado_at", "kit_override", "kit_override_by",
    "kit_gerado_at", "kit_job_id", "kit_files_available",
    // Conteúdo gerado pelo gerar-kit-ia — não relevante para validação
    "deal_card_html", "sugestao_tese",
    "descricao_ptbr", "descricao_en",
    "teaser_ptbr", "teaser_en",
    "linkedin_post_ptbr", "linkedin_post_en",
    "linkedin_story_ptbr", "linkedin_story_en",
    "tese_investimento", "tese_investimento_en",
    "diferenciais", "riscos", "metricas",
    // Matching metadata
    "uf_extraido", "tipo_operacao_extraida",
    // Dados financeiros derivados — grandes demais, já extraídos de PDFs anteriores
    "financial_projections", "noi_mensal", "updated_from_qa", "vacancia_pct",
    // Documentos de referência já registrados — não úteis para revalidação
    "documentos_origem",
    // Metadados de storage e controle de docs
    "storage_id", "file_size_bytes", "uploaded_at",
  ]);

  // Campos permitidos dentro de asset_data — evita enviar JSONB completo
  const ASSET_DATA_ALLOW = new Set([
    "valor_total", "receita_anual", "ebitda_anual", "noi_anual",
    "despesas_operacionais", "divida_total", "cap_rate",
    "area_construida", "area_terreno", "localizacao_completa", "uf", "municipio",
    "ano_fundacao", "tipo_operacao", "regime_tributario",
    "processos_judiciais", "pendencias_declaradas", "cnpj", "nda_status",
    "deal_value", "metodologia_valuation", "multiplo_ebitda", "valor_por_m2",
    "taxa_ocupacao", "numero_locatarios", "ancoras", "contratos_vigencia",
    "garantias", "prazo_operacao", "descricao_ativo", "contexto_forja",
    // Campos do formulário de 6 etapas (novo-deal-form) — anteriormente stripados
    "financeiro",        // { receita, ebitda, lucro } por ano
    "juridico",          // { tem_processos, detalhes_processos, tem_pendencias, licencas }
    "tipo_participante", // "Vendedor" | "Comprador" | "Intermediario"
    "tipoOperacao",      // tipo de operação M&A
    "founding_year",     // ano de fundação
    "produtos_servicos", // descrição de produtos/serviços
    "mercado_atendido",  // mercado alvo
    "numero_funcionarios", "modelo_negocio", "diferencial_competitivo",
    "razao_social", "nome_fantasia", "setor_atuacao",
  ]);

  function stripEmpty(obj: unknown): unknown {
    if (obj === null || obj === undefined || obj === "") return undefined;
    if (Array.isArray(obj)) {
      const arr = obj.map(stripEmpty).filter((v) => v !== undefined);
      return arr.length ? arr : undefined;
    }
    if (typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (EXCLUDE_KEYS.has(k)) continue;
        const cleaned = stripEmpty(v);
        if (cleaned !== undefined) result[k] = cleaned;
      }
      return Object.keys(result).length ? result : undefined;
    }
    return obj;
  }

  const cleaned = (stripEmpty(deal) ?? {}) as Record<string, unknown>;

  // Filtra asset_data para manter apenas campos relevantes para FORJA
  if (cleaned.asset_data && typeof cleaned.asset_data === "object") {
    const ad = cleaned.asset_data as Record<string, unknown>;
    const filteredAd: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ad)) {
      if (ASSET_DATA_ALLOW.has(k) && v !== null && v !== undefined && v !== "") {
        filteredAd[k] = v;
      }
    }
    cleaned.asset_data = Object.keys(filteredAd).length ? filteredAd : undefined;
  }

  // Garante payload máximo de 12KB para o LLM (deals muito grandes podem travar o output)
  const json = JSON.stringify(cleaned);
  if (json.length > 12000) {
    const trimmed = { ...cleaned };
    delete trimmed.asset_data;
    return trimmed;
  }

  return cleaned;
}

// Baixa PDFs do Supabase Storage e retorna base64 payload
// Limite Claude API: 32MB por arquivo (base64 ~1.37x → limite raw ~23MB para segurança)
const PDF_SIZE_LIMIT_BYTES = 23 * 1024 * 1024; // 23MB raw → ~31.5MB base64

// ─── Dados pré-extraídos do banco ────────────────────────────────────────────

type ExtractedDoc = {
  doc_id:                 string;
  doc_name:               string | null;
  tipo_documento:         string | null;
  dados_extraidos:        Record<string, unknown>;
  campos_baixa_confianca: string[];
  pendencias:             string[];
  resumo:                 string | null;
  confiabilidade:         number;
};

// Consulta ma_document_extractions para docs já processados pelo doc-extract / W9.
// Retorna: extracted (docs com dados prontos) + missingDocIds (sem extração → fallback PDF).
async function fetchExtractedDocs(dealId: string, docIds: string[]): Promise<{
  extracted: ExtractedDoc[];
  missingDocIds: string[];
}> {
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await svc
    .from("ma_document_extractions")
    .select("doc_id, doc_name, tipo_documento, dados_extraidos, campos_baixa_confianca, pendencias, resumo, confiabilidade")
    .eq("deal_id", dealId)
    .in("doc_id", docIds)
    .in("status", ["done", "confirmed", "needs_review"])
    .order("confiabilidade", { ascending: false });

  const extracted = (data ?? []) as ExtractedDoc[];
  const extractedSet = new Set(extracted.map(e => e.doc_id));
  const missingDocIds = docIds.filter(id => !extractedSet.has(id));
  return { extracted, missingDocIds };
}

async function fetchPdfs(dealId: string, docIds: string[]): Promise<{ pdfs: PdfPayload[]; skippedDocs: string[] }> {
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: deal } = await svc
    .from("ma_deals")
    .select("documents")
    .eq("id", dealId)
    .single();

  const docs: DocEntry[] = Array.isArray(deal?.documents) ? deal.documents : [];
  const selected = docs.filter((d) => docIds.includes(d.doc_id));

  const results: PdfPayload[] = [];
  const skippedDocs: string[] = [];
  for (const doc of selected) {
    const { data: fileData, error } = await svc.storage
      .from("ma-documents")
      .download(doc.storage_path);
    if (error || !fileData) { skippedDocs.push(doc.file_name); continue; }

    const buf = await fileData.arrayBuffer();

    // Pula arquivos acima do limite suportado pela Claude API
    if (buf.byteLength > PDF_SIZE_LIMIT_BYTES) {
      console.warn(`[forja-validate] ${doc.file_name} ignorado: ${(buf.byteLength/1024/1024).toFixed(1)}MB > limite 23MB`);
      continue;
    }

    const lower = doc.file_name.toLowerCase();
    const mediaType =
      lower.endsWith(".pdf") ? "application/pdf" :
      lower.endsWith(".png") ? "image/png" :
      lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" :
      "application/pdf";

    results.push({
      base64: Buffer.from(buf).toString("base64"),
      fileName: doc.file_name,
      mediaType,
    });
  }
  return { pdfs: results, skippedDocs };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deal, doc_ids } = body as { deal: Record<string, unknown>; doc_ids?: string[] };

    if (!deal) {
      return NextResponse.json({ error: "deal é obrigatório" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada no servidor" }, { status: 500 });
    }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const cleanDeal = sanitizeDeal(deal);
    const dealId = deal.id as string | undefined;

    // Contexto adicional fornecido pelo usuário — injetado no prompt
    const contextoForja = (deal?.asset_data as Record<string,unknown> | undefined)?.contexto_forja as string | undefined;

    // PRIORIDADE 1: dados já extraídos em ma_document_extractions (sem timeout, sem custo extra)
    // PRIORIDADE 2: fallback para leitura direta do PDF (Sonnet, mais lento)
    const { extracted: extractedDocs, missingDocIds } =
      doc_ids?.length && dealId
        ? await fetchExtractedDocs(dealId, doc_ids)
        : { extracted: [] as ExtractedDoc[], missingDocIds: [] as string[] };

    const { pdfs, skippedDocs } =
      missingDocIds.length && dealId
        ? await fetchPdfs(dealId, missingDocIds)
        : { pdfs: [] as PdfPayload[], skippedDocs: [] as string[] };

    const hasRawPdfs    = pdfs.length > 0;
    const hasDocs       = hasRawPdfs || extractedDocs.length > 0;

    // FASE 1 — validação com precisão cirúrgica
    const systemPrompt =
      "Você é o FORJA, validador de deals M&A da V3 Partners. Atue como analista sênior de M&A — extraia dados com precisão absoluta.\n\n" +

      // Campos críticos a validar SEMPRE
      "CAMPOS CRÍTICOS para qualquer deal (validar se presentes, sinalizar como missing se ausentes):\n" +
      "Financeiro: receita_anual, ebitda_anual, noi_anual, despesas_operacionais, divida_total, cap_rate\n" +
      "Ativo: area_construida, localizacao_completa, ano_fundacao, tipo_operacao, regime_tributario\n" +
      "Legal: processos_judiciais, pendencias_declaradas, cnpj, nda_status\n" +
      "Valuation: deal_value, metodologia_valuation, multiplo_ebitda, valor_por_m2\n" +
      "Operacional: taxa_ocupacao, numero_locatarios, ancoras, contratos_vigencia\n\n" +

      (hasDocs
        ? "DOCUMENTOS RECEBIDOS — analise com precisão cirúrgica:\n" +
          "1. Extraia VALORES EXATOS (números, datas, percentuais) — nunca arredonde\n" +
          "2. Identifique DISCREPÂNCIAS entre o que o deal declara e o que os documentos mostram\n" +
          "3. Capture DADOS NÃO DECLARADOS que aparecem nos docs mas não estão no deal\n" +
          "4. Sinalize RED FLAGS: valores inconsistentes, dados contraditórios, pendências não declaradas\n\n"
        : "") +

      "Retorne APENAS JSON válido, sem markdown, sem texto antes ou depois:\n" +
      "{\n" +
      '  "score": <0-100>,\n' +
      '  "validated": [\n' +
      '    { "field": "<nome_campo>", "value": "<valor_exato>", "note": "<evidência ou fonte>", "doc_confirmed": <bool> }\n' +
      '  ],\n' +
      '  "corrected": [\n' +
      '    { "field": "<campo>", "original": "<valor_declarado>", "corrected": "<valor_real_do_doc>", "reason": "<evidência direta>" }\n' +
      '  ],\n' +
      '  "missing": [\n' +
      '    { "field": "<campo_ausente>", "impact": "<impacto específico no deal>", "priority": "ALTA" | "MEDIA" | "BAIXA" }\n' +
      '  ],\n' +
      (hasDocs
        ? '  "doc_insights": [\n' +
          '    { "doc": "<nome_arquivo>", "finding": "<achado específico com valor/data exatos>" }\n' +
          '  ],\n'
        : "") +
      '  "recommendation": "APROVADO" | "APROVADO_COM_RESSALVAS" | "PENDENTE" | "BLOQUEADO",\n' +
      '  "recommendation_note": "<justificativa objetiva em 1 frase com dado concreto>"\n' +
      "}\n\n" +

      "REGRAS DE SCORING:\n" +
      "≥ 80: dados financeiros auditados + legal limpo + valuation sustentado → APROVADO\n" +
      "60-79: dados operacionais OK mas pendências documentais → APROVADO_COM_RESSALVAS\n" +
      "40-59: dados incompletos ou inconsistências relevantes → PENDENTE\n" +
      "< 40: dados críticos ausentes ou red flags sérios → BLOQUEADO\n\n" +

      "REGRAS DE PRECISÃO:\n" +
      "- validated: até 10 campos (priorize financeiros e legais)\n" +
      "- corrected: TODAS as divergências, sem exceção\n" +
      "- missing: TODOS os campos críticos ausentes listados acima\n" +
      "- doc_insights: mínimo 3 por documento analisado\n" +
      (hasDocs ? "- Dados dos docs têm PRIORIDADE ABSOLUTA sobre dados declarados no deal\n" : "") +
      "- Valores monetários: sempre em R$ com centavos quando disponíveis\n" +
      "- Retorne APENAS o JSON.";

    // Monta contexto de documentos pré-extraídos como texto compacto
    const avgConfianca = extractedDocs.length > 0
      ? Math.round(extractedDocs.reduce((s, e) => s + e.confiabilidade, 0) / extractedDocs.length)
      : 0;

    const extractedContext = extractedDocs.length > 0
      ? `DADOS PRÉ-EXTRAÍDOS — ${extractedDocs.length} doc(s), confiança média ${avgConfianca}%\n` +
        `(Extraídos pelo sistema doc-extract / W9. Campos com valor=null não foram encontrados no documento.)\n\n` +
        extractedDocs.map(e =>
          `=== ${e.doc_name ?? e.doc_id} | ${e.tipo_documento ?? "Documento"} | confiança ${e.confiabilidade}% ===\n` +
          `Resumo: ${e.resumo ?? "Sem resumo"}\n` +
          `Dados: ${JSON.stringify(e.dados_extraidos, null, 2)}\n` +
          (e.pendencias.length > 0 ? `Pendências: ${e.pendencias.join(", ")}\n` : "") +
          (e.campos_baixa_confianca.length > 0 ? `Baixa confiança: ${e.campos_baixa_confianca.join(", ")}\n` : "")
        ).join("\n\n")
      : "";

    // Monta conteúdo da mensagem: PDFs brutos (fallback) + texto dos extraídos + deal JSON
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userContent: any[] = [
      // PDFs brutos — apenas docs sem extração prévia
      ...pdfs.map((pdf) =>
        pdf.mediaType === "application/pdf"
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.base64 }, title: pdf.fileName }
          : { type: "image", source: { type: "base64", media_type: pdf.mediaType, data: pdf.base64 } }
      ),
      {
        type: "text",
        text: (hasDocs
          ? `Analise este deal M&A e valide contra os documentos fornecidos` +
            (extractedDocs.length > 0 ? ` (${extractedDocs.length} pré-extraídos` : "") +
            (hasRawPdfs ? `${extractedDocs.length > 0 ? " + " : " ("}${pdfs.length} PDF(s) brutos` : "") +
            (hasDocs ? `)` : "") +
            `:\n\n`
          : `Analise este deal M&A:\n\n`) +
          (extractedContext ? extractedContext + "\n\n" : "") +
          (contextoForja?.trim()
            ? `CONTEXTO ADICIONAL (fornecido pela Mesa):\n${contextoForja}\n\n`
            : "") +
          JSON.stringify(cleanDeal, null, 2),
      },
    ];

    // Modelo: Sonnet só se houver PDFs brutos (visão necessária)
    // Haiku: sem docs, ou quando todos os docs têm extração prévia (~5-8s vs 60+s)
    const model = hasRawPdfs ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";
    const maxTokensPhase1 = hasRawPdfs ? 12000 : 8000;

    const message = await client.messages.create({
      model,
      max_tokens: maxTokensPhase1,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    if (message.stop_reason === "max_tokens") {
      throw new Error("Resposta da IA truncada — deal com muitos campos. Tente revalidar.");
    }

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Resposta inesperada da IA");

    const raw = content.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(raw);

    // Dispara notificações por email após validação (fire-and-forget)
    // Só envia se score < 80 (PENDENTE ou BLOQUEADO) e houver pendências
    if (dealId && parsed.missing?.length > 0 && (parsed.score ?? 100) < 80) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";
      fetch(`${baseUrl}/api/ma/forja-notify`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET ?? "" },
        body: JSON.stringify({
          deal_id:        dealId,
          score:          parsed.score,
          recommendation: parsed.recommendation,
          missing:        parsed.missing ?? [],
          corrected:      parsed.corrected ?? [],
          doc_insights:   parsed.doc_insights ?? [],
        }),
      }).catch(e => console.error("[forja-validate] forja-notify:", e));
    }

    // Fase 1 entrega validação sem narrativa
    // Narrativa e tese são geradas em /api/ma/forja-narrative (chamada separada do cliente)
    return NextResponse.json({
      ...parsed,
      docs_analyzed:    pdfs.length,
      skipped_docs:     skippedDocs,
      narrative_pending: true,
    });
  } catch (error) {
    console.error("[forja-validate] ERRO:", JSON.stringify(error, null, 2));
    const msg = error instanceof Error ? error.message : String(error);
    const status = (error as { status?: number })?.status ?? 500;
    return NextResponse.json(
      { error: `FORJA erro (${status}): ${msg}` },
      { status: 500 }
    );
  }
}
