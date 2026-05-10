import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const BUCKET = "credit-documents";
const SIGNED_URL_EXPIRES = 20 * 24 * 60 * 60; // 20 dias em segundos

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
const READ_ROLES  = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] as const;

type DocEntry = {
  doc_id: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  uploaded_by: string;
};

// POST — upload de documento
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file       = formData.get("file")        as File   | null;
  const proposalId = formData.get("proposal_id") as string | null;
  const docId      = formData.get("doc_id")      as string | null;

  if (!file || !proposalId || !docId) {
    return NextResponse.json({ error: "Campos obrigatórios: file, proposal_id, doc_id" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: proposal, error: proposalError } = await svc
    .from("credit_desk_proposals")
    .select("id, partner_id, documents")
    .eq("id", proposalId)
    .single();

  if (proposalError || !proposal) {
    return NextResponse.json({ error: `Proposta não encontrada: ${proposalError?.message ?? ""}` }, { status: 404 });
  }

  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  if (!isAdmin && proposal.partner_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Usa o partner_id ou o user.id como fallback para montar o caminho
  const ownerId  = proposal.partner_id ?? user.id;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 80);
  const storagePath = `${ownerId}/${proposalId}/${docId}_${Date.now()}_${safeName}`;

  const existingDocs: DocEntry[] = Array.isArray(proposal.documents) ? proposal.documents : [];

  // Upload para o Storage (não remove arquivos anteriores do mesmo doc_id)
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await svc.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: `Erro no storage: ${uploadError.message}` }, { status: 500 });
  }

  // Gera signed URL com 20 dias de validade
  const { data: signedData } = await svc.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES);

  // Adiciona novo doc à lista (múltiplos arquivos por doc_id são permitidos)
  const newDoc: DocEntry = {
    doc_id:       docId,
    file_name:    file.name,
    storage_path: storagePath,
    uploaded_at:  new Date().toISOString(),
    uploaded_by:  user.id,
  };
  const updatedDocs = [...existingDocs, newDoc];

  const { error: updateError } = await svc
    .from("credit_desk_proposals")
    .update({ documents: updatedDocs })
    .eq("id", proposalId);

  if (updateError) {
    // Remove o arquivo do storage pois não conseguimos salvar o registro
    await svc.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: `Erro ao salvar no banco: ${updateError.message}` }, { status: 500 });
  }

  logAudit({
    userId: user.id, userName: profile?.full_name,
    action: "CREATE", entity: "credit_documents" as never,
    entityId: proposalId, newData: { doc_id: docId, file_name: file.name },
  });

  return NextResponse.json({
    ok: true,
    document: { ...newDoc, url: signedData?.signedUrl ?? null, file_key: storagePath },
  });
}

// GET — lista documentos com signed URLs (20 dias)
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const proposalId = searchParams.get("proposal_id");
  if (!proposalId) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { data: proposal } = await svc
    .from("credit_desk_proposals")
    .select("id, partner_id, documents, checklist, mesa_comments")
    .eq("id", proposalId)
    .single();

  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const isReader = READ_ROLES.includes(profile?.role as typeof READ_ROLES[number]);
  if (!isReader && proposal.partner_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const docs: DocEntry[] = Array.isArray(proposal.documents) ? proposal.documents : [];

  // Gera signed URLs para todos os documentos
  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => {
      const { data } = await svc.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRES);
      return { ...doc, url: data?.signedUrl ?? null };
    })
  );

  const checklist = (proposal as any).checklist ?? {};
  const mesa_comments = Array.isArray((proposal as any).mesa_comments) ? (proposal as any).mesa_comments : [];
  return NextResponse.json({ documents: docsWithUrls, checklist, mesa_comments });
}

// DELETE — remove documento do storage e da proposta
export async function DELETE(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const proposalId = searchParams.get("proposal_id");
  const docId      = searchParams.get("doc_id");
  const fileKey    = searchParams.get("file_key"); // storage_path do arquivo específico
  if (!proposalId || !docId) {
    return NextResponse.json({ error: "proposal_id e doc_id obrigatórios" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: proposal } = await svc
    .from("credit_desk_proposals")
    .select("id, partner_id, documents")
    .eq("id", proposalId)
    .single();

  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  if (!isAdmin && proposal.partner_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const docs: DocEntry[] = Array.isArray(proposal.documents) ? proposal.documents : [];

  // Se file_key fornecido, remove apenas esse arquivo específico; senão remove todos do doc_id
  const docsToRemove = fileKey
    ? docs.filter((d) => d.storage_path === fileKey)
    : docs.filter((d) => d.doc_id === docId);

  if (docsToRemove.length === 0) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

  // Remove do Storage
  await svc.storage.from(BUCKET).remove(docsToRemove.map((d) => d.storage_path));

  // Atualiza JSONB
  const storagesToRemove = new Set(docsToRemove.map((d) => d.storage_path));
  const updatedDocs = docs.filter((d) => !storagesToRemove.has(d.storage_path));
  await svc
    .from("credit_desk_proposals")
    .update({ documents: updatedDocs, updated_at: new Date().toISOString() })
    .eq("id", proposalId);

  logAudit({
    userId: user.id, userName: profile?.full_name,
    action: "DELETE", entity: "credit_documents" as never,
    entityId: proposalId, newData: { doc_id: docId },
  });

  return NextResponse.json({ ok: true });
}
