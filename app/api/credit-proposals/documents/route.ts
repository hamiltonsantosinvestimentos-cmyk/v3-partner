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

  // Sanitiza nome do arquivo e monta caminho
  const safeName    = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 80);
  const storagePath = `${proposal.partner_id}/${proposalId}/${docId}_${Date.now()}_${safeName}`;

  // Remove versão anterior do mesmo doc (se existir)
  const existingDocs: DocEntry[] = Array.isArray(proposal.documents) ? proposal.documents : [];
  const oldDoc = existingDocs.find((d) => d.doc_id === docId);
  if (oldDoc) {
    await svc.storage.from(BUCKET).remove([oldDoc.storage_path]);
  }

  // Upload para o Storage
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await svc.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  // Gera signed URL com 20 dias de validade
  const { data: signedData } = await svc.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES);

  // Atualiza campo documents (JSONB) da proposta
  const newDoc: DocEntry = {
    doc_id:       docId,
    file_name:    file.name,
    storage_path: storagePath,
    uploaded_at:  new Date().toISOString(),
    uploaded_by:  user.id,
  };
  const updatedDocs = [...existingDocs.filter((d) => d.doc_id !== docId), newDoc];

  await svc
    .from("credit_desk_proposals")
    .update({ documents: updatedDocs, updated_at: new Date().toISOString() })
    .eq("id", proposalId);

  logAudit({
    userId: user.id, userName: profile?.full_name,
    action: "CREATE", entity: "credit_documents" as never,
    entityId: proposalId, newData: { doc_id: docId, file_name: file.name },
  });

  return NextResponse.json({
    ok: true,
    document: { ...newDoc, url: signedData?.signedUrl ?? null },
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
    .select("id, partner_id, documents")
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

  return NextResponse.json({ documents: docsWithUrls });
}

// DELETE — remove documento do storage e da proposta
export async function DELETE(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const proposalId = searchParams.get("proposal_id");
  const docId      = searchParams.get("doc_id");
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
  const docToRemove = docs.find((d) => d.doc_id === docId);
  if (!docToRemove) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

  // Remove do Storage
  await svc.storage.from(BUCKET).remove([docToRemove.storage_path]);

  // Atualiza JSONB
  const updatedDocs = docs.filter((d) => d.doc_id !== docId);
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
