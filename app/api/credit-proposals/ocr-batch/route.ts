import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import type { OcrResultado } from "@/app/api/ocr-validar/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET = "credit-documents";
const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
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
  } catch { return null; }
}

async function analyzeOneDoc(
  docId: string,
  docLabel: string,
  storagePath: string,
  proposalContext: Record<string, string>
): Promise<OcrResultado> {
  // Gera URL assinada (60 min)
  const { data: urlData } = await svc().storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  const signedUrl = urlData?.signedUrl;

  if (!signedUrl) {
    return {
      doc_id: docId,
      tipo_documento: docLabel,
      campos: [{ campo: "Acesso", extraido: null, esperado: null, status: "info", mensagem: "Não foi possível gerar URL do documento" }],
      resumo: "atencao",
      observacoes: "Documento inacessível no storage.",
    };
  }

  const docData = await fetchDocumentAsBase64(signedUrl);
  if (!docData) {
    return {
      doc_id: docId,
      tipo_documento: docLabel,
      campos: [{ campo: "Download", extraido: null, esperado: null, status: "info", mensagem: "Falha ao baixar documento" }],
      resumo: "atencao",
      observacoes: "Não foi possível baixar o arquivo.",
    };
  }

  const isPdf = docData.mimeType === "application/pdf";
  const isImage = docData.mimeType.startsWith("image/");

  if (!isPdf && !isImage) {
    return {
      doc_id: docId,
      tipo_documento: docLabel,
      campos: [{ campo: "Formato", extraido: docData.mimeType, esperado: "PDF ou imagem", status: "info", mensagem: "OCR suporta apenas PDF, JPG e PNG" }],
      resumo: "atencao",
      observacoes: "Formato não suportado para OCR.",
    };
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const ctxLines = Object.entries(proposalContext).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  const systemPrompt = `Você é um sistema de validação documental. Analise documentos e retorne APENAS JSON válido, sem nenhum texto antes ou depois. Nunca use markdown.`;
  const userPrompt = `Analise este documento (${docLabel}) e compare com os dados da proposta:\n\n${ctxLines}\n\nRetorne exatamente este JSON:\n{"tipo_documento":"string","campos":[{"campo":"string","extraido":"string ou null","esperado":"string ou null","status":"ok ou divergente ou ausente ou info","mensagem":"string curta"}],"resumo":"aprovado ou atencao ou reprovado","observacoes":"string"}\n\nStatus: ok=confere, divergente=não confere, ausente=não encontrado, info=sem comparação. Resumo: aprovado=tudo ok, atencao=divergência menor, reprovado=divergência crítica ou vencido.`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mediaBlock: any = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: docData.base64 } }
    : { type: "image", source: { type: "base64", media_type: docData.mimeType, data: docData.base64 } };

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: systemPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: "user", content: [mediaBlock, { type: "text", text: userPrompt }] as any }],
  });

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSON não encontrado: " + cleaned.slice(0, 200));

  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  return {
    doc_id: docId,
    tipo_documento: parsed.tipo_documento ?? docLabel,
    campos: Array.isArray(parsed.campos) ? parsed.campos : [],
    resumo: (["aprovado", "atencao", "reprovado"].includes(parsed.resumo) ? parsed.resumo : "atencao") as OcrResultado["resumo"],
    observacoes: parsed.observacoes ?? "",
  };
}

// POST — analisa todos os docs, salva resultados, dispara análise IA
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { proposal_id } = await req.json();
  if (!proposal_id) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  // Busca proposta + documentos
  const { data: proposal, error: propErr } = await svc()
    .from("credit_desk_proposals")
    .select("id, code, client_name, client_cpf_cnpj, credit_line, requested_value, current_level, metadata, documents")
    .eq("id", proposal_id)
    .single();

  if (propErr || !proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const docs = Array.isArray(proposal.documents)
    ? (proposal.documents as Array<{ doc_id: string; file_name: string; storage_path: string }>)
    : [];

  if (docs.length === 0) {
    return NextResponse.json({ error: "Nenhum documento encontrado na proposta" }, { status: 400 });
  }

  const meta = (proposal.metadata as Record<string, unknown>) ?? {};
  const fmtCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const proposalContext: Record<string, string> = {
    "Código": proposal.code ?? proposal_id,
    "Cliente": proposal.client_name ?? "Não informado",
    "CPF/CNPJ": proposal.client_cpf_cnpj ?? "Não informado",
    "Linha de Crédito": proposal.credit_line ?? "Não informado",
    "Nível": proposal.current_level ?? "Não informado",
    "Valor Solicitado": fmtCurrency(proposal.requested_value ?? 0),
    "Tipo": (meta.client_type as string) ?? "Não informado",
    "Renda/Faturamento": meta.renda_mensal ? fmtCurrency(meta.renda_mensal as number) : meta.faturamento_mensal ? fmtCurrency(meta.faturamento_mensal as number) : "Não informado",
  };

  // Processa TODOS os documentos anexados (sem deduplicação por doc_id)
  // OCR sequencial para não sobrecarregar API
  const ocrResults: OcrResultado[] = [];
  for (const doc of docs) {
    try {
      const resultado = await analyzeOneDoc(doc.doc_id, doc.file_name, doc.storage_path, proposalContext);
      ocrResults.push(resultado);
    } catch (e) {
      ocrResults.push({
        doc_id: doc.doc_id,
        tipo_documento: doc.file_name,
        campos: [{ campo: "Erro", extraido: null, esperado: null, status: "info", mensagem: e instanceof Error ? e.message : "Erro ao processar" }],
        resumo: "atencao",
        observacoes: "Erro ao processar este documento.",
      });
    }
  }

  // Salva resultados de OCR no metadata
  const updatedMeta = {
    ...meta,
    ocr_results: ocrResults,
    ocr_analyzed_at: new Date().toISOString(),
    ocr_analyzed_by: profile?.full_name ?? "Mesa",
  };

  await svc()
    .from("credit_desk_proposals")
    .update({ metadata: updatedMeta })
    .eq("id", proposal_id);

  // Dispara análise IA completa automaticamente (fire-and-wait)
  let aiAnalysis: Record<string, unknown> | null = null;
  let aiError: string | null = null;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";
    const analyzeRes = await fetch(`${baseUrl}/api/credit-proposals/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ proposal_id }),
    });
    if (analyzeRes.ok) {
      const analyzeData = await analyzeRes.json();
      aiAnalysis = analyzeData.analysis ?? null;
    } else {
      aiError = `Análise IA retornou ${analyzeRes.status}`;
    }
  } catch (e) {
    aiError = e instanceof Error ? e.message : "Erro ao chamar análise IA";
  }

  const resumoGeral: OcrResultado["resumo"] =
    ocrResults.some(r => r.resumo === "reprovado") ? "reprovado"
    : ocrResults.some(r => r.resumo === "atencao") ? "atencao"
    : "aprovado";

  return NextResponse.json({
    ok: true,
    total_docs: docs.length,
    ocr_results: ocrResults,
    resumo_geral: resumoGeral,
    ai_analysis: aiAnalysis,
    ai_error: aiError,
  });
}
