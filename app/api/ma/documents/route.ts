import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const DEFAULT_BUCKET = "ma-documents";
const GOVERNED_BUCKET = "v3-docs-publico";
const SIGNED_URL_EXPIRES = 20 * 24 * 60 * 60;

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

type DocEntry = {
  doc_id: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  uploaded_by: string;
  bucket?: string;
  file_hash?: string;
  category?: string;
};

function resolveBucket(doc: DocEntry): string {
  if (doc.bucket) return doc.bucket;
  if (doc.storage_path.startsWith("MA/") || doc.storage_path.startsWith("Credito/") || doc.storage_path.startsWith("Administracao/")) return GOVERNED_BUCKET;
  return DEFAULT_BUCKET;
}

// POST — upload de documento
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData  = await req.formData();
  const file      = formData.get("file")    as File   | null;
  const dealId    = formData.get("deal_id") as string | null;
  const docId     = formData.get("doc_id")  as string | null;
  const category  = (formData.get("category") as string | null) ?? "Due_Diligence";

  if (!file || !dealId || !docId) {
    return NextResponse.json({ error: "Campos obrigatórios: file, deal_id, doc_id" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: deal, error: dealError } = await svc
    .from("ma_deals")
    .select("id, documents")
    .eq("id", dealId)
    .single();

  if (dealError || !deal) {
    return NextResponse.json({ error: "Operação M&A não encontrada" }, { status: 404 });
  }

  const safeName    = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 80);
  const storagePath = `${dealId}/${docId}_${Date.now()}_${safeName}`;

  const bytes = await file.arrayBuffer();
  const fileHash = createHash("sha256").update(Buffer.from(bytes)).digest("hex");

  const { data: duplicateRow } = await svc
    .from("ma_documents")
    .select("id, doc_id, file_name, storage_path, bucket, uploaded_at")
    .eq("deal_id", dealId)
    .eq("file_hash", fileHash)
    .limit(1)
    .maybeSingle();

  if (duplicateRow) {
    const { data: existingSigned } = await svc.storage
      .from(duplicateRow.bucket)
      .createSignedUrl(duplicateRow.storage_path, SIGNED_URL_EXPIRES);
    return NextResponse.json({
      ok: true,
      duplicate: true,
      document: {
        doc_id: duplicateRow.doc_id,
        file_name: duplicateRow.file_name,
        storage_path: duplicateRow.storage_path,
        uploaded_at: duplicateRow.uploaded_at,
        url: existingSigned?.signedUrl ?? null,
      },
    });
  }

  const existingDocs: DocEntry[] = Array.isArray(deal.documents) ? deal.documents : [];
  const oldDoc = existingDocs.find((d) => d.doc_id === docId);
  if (oldDoc) {
    await svc.storage.from(resolveBucket(oldDoc)).remove([oldDoc.storage_path]);
  }

  const { error: uploadError } = await svc.storage
    .from(DEFAULT_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: `Erro no storage: ${uploadError.message}` }, { status: 500 });
  }

  const { data: signedData } = await svc.storage
    .from(DEFAULT_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES);

  const newDoc: DocEntry = {
    doc_id:       docId,
    file_name:    file.name,
    storage_path: storagePath,
    bucket:       DEFAULT_BUCKET,
    category,
    file_hash:    fileHash,
    uploaded_at:  new Date().toISOString(),
    uploaded_by:  user.id,
  };
  const updatedDocs = [...existingDocs.filter((d) => d.doc_id !== docId), newDoc];

  const { error: updateError } = await svc
    .from("ma_deals")
    .update({ documents: updatedDocs })
    .eq("id", dealId);

  if (updateError) {
    await svc.storage.from(DEFAULT_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: `Erro ao salvar no banco: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    document: { ...newDoc, url: signedData?.signedUrl ?? null },
  });
}

// GET — lista documentos da operação com signed URLs
export async function GET(req: NextRequest) {
  const { user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("deal_id");
  if (!dealId) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { data: deal } = await svc
    .from("ma_deals")
    .select("id, documents")
    .eq("id", dealId)
    .single();

  if (!deal) return NextResponse.json({ error: "Operação não encontrada" }, { status: 404 });

  const docs: DocEntry[] = Array.isArray(deal.documents) ? deal.documents : [];

  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => {
      const bucket = resolveBucket(doc);
      const { data } = await svc.storage
        .from(bucket)
        .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRES);
      return { ...doc, url: data?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ documents: docsWithUrls });
}

// DELETE — remove documento
export async function DELETE(req: NextRequest) {
  const { user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("deal_id");
  const docId  = searchParams.get("doc_id");
  if (!dealId || !docId) {
    return NextResponse.json({ error: "deal_id e doc_id obrigatórios" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: deal } = await svc
    .from("ma_deals")
    .select("id, documents")
    .eq("id", dealId)
    .single();

  if (!deal) return NextResponse.json({ error: "Operação não encontrada" }, { status: 404 });

  const docs: DocEntry[] = Array.isArray(deal.documents) ? deal.documents : [];
  const docToRemove = docs.find((d) => d.doc_id === docId);
  if (!docToRemove) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

  await svc.storage.from(resolveBucket(docToRemove)).remove([docToRemove.storage_path]);

  const updatedDocs = docs.filter((d) => d.doc_id !== docId);
  await svc.from("ma_deals").update({ documents: updatedDocs }).eq("id", dealId);

  return NextResponse.json({ ok: true });
}
