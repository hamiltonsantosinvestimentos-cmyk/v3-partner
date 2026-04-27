import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

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

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
  return { user, profile };
}

async function fetchDocumentAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    let mimeType = contentType.split(";")[0].trim();
    if (!mimeType || mimeType === "application/octet-stream") {
      const lower = url.toLowerCase();
      if (lower.endsWith(".pdf")) mimeType = "application/pdf";
      else if (lower.endsWith(".png")) mimeType = "image/png";
      else mimeType = "image/jpeg";
    }
    return { base64, mimeType };
  } catch {
    return null;
  }
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

  const docData = await fetchDocumentAsBase64(doc_url);
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

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const ctxLines = Object.entries(proposal_context)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");

    const systemPrompt = `Você é um sistema de validação documental. Analise documentos e retorne APENAS JSON válido, sem nenhum texto antes ou depois. Nunca use markdown.`;

    const userPrompt = `Analise este documento (${doc_label}) e compare com os dados da proposta:

${ctxLines}

Retorne exatamente este JSON (sem markdown, sem explicações):
{"tipo_documento":"string","campos":[{"campo":"string","extraido":"string ou null","esperado":"string ou null","status":"ok ou divergente ou ausente ou info","mensagem":"string curta"}],"resumo":"aprovado ou atencao ou reprovado","observacoes":"string"}

Status dos campos: ok=confere, divergente=não confere, ausente=não encontrado, info=sem comparação.
Resumo: aprovado=tudo ok, atencao=divergência menor, reprovado=divergência crítica ou vencido.`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mediaBlock: any = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: docData.base64 } }
      : { type: "image", source: { type: "base64", media_type: docData.mimeType, data: docData.base64 } };

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
        // Prefill para forçar início do JSON
        {
          role: "assistant",
          content: "{",
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    // O prefill faz o modelo continuar a partir de "{", então concatenamos
    const fullText = "{" + rawText;

    // Limpa e extrai JSON
    const cleaned = fullText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error(`JSON não encontrado na resposta: ${cleaned.slice(0, 200)}`);
    }

    const jsonStr = cleaned.slice(start, end + 1);
    const parsed = JSON.parse(jsonStr);

    const resultado: OcrResultado = {
      doc_id,
      tipo_documento: parsed.tipo_documento ?? doc_label,
      campos: Array.isArray(parsed.campos) ? parsed.campos : [],
      resumo: (["aprovado", "atencao", "reprovado"].includes(parsed.resumo) ? parsed.resumo : "atencao") as OcrResultado["resumo"],
      observacoes: parsed.observacoes ?? "",
    };

    return NextResponse.json({ resultado });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao processar OCR";
    console.error("[OCR] Erro:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
