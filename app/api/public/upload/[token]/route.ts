import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const maxDuration = 60;

// MIME types permitidos
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",     // .xlsx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword",  // .doc
  "application/vnd.ms-excel",                                              // .xls
]);

const MAX_FILE_SIZE = 32 * 1024 * 1024; // 32MB

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — verifica validade do token (usado pela página pública)
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const { token } = await params;

  const { data: tokenRow } = await svc()
    .from("deal_upload_tokens")
    .select("id, deal_id, label, expires_at, used_count, max_uses, status")
    .eq("token", token)
    .eq("status", "active")
    .single();

  if (!tokenRow) {
    return NextResponse.json({ valid: false, reason: "Link inválido ou revogado." }, { status: 404 });
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    await svc().from("deal_upload_tokens").update({ status: "expired" }).eq("token", token);
    return NextResponse.json({ valid: false, reason: "Este link expirou." }, { status: 410 });
  }

  if (tokenRow.used_count >= tokenRow.max_uses) {
    return NextResponse.json({ valid: false, reason: "Limite de uploads atingido." }, { status: 429 });
  }

  return NextResponse.json({
    valid: true,
    label:      tokenRow.label,
    expires_at: tokenRow.expires_at,
    remaining:  tokenRow.max_uses - tokenRow.used_count,
  });
}

// POST — recebe o upload do arquivo
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Valida o token
  const { data: tokenRow } = await svc()
    .from("deal_upload_tokens")
    .select("id, deal_id, partner_id, label, expires_at, used_count, max_uses, status")
    .eq("token", token)
    .eq("status", "active")
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: "Link inválido ou revogado." }, { status: 404 });
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "Este link expirou." }, { status: 410 });
  }
  if (tokenRow.used_count >= tokenRow.max_uses) {
    return NextResponse.json({ error: "Limite de uploads atingido." }, { status: 429 });
  }

  // Lê o arquivo do FormData
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formato de envio inválido." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });

  // Validações de segurança
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json({
      error: `Tipo de arquivo não permitido (${file.type}). Use PDF, imagens ou documentos Office.`,
    }, { status: 415 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  if (buf.byteLength > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Arquivo maior que 32MB." }, { status: 413 });
  }

  // Sanitiza nome do arquivo
  const safeName = file.name
    .replace(/[^a-zA-Z0-9._\-À-ɏ]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);

  const timestamp  = Date.now();
  const docId      = `upload_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `${tokenRow.deal_id}/${docId}_${safeName}`;
  const fileHash   = createHash("sha256").update(buf).digest("hex");

  // Upload para Supabase Storage
  const { error: uploadErr } = await svc()
    .storage
    .from("ma-documents")
    .upload(storagePath, buf, {
      contentType: file.type,
      upsert:      false,
    });

  if (uploadErr) {
    console.error("[public/upload] Storage error:", uploadErr);
    return NextResponse.json({ error: "Falha ao salvar arquivo. Tente novamente." }, { status: 500 });
  }

  // Registra no audit log
  await svc().from("deal_upload_audit").insert({
    token_id:     tokenRow.id,
    deal_id:      tokenRow.deal_id,
    file_name:    safeName,
    storage_path: storagePath,
    file_size:    buf.byteLength,
    file_hash:    fileHash,
    mime_type:    file.type,
    ip_address:   ip,
  });

  // Adiciona documento ao deal (ma_deals.documents array)
  const { data: deal } = await svc()
    .from("ma_deals")
    .select("documents")
    .eq("id", tokenRow.deal_id)
    .single();

  const existingDocs = Array.isArray(deal?.documents) ? deal.documents : [];
  await svc().from("ma_deals").update({
    documents: [
      ...existingDocs,
      {
        doc_id:       docId,
        file_name:    safeName,
        storage_path: storagePath,
        uploaded_at:  new Date().toISOString(),
        uploaded_by:  tokenRow.partner_id ?? "external",
        source:       "upload_link",
      },
    ],
  }).eq("id", tokenRow.deal_id);

  // Incrementa contador de uso
  await svc()
    .from("deal_upload_tokens")
    .update({ used_count: tokenRow.used_count + 1 })
    .eq("id", tokenRow.id);

  // Dispara W11 (notificação Mesa) — fire-and-forget
  const n8nBase = process.env.N8N_API_URL?.replace("/api/v1", "");
  if (n8nBase) {
    fetch(`${n8nBase}/webhook/v3-upload-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET ?? "" },
      body: JSON.stringify({
        deal_id:   tokenRow.deal_id,
        doc_id:    docId,
        file_name: safeName,
        file_size: buf.byteLength,
        mime_type: file.type,
        token_label: tokenRow.label,
        ip_address:  ip,
      }),
    }).catch(e => console.error("[public/upload] W11 webhook:", e));
  }

  return NextResponse.json({
    ok:        true,
    doc_id:    docId,
    file_name: safeName,
    message:   "Documento recebido com sucesso. Nossa equipe irá analisá-lo em breve.",
  });
}
