import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;

// Rota publica — sem cookie de sessao, protegida por token.
// GET  /api/credit-engine/intake/[token] — valida token, retorna nome mascarado do titular
// POST /api/credit-engine/intake/[token] — registra consentimento + recebe upload do Registrato

interface RouteParams { params: Promise<{ token: string }> }

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_MIMES = new Set(["application/pdf"]);
const MAX_FILE_SIZE = 16 * 1024 * 1024;
const W9_WEBHOOK = `${process.env.N8N_BASE_URL ?? "https://n8n-514n.onrender.com"}/webhook/v3-doc-extract-large`;

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  const first = parts[0];
  const maskedRest = parts.slice(1).map((p) => p[0] + "***");
  return [first, ...maskedRest].join(" ");
}

async function resolveConsent(token: string) {
  const db = svc();
  const { data } = await db
    .from("credit_consents")
    .select("id, subject_name, subject_cpf_cnpj, intake_expires_at, status, registrato_pdf_path, deal_proposal_id")
    .eq("intake_token", token)
    .single();

  if (!data) return null;
  if (new Date(data.intake_expires_at) < new Date()) return { ...data, expired: true };
  return { ...data, expired: false };
}

// GET — valida link, retorna dados nao-sensiveis para exibicao
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const consent = await resolveConsent(token);

  if (!consent) return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  if (consent.expired) return NextResponse.json({ error: "Este link expirou. Solicite um novo à mesa V3 Partners." }, { status: 410 });

  return NextResponse.json({
    valid: true,
    subject_name_masked: maskName(consent.subject_name ?? ""),
    already_consented: consent.status !== "pending",
    registrato_uploaded: !!consent.registrato_pdf_path,
  });
}

// POST — aceite do consentimento + upload do PDF do Registrato (multipart/form-data)
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const consent = await resolveConsent(token);

  if (!consent) return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  if (consent.expired) return NextResponse.json({ error: "Este link expirou." }, { status: 410 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formato de envio inválido." }, { status: 400 });
  }

  const lgpdConsent = formData.get("lgpd_consent");
  if (lgpdConsent !== "true") {
    return NextResponse.json({ error: "Consentimento LGPD é obrigatório." }, { status: 422 });
  }

  const db = svc();
  const nowIso = new Date().toISOString();

  // Registra o aceite (idempotente — sobrescreve se reenviado antes de expirar)
  const { error: consentErr } = await db
    .from("credit_consents")
    .update({
      status: "consented",
      consented_at: nowIso,
      consent_ip: ip,
      consent_user_agent: req.headers.get("user-agent") ?? "",
    })
    .eq("id", consent.id);

  if (consentErr) {
    return NextResponse.json({ error: "Falha ao registrar consentimento." }, { status: 500 });
  }

  // Upload do Registrato e opcional — cliente pode aceitar o consentimento
  // e enviar o PDF depois, dentro da mesma janela de 72h.
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ ok: true, consented: true, registrato_uploaded: false });
  }

  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json({ error: "Envie o Registrato em formato PDF." }, { status: 415 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Arquivo maior que 16MB." }, { status: 413 });
  }

  const timestamp = Date.now();
  const docId = `registrato_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `${consent.id}/${docId}.pdf`;
  const bucket = "credit-documents";

  const { error: uploadErr } = await db.storage.from(bucket).upload(storagePath, buf, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (uploadErr) {
    console.error("[credit-intake] Storage error:", uploadErr);
    return NextResponse.json({ error: "Falha ao salvar arquivo. Tente novamente." }, { status: 500 });
  }

  // Registra extração assíncrona (mesmo padrão do /api/ocr/trigger) e dispara W9
  const { data: extraction, error: extractErr } = await db
    .from("ma_document_extractions")
    .insert({
      deal_id: null,
      source_type: "credit",
      source_id: consent.deal_proposal_id ?? consent.id,
      doc_id: docId,
      file_name: "registrato.pdf",
      storage_path: storagePath,
      status: "queued",
      processing_mode: "async",
      dados_extraidos: { _bucket: bucket, _context: { tipo: "registrato_bacen", credit_consent_id: consent.id } },
    })
    .select("id")
    .single();

  if (extractErr || !extraction) {
    console.error("[credit-intake] Erro ao registrar extração:", extractErr);
    // Upload já foi salvo — registra o path mesmo sem OCR disparado, para não perder o arquivo
    await db.from("credit_consents").update({ registrato_pdf_path: storagePath }).eq("id", consent.id);
    return NextResponse.json({ ok: true, consented: true, registrato_uploaded: true, ocr_queued: false });
  }

  await db.from("credit_consents").update({
    registrato_pdf_path: storagePath,
    registrato_extraction_id: extraction.id,
  }).eq("id", consent.id);

  fetch(W9_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extraction_id: extraction.id, deal_id: null, doc_id: docId, storage_path: storagePath, bucket }),
  }).catch((err) => console.error("[credit-intake] Erro ao disparar W9:", err));

  return NextResponse.json({ ok: true, consented: true, registrato_uploaded: true, ocr_queued: true });
}
