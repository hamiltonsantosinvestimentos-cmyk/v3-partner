import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const BUCKET = "credit-documents";
const SIGNED_URL_EXPIRES = 20 * 24 * 60 * 60;

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/instituicao/propostas/[id] — dados completos + documentos com signed URLs
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const svc = serviceClient();

  const { data: proposal, error } = await svc
    .from("credit_desk_proposals")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !proposal) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }

  // Gera signed URLs para todos os documentos
  const docs: { doc_id: string; file_name: string; storage_path: string; uploaded_at: string }[] =
    Array.isArray(proposal.documents) ? proposal.documents : [];

  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => {
      const { data } = await svc.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRES);
      return { ...doc, url: data?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ proposal: { ...proposal, documents: docsWithUrls } });
}

// PATCH /api/instituicao/propostas/[id] — salva parecer da instituição
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { instituicao, status, observacao } = await req.json();

  if (!instituicao || !status) {
    return NextResponse.json({ error: "instituicao e status são obrigatórios." }, { status: 400 });
  }

  const svc = serviceClient();

  // Busca feedback atual
  const { data: proposal } = await svc
    .from("credit_desk_proposals")
    .select("instituicao_feedback")
    .eq("id", id)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }

  const existingFeedback: { instituicao: string; status: string; observacao: string; updated_at: string }[] =
    Array.isArray(proposal.instituicao_feedback) ? proposal.instituicao_feedback : [];

  // Substitui ou adiciona o feedback da instituição
  const newEntry = { instituicao, status, observacao: observacao ?? "", updated_at: new Date().toISOString() };
  const updated = [
    ...existingFeedback.filter((f) => f.instituicao !== instituicao),
    newEntry,
  ];

  const { error } = await svc
    .from("credit_desk_proposals")
    .update({ instituicao_feedback: updated })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Erro ao salvar parecer." }, { status: 500 });
  }

  return NextResponse.json({ success: true, feedback: newEntry });
}
