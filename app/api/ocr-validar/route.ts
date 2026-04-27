import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface OcrField {
  campo: string;
  extraido: string | null;
  esperado: string | null;
  status: "ok" | "divergente" | "ausente" | "info";
  mensagem: string;
}

export interface OcrResultado {
  doc_id: string;
  tipo_documento: string;
  campos: OcrField[];
  resumo: "aprovado" | "atencao" | "reprovado";
  observacoes: string;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
  return { user, profile };
}

// ─── Busca URL assinada do documento ─────────────────────────────────────────

async function fetchDocumentAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    // Normaliza mime type para tipos aceitos pela API Vision
    let mimeType = contentType.split(";")[0].trim();
    if (mimeType === "application/octet-stream") mimeType = url.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg";

    return { base64, mimeType };
  } catch {
    return null;
  }
}

// ─── Prompt por tipo de documento ────────────────────────────────────────────

function buildPrompt(docLabel: string, proposalContext: Record<string, string>): string {
  const ctx = JSON.stringify(proposalContext, null, 2);
  return `Você é um analista de crédito especializado em validação documental.

Analise este documento e extraia os dados relevantes. Em seguida, compare com os dados da proposta de crédito fornecidos.

**Tipo de documento esperado:** ${docLabel}

**Dados da proposta para comparação:**
${ctx}

**Instruções:**
1. Identifique o tipo real do documento (ex: RG, CNH, Contrato Social, Comprovante de Renda, etc.)
2. Extraia os campos principais (nome, CPF/CNPJ, datas, valores, endereço, etc.)
3. Compare cada campo extraído com os dados da proposta
4. Identifique divergências, documentos vencidos, valores inconsistentes

**Responda APENAS em JSON válido, sem texto adicional, no seguinte formato:**
{
  "tipo_documento": "nome do tipo de documento identificado",
  "campos": [
    {
      "campo": "Nome do campo (ex: Nome Completo, CPF, Validade, Valor Renda)",
      "extraido": "valor extraído do documento (null se não encontrado)",
      "esperado": "valor da proposta para comparação (null se não aplicável)",
      "status": "ok | divergente | ausente | info",
      "mensagem": "explicação curta (máx 60 chars)"
    }
  ],
  "resumo": "aprovado | atencao | reprovado",
  "observacoes": "observação geral sobre o documento (máx 120 chars)"
}

**Regras para status:**
- "ok": campo extraído confere com a proposta ou está correto
- "divergente": campo extraído difere significativamente do esperado
- "ausente": campo esperado não encontrado no documento
- "info": informação extraída sem correspondência para comparar (ex: tipo de imóvel)
- "reprovado": use quando há divergência crítica (CPF diferente, documento vencido, ônus detectado)
- "atencao": divergência não crítica (diferença de valor, data próxima do vencimento)
- "aprovado": tudo confere sem problemas`;
}

// ─── POST /api/ocr-validar ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, profile } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ADMIN_ROLES.includes(profile?.role ?? "")) {
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

  // Busca o documento como base64
  const docData = await fetchDocumentAsBase64(doc_url);
  if (!docData) {
    return NextResponse.json({ error: "Não foi possível acessar o documento. Verifique se o link ainda é válido." }, { status: 400 });
  }

  // Verifica se é PDF ou imagem
  const isPdf = docData.mimeType === "application/pdf";
  const isImage = docData.mimeType.startsWith("image/");

  if (!isPdf && !isImage) {
    return NextResponse.json({
      resultado: {
        doc_id,
        tipo_documento: doc_label,
        campos: [{
          campo: "Formato do arquivo",
          extraido: docData.mimeType,
          esperado: "PDF ou imagem",
          status: "info" as const,
          mensagem: "OCR disponível apenas para PDF e imagens",
        }],
        resumo: "atencao" as const,
        observacoes: "Formato não suportado pelo OCR. Use PDF, JPG ou PNG.",
      } as OcrResultado,
    });
  }

  // Chama Claude Vision
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // Monta o bloco de mídia separadamente para evitar conflito de tipos
    type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mediaBlock: any = isPdf
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: docData.base64 },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: docData.mimeType as ImageMediaType, data: docData.base64 },
        };

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: [mediaBlock, { type: "text", text: buildPrompt(doc_label, proposal_context) }] as any,
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";

    // Remove blocos markdown ```json ... ``` se presentes
    const cleaned = rawText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // Extrai o objeto JSON — pega do primeiro { até o último }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Resposta sem JSON válido");

    const jsonStr = cleaned.slice(start, end + 1);

    let parsed: { tipo_documento?: string; campos?: unknown[]; resumo?: string; observacoes?: string };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Fallback: retorna resposta como observação para debug
      return NextResponse.json({
        resultado: {
          doc_id,
          tipo_documento: doc_label,
          campos: [],
          resumo: "atencao",
          observacoes: `Não foi possível interpretar a resposta do modelo. Tente novamente.`,
        } as OcrResultado,
      });
    }

    const resultado: OcrResultado = {
      doc_id,
      tipo_documento: parsed.tipo_documento ?? doc_label,
      campos: parsed.campos ?? [],
      resumo: parsed.resumo ?? "atencao",
      observacoes: parsed.observacoes ?? "",
    };

    return NextResponse.json({ resultado });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao processar OCR";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
