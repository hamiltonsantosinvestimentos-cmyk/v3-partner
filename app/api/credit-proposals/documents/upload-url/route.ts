import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { resolveContentType } from "@/lib/credit-documents/content-type";

export const dynamic = "force-dynamic";

const BUCKET = "credit-documents";
const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — gera signed upload URL para upload direto do browser ao Supabase Storage.
// Contorna o limite de body do Vercel serverless (4.5MB) para documentos grandes.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();

  const { searchParams } = new URL(req.url);
  const proposalId = searchParams.get("proposal_id");
  const docId       = searchParams.get("doc_id");
  const fileName    = searchParams.get("file_name") ?? "documento";

  if (!proposalId || !docId) {
    return NextResponse.json({ error: "proposal_id e doc_id são obrigatórios" }, { status: 400 });
  }

  const { data: proposal, error: proposalError } = await svc
    .from("credit_desk_proposals")
    .select("id, partner_id")
    .eq("id", proposalId)
    .single();

  if (proposalError || !proposal) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  if (!isAdmin && proposal.partner_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Nesta etapa só temos o nome do arquivo (o navegador ainda não enviou bytes),
  // então o content-type é resolvido puramente pela extensão.
  const contentType = resolveContentType(fileName, "");
  if (!contentType) {
    return NextResponse.json(
      { error: "Tipo de arquivo não suportado. Envie PDF, JPG, PNG, DOC ou DOCX." },
      { status: 415 }
    );
  }

  const ownerId  = proposal.partner_id ?? user.id;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 80);
  const storagePath = `${ownerId}/${proposalId}/${docId}_${Date.now()}_${safeName}`;

  const { data, error } = await svc.storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Erro ao gerar URL" }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, storagePath, contentType });
}
