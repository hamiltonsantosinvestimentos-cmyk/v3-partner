import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

// Endpoint único de trigger OCR assíncrono (W9) para todas as mesas:
// Mesa M&A, Mesa Crédito N1/N2/N3, Mesa Consórcio.
// Insere row em ma_document_extractions → dispara webhook W9 → retorna extraction_id.
// O caller faz polling em ma_document_extractions.status para saber quando termina.

const W9_WEBHOOK = `${process.env.N8N_BASE_URL ?? "https://n8n-514n.onrender.com"}/webhook/v3-doc-extract-large`;
const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export interface OcrTriggerPayload {
  // Qual mesa / entidade originou a solicitação
  source_type: "credit" | "ma" | "consorcio";
  source_id: string;         // proposal_id ou deal_id
  // Documento a processar
  doc_id: string;
  doc_name: string;
  storage_path: string;
  bucket: string;            // "credit-documents" | "ma-documents" | etc.
  // Contexto para extração (campos livres)
  context?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body: OcrTriggerPayload = await req.json();
  const { source_type, source_id, doc_id, doc_name, storage_path, bucket, context } = body;

  if (!source_id || !doc_id || !storage_path || !bucket) {
    return NextResponse.json({ error: "source_id, doc_id, storage_path e bucket são obrigatórios" }, { status: 400 });
  }

  // Insere linha de extração com status "queued"
  const { data: extraction, error: insertErr } = await svc()
    .from("ma_document_extractions")
    .insert({
      deal_id: source_type === "ma" ? source_id : null,
      source_type,
      source_id,
      doc_id,
      file_name: doc_name,
      storage_path,
      status: "queued",
      processing_mode: "async",
      dados_extraidos: { _bucket: bucket, _context: context ?? {} },
    })
    .select("id")
    .single();

  if (insertErr || !extraction) {
    console.error("[OCR/trigger] Erro ao inserir extração:", insertErr);
    return NextResponse.json({ error: "Erro ao registrar extração" }, { status: 500 });
  }

  const extraction_id = extraction.id;

  // Dispara W9 de forma fire-and-forget (não bloqueia a resposta)
  fetch(W9_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      extraction_id,
      deal_id: source_type === "ma" ? source_id : null,
      doc_id,
      storage_path,
      bucket,
    }),
  }).catch((err) => {
    console.error("[OCR/trigger] Erro ao disparar W9:", err);
  });

  return NextResponse.json({ ok: true, extraction_id, status: "queued" });
}

// GET — polling: retorna status atual de uma extração
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const extraction_id = searchParams.get("extraction_id");
  if (!extraction_id) return NextResponse.json({ error: "extraction_id obrigatório" }, { status: 400 });

  const { data, error } = await svc()
    .from("ma_document_extractions")
    .select("id, status, tipo_documento, dados_extraidos, resumo, confiabilidade, campos_baixa_confianca, pendencias, requer_revisao_humana, processed_at, error_message")
    .eq("id", extraction_id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Extração não encontrada" }, { status: 404 });

  return NextResponse.json({ extraction: data });
}
