import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BUCKET      = "ma-documents";
const WRITE_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — gera signed upload URL para upload direto do browser ao Supabase Storage
// Contorna o limite de body do Vercel serverless (4.5MB) para PDFs grandes
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!WRITE_ROLES.includes(profile?.role as typeof WRITE_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const dealId   = searchParams.get("deal_id");
  const docId    = searchParams.get("doc_id");
  const fileName = searchParams.get("file_name") ?? "documento.pdf";

  if (!dealId || !docId) {
    return NextResponse.json({ error: "deal_id e doc_id são obrigatórios" }, { status: 400 });
  }

  const safeName    = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 80);
  const storagePath = `${dealId}/${docId}_${Date.now()}_${safeName}`;

  const { data, error } = await svc.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Erro ao gerar URL" }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl:   data.signedUrl,
    token:       data.token,
    storagePath,
  });
}
