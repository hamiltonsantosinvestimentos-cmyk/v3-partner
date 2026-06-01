import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export interface OcrField {
  campo: string;
  extraido: string | null;
  esperado: string | null;
  status: "ok" | "divergente" | "ausente" | "info";
  mensagem: string;
}

export interface OcrDocCheck {
  documento_esperado: string;   // ex: "CNH", "Extrato Bancário"
  documento_encontrado: string; // ex: "CNH", "Fatura Cartão" (o que o OCR viu)
  cliente_confere: boolean;     // nome/CPF do cliente bate?
  resumo_linha: string;         // ex: "CNH = CNH do cliente ✓ ok"
  status: "ok" | "atencao" | "reprovado";
}

export interface OcrExtratoInfo {
  banco: string;                  // ex: "Nubank", "Itaú", "Bradesco"
  periodo: string;                // ex: "Jan/2025 – Mar/2025"
  media_entrada_mensal: number | null; // valor numérico em R$
  media_entrada_formatada: string;     // ex: "R$ 4.250,00"
}

export interface OcrResultado {
  doc_id: string;
  tipo_documento: string;
  campos: OcrField[];
  resumo: "aprovado" | "atencao" | "reprovado";
  observacoes: string;
  doc_check?: OcrDocCheck;
  extrato_info?: OcrExtratoInfo;
}

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
  return { user, profile };
}

async function fetchDocumentBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    let mimeType = contentType.split(";")[0].trim();
    if (!mimeType || mimeType === "application/octet-stream") {
      const lower = url.toLowerCase();
      if (lower.endsWith(".pdf")) mimeType = "application/pdf";
      else if (lower.endsWith(".png")) mimeType = "image/png";
      else mimeType = "image/jpeg";
    }
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

async function uploadToFilesApi(buffer: Buffer, mimeType: string, filename: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
    const res = await fetch("https://api.anthropic.com/v1/files", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "files-api-2025-04-14",
      },
      body: formData,
    });
    if (!res.ok) return null;
    const data = await res.json() as { id: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

async function deleteFromFilesApi(fileId: string): Promise<void> {
  try {
    await fetch(`https://api.anthropic.com/v1/files/${fileId}`, {
      method: "DELETE",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "files-api-2025-04-14",
      },
    });
  } catch { /* fire and forget */ }
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ADMIN_ROLES.includes((profile as { role?: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const { doc_id, doc_label, doc_url, proposal_context } = body as {
    doc_id: string;
    doc_label: string;
    doc_url: string;
    proposal_context: Record<string, string>;
  };

  if (!doc_url) return NextResponse.json({ error: "URL do documento obrigatória" }, { status: 400 });

  const docData = await fetchDocumentBuffer(doc_url);
  if (!docData) {
    return NextResponse.json({ error: "Não foi possível acessar o documento. O link pode ter expirado." }, { status: 400 });
  }

  const isPdf = docData.mimeType === "application/pdf";
  const isImage = docData.mimeType.startsWith("image/");

  if (!isPdf && !isImage) {
    return NextResponse.json({
      resultado: {
        doc_id,
        tipo_documento: doc_label,
        campos: [{ campo: "Formato", extraido: docData.mimeType, esperado: "PDF ou imagem", status: "info", mensagem: "OCR suporta apenas PDF, JPG e PNG" }],
        resumo: "atencao",
        observacoes: "Formato não suportado. Use PDF, JPG ou PNG.",
      } as OcrResultado,
    });
  }

  const fileExt = isPdf ? "pdf" : docData.mimeType.includes("png") ? "png" : "jpg";
  const filename = `${doc_id}.${fileExt}`;

  // Upload para Files API — suporta PDFs grandes sem limite de base64
  const fileId = await uploadToFilesApi(docData.buffer, docData.mimeType, filename);

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultHeaders: { "anthropic-beta": "files-api-2025-04-14" },
    });

    const ctxLines = Object.entries(proposal_context)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");

    const systemPrompt = `Você é um sistema de validação documental brasileiro. Analise documentos e retorne APENAS JSON válido, sem nenhum texto antes ou depois. Nunca use markdown.`;

    const isExtrato = /extrato|bancári|bank|statement/i.test(doc_label);

    const userPrompt = `Analise este documento (${doc_label}) e compare com os dados da proposta:

${ctxLines}

Retorne exatamente este JSON (sem markdown, sem explicações):
{
  "tipo_documento": "nome real do documento encontrado",
  "campos": [
    {"campo":"string","extraido":"string ou null","esperado":"string ou null","status":"ok|divergente|ausente|info","mensagem":"string curta"}
  ],
  "resumo": "aprovado|atencao|reprovado",
  "observacoes": "string",
  "doc_check": {
    "documento_esperado": "${doc_label}",
    "documento_encontrado": "tipo real do documento visto no arquivo",
    "cliente_confere": true ou false,
    "resumo_linha": "ex: CNH = CNH do cliente ✓ ok  OU  Extrato Bancário = Extrato Itaú ✓ ok",
    "status": "ok|atencao|reprovado"
  }${isExtrato ? `,
  "extrato_info": {
    "banco": "nome do banco/instituição ex: Nubank, Itaú, Bradesco, Caixa, Santander, Inter, C6",
    "periodo": "período coberto ex: Jan/2025 – Mar/2025",
    "media_entrada_mensal": número em reais ou null se não identificável,
    "media_entrada_formatada": "ex: R$ 4.250,00 ou null"
  }` : ""}
}

Regras:
- Status dos campos: ok=confere, divergente=não confere, ausente=não encontrado, info=sem comparação
- Resumo: aprovado=tudo ok, atencao=divergência menor, reprovado=divergência crítica ou documento vencido
- doc_check.cliente_confere: true se nome/CPF do cliente da proposta bate com o documento
- doc_check.resumo_linha: frase curta de conferência no formato "TipoEsperado = TipoEncontrado ✓ ok" ou "⚠ divergência"${isExtrato ? `
- extrato_info.media_entrada_mensal: some todas as entradas/créditos e divida pelos meses do período` : ""}
- Retorne APENAS o JSON, zero texto adicional`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mediaBlock: any;
    if (fileId) {
      // Files API — melhor para PDFs grandes, sem limite de base64
      mediaBlock = isPdf
        ? { type: "document", source: { type: "file", file_id: fileId } }
        : { type: "image", source: { type: "file", file_id: fileId } };
    } else {
      // Fallback base64 se upload falhar
      const base64 = docData.buffer.toString("base64");
      mediaBlock = isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image", source: { type: "base64", media_type: docData.mimeType, data: base64 } };
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,

      system: systemPrompt,
      messages: [
        {
          role: "user",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: [mediaBlock, { type: "text", text: userPrompt }] as any,
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error(`JSON não encontrado na resposta: ${cleaned.slice(0, 200)}`);
    }

    const parsed = JSON.parse(cleaned.slice(start, end + 1));

    const resultado: OcrResultado = {
      doc_id,
      tipo_documento: parsed.tipo_documento ?? doc_label,
      campos: Array.isArray(parsed.campos) ? parsed.campos : [],
      resumo: (["aprovado", "atencao", "reprovado"].includes(parsed.resumo) ? parsed.resumo : "atencao") as OcrResultado["resumo"],
      observacoes: parsed.observacoes ?? "",
      ...(parsed.doc_check ? { doc_check: parsed.doc_check as OcrResultado["doc_check"] } : {}),
      ...(parsed.extrato_info ? { extrato_info: parsed.extrato_info as OcrResultado["extrato_info"] } : {}),
    };

    return NextResponse.json({ resultado });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao processar OCR";
    console.error("[OCR] Erro:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (fileId) await deleteFromFilesApi(fileId);
  }
}
