import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function sanitizeAscii(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

// GET — gera signed upload URL para upload direto do browser ao Supabase Storage.
// Contorna o limite de body do Vercel serverless (~4.5MB) para documentos grandes
// (ex: anexo com múltiplos sub-documentos anexados para OCR na Bolsa de Ativos).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svcClient = svc();
  const { data: profile } = await svcClient.from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const fileName = searchParams.get("file_name") ?? "documento";

  const { data: listing } = await svcClient
    .from("cm_asset_listings")
    .select("id, anonymous_id")
    .eq("id", id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });

  const safeName = sanitizeAscii(fileName);
  const storagePath = `cm-documents/${listing.anonymous_id}/${Date.now()}_${safeName}`;

  const { data, error } = await svcClient.storage
    .from("documents")
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Erro ao gerar URL de upload" }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    storagePath,
    bucket: "documents",
  });
}
