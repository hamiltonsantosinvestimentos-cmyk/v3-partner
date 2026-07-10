import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const FALLBACK_BUCKET = "ma-documents";
const WRITE_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

const CATEGORY_SUBFOLDER: Record<string, string> = {
  NDA: "01_NDA",
  Teaser: "02_Teaser",
  CIM: "03_CIM",
  Due_Diligence: "04_Due_Diligence",
  Propostas: "05_Propostas",
  Contrato: "06_Contrato",
  Closing: "07_Closing",
};

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function sanitizeAscii(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 100);
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
  const category = searchParams.get("category") ?? "Due_Diligence";

  if (!dealId || !docId) {
    return NextResponse.json({ error: "deal_id e doc_id são obrigatórios" }, { status: 400 });
  }
  if (!CATEGORY_SUBFOLDER[category]) {
    return NextResponse.json({ error: `Categoria inválida: ${category}` }, { status: 400 });
  }

  const safeName = sanitizeAscii(fileName);
  const timestamp = Date.now();

  const { data: deal } = await svc
    .from("ma_deals")
    .select("v3_code, title, sector")
    .eq("id", dealId)
    .single();

  let bucket = FALLBACK_BUCKET;
  let storagePath = `${dealId}/${docId}_${timestamp}_${safeName}`;

  if (deal?.v3_code) {
    let { data: folder } = await svc
      .from("folder_registry")
      .select("full_path")
      .eq("deal_code", deal.v3_code)
      .eq("depth", 1)
      .maybeSingle();

    if (!folder) {
      const safeClient = sanitizeAscii(deal.title || "Deal");
      try {
        await svc.rpc("create_deal_folder", {
          p_vertical: "MA",
          p_deal_code: deal.v3_code,
          p_client_name: safeClient,
          p_user_id: user.id,
        });
        ({ data: folder } = await svc
          .from("folder_registry")
          .select("full_path")
          .eq("deal_code", deal.v3_code)
          .eq("depth", 1)
          .maybeSingle());
      } catch {
        // RPC pode falhar por corrida/constraint de unicidade — segue com fallback abaixo
      }
    }

    if (folder?.full_path) {
      bucket = "v3-docs-publico";
      storagePath = `${folder.full_path}/${CATEGORY_SUBFOLDER[category]}/${docId}_${timestamp}_${safeName}`;
    }
  }

  const { data, error } = await svc.storage
    .from(bucket)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Erro ao gerar URL" }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl:   data.signedUrl,
    token:       data.token,
    storagePath,
    bucket,
    category,
  });
}
