import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BUCKET              = "ma-documents";
const SIGNED_URL_EXPIRES  = 20 * 24 * 60 * 60; // 20 dias
const WRITE_ROLES         = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type DocEntry = {
  doc_id:          string;
  file_name:       string;
  storage_path:    string;
  uploaded_at:     string;
  uploaded_by:     string;
  file_size_bytes?: number;
};

// POST — registra metadados no ma_deals.documents após upload direto ao Storage
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!WRITE_ROLES.includes(profile?.role as typeof WRITE_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json() as {
    deal_id:         string;
    doc_id:          string;
    file_name:       string;
    storage_path:    string;
    file_size_bytes: number;
  };

  const { deal_id, doc_id, file_name, storage_path, file_size_bytes } = body;
  if (!deal_id || !doc_id || !file_name || !storage_path) {
    return NextResponse.json({ error: "deal_id, doc_id, file_name e storage_path são obrigatórios" }, { status: 400 });
  }

  const { data: deal, error: dealError } = await svc
    .from("ma_deals")
    .select("id, documents")
    .eq("id", deal_id)
    .single();

  if (dealError || !deal) {
    return NextResponse.json({ error: "Operação M&A não encontrada" }, { status: 404 });
  }

  const existingDocs: DocEntry[] = Array.isArray(deal.documents) ? deal.documents : [];

  // Remove versão anterior do mesmo doc_id (substituição)
  const oldDoc = existingDocs.find(d => d.doc_id === doc_id);
  if (oldDoc) {
    await svc.storage.from(BUCKET).remove([oldDoc.storage_path]);
  }

  const newDoc: DocEntry = {
    doc_id,
    file_name,
    storage_path,
    uploaded_at:     new Date().toISOString(),
    uploaded_by:     user.id,
    file_size_bytes: file_size_bytes ?? undefined,
  };

  const updatedDocs = [...existingDocs.filter(d => d.doc_id !== doc_id), newDoc];

  const { error: updateError } = await svc
    .from("ma_deals")
    .update({ documents: updatedDocs })
    .eq("id", deal_id);

  if (updateError) {
    return NextResponse.json({ error: `Erro ao salvar no banco: ${updateError.message}` }, { status: 500 });
  }

  const { data: signedData } = await svc.storage
    .from(BUCKET)
    .createSignedUrl(storage_path, SIGNED_URL_EXPIRES);

  return NextResponse.json({
    ok: true,
    document: { ...newDoc, url: signedData?.signedUrl ?? null },
  });
}
