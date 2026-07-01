import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const BUCKET = "credit-documents";
const SIGNED_URL_EXPIRES = 20 * 24 * 60 * 60;
const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type DocEntry = {
  doc_id: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  uploaded_by: string;
};

// POST — registra metadados em credit_desk_proposals.documents após upload direto ao Storage
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("id, full_name, role").eq("id", user.id).single();

  const body = await req.json() as {
    proposal_id: string;
    doc_id: string;
    file_name: string;
    storage_path: string;
  };
  const { proposal_id, doc_id, file_name, storage_path } = body;
  if (!proposal_id || !doc_id || !file_name || !storage_path) {
    return NextResponse.json({ error: "proposal_id, doc_id, file_name e storage_path são obrigatórios" }, { status: 400 });
  }

  const { data: proposal, error: proposalError } = await svc
    .from("credit_desk_proposals")
    .select("id, partner_id, documents")
    .eq("id", proposal_id)
    .single();

  if (proposalError || !proposal) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  if (!isAdmin && proposal.partner_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const existingDocs: DocEntry[] = Array.isArray(proposal.documents) ? proposal.documents : [];
  const newDoc: DocEntry = {
    doc_id,
    file_name,
    storage_path,
    uploaded_at: new Date().toISOString(),
    uploaded_by: user.id,
  };
  // Não remove arquivos anteriores do mesmo doc_id — múltiplos arquivos por doc_id são permitidos
  const updatedDocs = [...existingDocs, newDoc];

  const { error: updateError } = await svc
    .from("credit_desk_proposals")
    .update({ documents: updatedDocs })
    .eq("id", proposal_id);

  if (updateError) {
    await svc.storage.from(BUCKET).remove([storage_path]);
    return NextResponse.json({ error: `Erro ao salvar no banco: ${updateError.message}` }, { status: 500 });
  }

  const { data: signedData } = await svc.storage.from(BUCKET).createSignedUrl(storage_path, SIGNED_URL_EXPIRES);

  logAudit({
    userId: user.id, userName: profile?.full_name,
    action: "CREATE", entity: "credit_documents" as never,
    entityId: proposal_id, newData: { doc_id, file_name },
  });

  return NextResponse.json({
    ok: true,
    document: { ...newDoc, url: signedData?.signedUrl ?? null, file_key: storage_path },
  });
}
