import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;

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
    "id", "dbStage", "createdAt", "assigned_to_id", "responsible",
    "comments", "probability", "stage",
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

  return (stripEmpty(deal) ?? {}) as Record<string, unknown>;
}

// Baixa PDFs do Supabase Storage e retorna base64 payload
async function fetchPdfs(dealId: string, docIds: string[]): Promise<PdfPayload[]> {
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: deal } = await svc
    .from("ma_deals")
    .select("documents")
    .eq("id", dealId)
    .single();

  const docs: DocEntry[] = Array.isArray(deal?.documents) ? deal.documents : [];
  const selected = docs.filter((d) => docIds.includes(d.doc_id));

  const results: PdfPayload[] = [];
  for (const doc of selected) {
    const { data: fileData, error } = await svc.storage
      .from("ma-documents")
      .download(doc.storage_path);
    if (error || !fileData) continue;

    const buf = await fileData.arrayBuffer();
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
  return results;
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

    // Carrega PDFs se foram selecionados
    const pdfs: PdfPayload[] =
      doc_ids?.length && dealId
        ? await fetchPdfs(dealId, doc_ids)
        : [];

    const hasDocs = pdfs.length > 0;

    const systemPrompt =
      "Você é o FORJA, validador inteligente de dados de deals M&A da V3 Partners. " +
      (hasDocs
        ? "Você recebeu os documentos reais do deal. Valide os dados fornecidos CONTRA os documentos, " +
          "identificando discrepâncias, confirmações e informações adicionais encontradas nos documentos. " +
          "Adicione o campo \"doc_insights\" com descobertas dos documentos que não estavam nos dados do deal. "
        : "") +
      "Retorne APENAS um JSON válido, sem markdown:\n" +
      "{\n" +
      '  "score": <número 0-100>,\n' +
      '  "validated": [ { "field": "<campo>", "value": "<valor>", "note": "<observação opcional>", "doc_confirmed": <true se confirmado em documento> } ],\n' +
      '  "corrected": [ { "field": "<campo>", "original": "<valor original>", "corrected": "<valor corrigido>", "reason": "<motivo>", "doc_source": "<nome do doc se aplicável>" } ],\n' +
      '  "missing": [ { "field": "<campo>", "impact": "<impacto>", "priority": "ALTA" | "MEDIA" | "BAIXA" } ],\n' +
      (hasDocs ? '  "doc_insights": [ { "doc": "<nome do arquivo>", "finding": "<dado encontrado não presente nos metadados>" } ],\n' : "") +
      '  "narrative_pt": "<narrativa de investimento em português — máximo 3 frases>",\n' +
      '  "narrative_en": "<investment narrative in english — maximum 3 sentences>",\n' +
      '  "recommendation": "APROVADO" | "APROVADO_COM_RESSALVAS" | "PENDENTE" | "BLOQUEADO",\n' +
      '  "recommendation_note": "<justificativa da recomendação>"\n' +
      "}\n\n" +
      "Regras:\n" +
      "- Liste TODOS os campos presentes em validated e TODOS os ausentes em missing\n" +
      "- score >= 80 e dados completos → APROVADO\n" +
      "- score 60-79 ou poucos dados ausentes não críticos → APROVADO_COM_RESSALVAS\n" +
      "- score 40-59 ou campos importantes ausentes → PENDENTE\n" +
      "- score < 40 ou dados insuficientes → BLOQUEADO\n" +
      (hasDocs
        ? "- Se dados do deal conflitam com documentos, registre em corrected com doc_source\n" +
          "- Se documentos confirmam dados do deal, marque doc_confirmed: true em validated\n"
        : "") +
      "- Retorne APENAS o JSON, sem texto adicional.";

    // Monta conteúdo da mensagem: documentos primeiro, depois texto
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userContent: any[] = [
      ...pdfs.map((pdf) =>
        pdf.mediaType === "application/pdf"
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.base64 }, title: pdf.fileName }
          : { type: "image", source: { type: "base64", media_type: pdf.mediaType, data: pdf.base64 } }
      ),
      {
        type: "text",
        text: hasDocs
          ? `Analise este deal M&A e valide contra os ${pdfs.length} documento(s) fornecido(s):\n\n${JSON.stringify(cleanDeal, null, 2)}`
          : `Analise este deal M&A:\n\n${JSON.stringify(cleanDeal, null, 2)}`,
      },
    ];

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: hasDocs ? userContent : userContent[0].text }],
    });

    if (message.stop_reason === "max_tokens") {
      throw new Error("Resposta da IA truncada — reduza o número de documentos e tente novamente");
    }

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Resposta inesperada da IA");

    const raw = content.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(raw);

    // Indica quantos docs foram analisados na resposta
    return NextResponse.json({ ...parsed, docs_analyzed: pdfs.length });
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
