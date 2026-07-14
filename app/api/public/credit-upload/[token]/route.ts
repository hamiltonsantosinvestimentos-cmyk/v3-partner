import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { resolveChecklistForLine, type PortfolioLinhaDocs } from "@/lib/credit-checklists";

export const maxDuration = 60;

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.ms-excel",
]);

const MAX_FILE_SIZE = 32 * 1024 * 1024;
const BUCKET = "credit-documents";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function sanitizeAscii(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._\-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 150);
}

// GET — verifica validade do token e retorna o checklist da proposta
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: tokenRow } = await svc()
    .from("credit_upload_tokens")
    .select("id, proposal_id, label, expires_at, used_count, max_uses, status")
    .eq("token", token)
    .eq("status", "active")
    .single();

  if (!tokenRow) {
    return NextResponse.json({ valid: false, reason: "Link inválido ou revogado." }, { status: 404 });
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    await svc().from("credit_upload_tokens").update({ status: "expired" }).eq("token", token);
    return NextResponse.json({ valid: false, reason: "Este link expirou." }, { status: 410 });
  }
  if (tokenRow.used_count >= tokenRow.max_uses) {
    return NextResponse.json({ valid: false, reason: "Limite de uploads atingido." }, { status: 429 });
  }

  const { data: proposal } = await svc()
    .from("credit_desk_proposals")
    .select("code, client_name, credit_line, documents, checklist, metadata")
    .eq("id", tokenRow.proposal_id)
    .single();

  if (!proposal) {
    return NextResponse.json({ valid: false, reason: "Proposta não encontrada." }, { status: 404 });
  }

  const meta = (proposal.metadata as Record<string, unknown>) ?? {};
  const clientType: "PF" | "PJ" = meta.client_type === "PJ" ? "PJ" : "PF";

  const { data: portfolioLinhas } = await svc().from("portfolio_linhas").select("nome, documentos_pf, documentos_pj").eq("ativo", true);
  const checklist = resolveChecklistForLine(proposal.credit_line, clientType, (portfolioLinhas ?? []) as PortfolioLinhaDocs[]);

  const uploadedDocIds = new Set(
    Array.isArray(proposal.documents) ? (proposal.documents as { doc_id: string }[]).map(d => d.doc_id) : []
  );

  return NextResponse.json({
    valid:      true,
    label:      tokenRow.label,
    expires_at: tokenRow.expires_at,
    remaining:  tokenRow.max_uses - tokenRow.used_count,
    proposal:   { code: proposal.code, client_name: proposal.client_name, credit_line: proposal.credit_line },
    checklist:  checklist.map(c => ({ ...c, uploaded: uploadedDocIds.has(c.id) })),
  });
}

// POST — recebe o upload de um documento contra um item do checklist
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const { data: tokenRow } = await svc()
    .from("credit_upload_tokens")
    .select("id, proposal_id, partner_id, expires_at, used_count, max_uses, status")
    .eq("token", token)
    .eq("status", "active")
    .single();

  if (!tokenRow) return NextResponse.json({ error: "Link inválido ou revogado." }, { status: 404 });
  if (new Date(tokenRow.expires_at) < new Date()) return NextResponse.json({ error: "Este link expirou." }, { status: 410 });
  if (tokenRow.used_count >= tokenRow.max_uses) return NextResponse.json({ error: "Limite de uploads atingido." }, { status: 429 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formato de envio inválido." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const docIdInput = (formData.get("doc_id") as string | null)?.trim();
  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  if (!docIdInput) return NextResponse.json({ error: "Documento do checklist não informado." }, { status: 400 });

  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json({
      error: `Tipo de arquivo não permitido (${file.type}). Use PDF, imagens ou documentos Office.`,
    }, { status: 415 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Arquivo maior que 32MB." }, { status: 413 });
  }

  const { data: proposal } = await svc()
    .from("credit_desk_proposals")
    .select("documents, checklist, partner_id, credit_line, metadata")
    .eq("id", tokenRow.proposal_id)
    .single();

  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });

  // O doc_id precisa ser um item real do checklist desta proposta — evita
  // que o portador do link grave chaves arbitrárias no caminho do storage ou
  // no JSONB de checklist.
  const meta = (proposal.metadata as Record<string, unknown>) ?? {};
  const clientType: "PF" | "PJ" = meta.client_type === "PJ" ? "PJ" : "PF";
  const { data: portfolioLinhas } = await svc().from("portfolio_linhas").select("nome, documentos_pf, documentos_pj").eq("ativo", true);
  const validChecklist = resolveChecklistForLine(proposal.credit_line, clientType, (portfolioLinhas ?? []) as PortfolioLinhaDocs[]);
  if (!validChecklist.some(c => c.id === docIdInput)) {
    return NextResponse.json({ error: "Documento do checklist inválido." }, { status: 400 });
  }

  const safeName = sanitizeAscii(file.name);
  const fileHash = createHash("sha256").update(buf).digest("hex");

  const { data: duplicateRow } = await svc()
    .from("credit_upload_audit")
    .select("id, file_name")
    .eq("proposal_id", tokenRow.proposal_id)
    .eq("file_hash", fileHash)
    .limit(1)
    .maybeSingle();

  if (duplicateRow) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      doc_id: docIdInput,
      message: "Este arquivo já foi recebido anteriormente — nada novo foi enviado.",
    });
  }

  const ownerId = proposal.partner_id ?? tokenRow.partner_id ?? "cliente";
  const storagePath = `${ownerId}/${tokenRow.proposal_id}/${docIdInput}_${Date.now()}_${safeName}`;

  const { error: uploadErr } = await svc().storage.from(BUCKET).upload(storagePath, buf, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadErr) {
    console.error("[public/credit-upload] Storage error:", uploadErr);
    return NextResponse.json({ error: "Falha ao salvar arquivo. Tente novamente." }, { status: 500 });
  }

  await svc().from("credit_upload_audit").insert({
    token_id:     tokenRow.id,
    proposal_id:  tokenRow.proposal_id,
    doc_id:       docIdInput,
    file_name:    safeName,
    storage_path: storagePath,
    file_size:    buf.byteLength,
    file_hash:    fileHash,
    mime_type:    file.type,
    ip_address:   ip,
  });

  const existingDocs = Array.isArray(proposal.documents) ? (proposal.documents as Record<string, unknown>[]) : [];
  const existingChecklist = (proposal.checklist as Record<string, boolean> | null) ?? {};

  await svc().from("credit_desk_proposals").update({
    documents: [
      ...existingDocs,
      {
        doc_id:       docIdInput,
        file_name:    safeName,
        storage_path: storagePath,
        uploaded_at:  new Date().toISOString(),
        uploaded_by:  "cliente",
        source:       "upload_link",
      },
    ],
    checklist: { ...existingChecklist, [docIdInput]: true },
    updated_at: new Date().toISOString(),
  }).eq("id", tokenRow.proposal_id);

  await svc()
    .from("credit_upload_tokens")
    .update({ used_count: tokenRow.used_count + 1 })
    .eq("id", tokenRow.id);

  return NextResponse.json({
    ok:        true,
    doc_id:    docIdInput,
    file_name: safeName,
    message:   "Documento recebido com sucesso.",
  });
}
