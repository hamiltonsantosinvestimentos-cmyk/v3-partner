import { resolveBucket } from "@/lib/storage-bucket";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 300;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type DocEntry = {
  doc_id: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  uploaded_by: string;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });
    }

    const body = await req.json();
    const { deal_id, doc_id } = body;

    if (!deal_id || !doc_id) {
      return NextResponse.json({ error: "deal_id e doc_id são obrigatórios" }, { status: 400 });
    }

    const svc = serviceClient();

    const { data: deal } = await svc
      .from("ma_deals")
      .select("id, documents, asset_data")
      .eq("id", deal_id)
      .single();

    if (!deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

    const docs: DocEntry[] = Array.isArray(deal.documents) ? deal.documents : [];
    const doc = docs.find((d) => d.doc_id === doc_id);
    if (!doc) return NextResponse.json({ error: "Documento não encontrado no deal" }, { status: 404 });

    const { data: fileData, error: downloadError } = await svc.storage
      .from(resolveBucket(doc.storage_path))
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: `Erro ao baixar documento: ${downloadError?.message ?? "arquivo não encontrado"}` },
        { status: 500 }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Aceita PDF e imagens de documentos
    const lowerName = doc.file_name.toLowerCase();
    const mediaType =
      lowerName.endsWith(".pdf") ? "application/pdf" :
      lowerName.endsWith(".png") ? "image/png" :
      lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") ? "image/jpeg" :
      "application/pdf";

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docBlock: any = mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system:
        "Você é o FORJA, extrator inteligente de dados de documentos M&A da V3 Partners. " +
        "Analise o documento e extraia todos os dados relevantes para uma operação de M&A. " +
        "Retorne APENAS um JSON válido, sem markdown:\n" +
        "{\n" +
        '  "tipo_documento": "DRE" | "Balanco" | "Contrato Social" | "Certidao" | "Laudo" | "NDA" | "Outro",\n' +
        '  "dados_extraidos": {\n' +
        '    "empresa": "<nome se encontrado ou null>",\n' +
        '    "cnpj": "<CNPJ se encontrado ou null>",\n' +
        '    "periodo": "<ano/período de referência ou null>",\n' +
        '    "receita": "<faturamento/receita bruta ou null>",\n' +
        '    "ebitda": "<EBITDA ou null>",\n' +
        '    "lucro": "<lucro líquido ou null>",\n' +
        '    "socios": ["<lista de sócios/diretores se encontrados>"],\n' +
        '    "outros": {}\n' +
        '  },\n' +
        '  "pendencias": ["<pendência ou irregularidade encontrada>"],\n' +
        '  "validade": "<data de validade do documento ou null>",\n' +
        '  "resumo": "<2-3 frases descrevendo o documento e principais informações>",\n' +
        '  "confiabilidade": <0-100 — qualidade e completude do documento>\n' +
        "}\n" +
        "Omita campos não encontrados. Retorne APENAS o JSON.",
      messages: [
        {
          role: "user",
          content: [
            docBlock,
            { type: "text", text: `Extraia os dados M&A do documento: "${doc.file_name}"` },
          ],
        },
      ],
    });

    if (message.stop_reason === "max_tokens") {
      throw new Error("Documento muito grande para processar completamente");
    }

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Resposta inesperada da IA");

    const raw = content.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    const extraction = JSON.parse(raw);

    // Persiste extração em asset_data.forja_pdf_extractions[doc_id]
    const assetData = (deal.asset_data ?? {}) as Record<string, unknown>;
    const existing = (assetData.forja_pdf_extractions ?? {}) as Record<string, unknown>;
    const updated = {
      ...assetData,
      forja_pdf_extractions: {
        ...existing,
        [doc_id]: { ...extraction, doc_name: doc.file_name, extracted_at: new Date().toISOString() },
      },
    };

    await svc
      .from("ma_deals")
      .update({ asset_data: updated, updated_at: new Date().toISOString() })
      .eq("id", deal_id);

    return NextResponse.json({ ok: true, extraction, doc_name: doc.file_name });
  } catch (error) {
    console.error("[forja-pdf] ERRO:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `FORJA PDF: ${msg}` }, { status: 500 });
  }
}
