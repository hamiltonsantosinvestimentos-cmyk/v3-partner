import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

/** GET /api/cm/kyc-documents?listing_id=X — painel segregado, documentos retidos ate aprovacao */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listing_id");
  if (!listingId) return NextResponse.json({ error: "listing_id obrigatório" }, { status: 422 });

  const { data, error } = await svc()
    .from("cm_kyc_documents")
    .select("*")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

/** POST /api/cm/kyc-documents — upload de documento KYC (fica retido, pendente de validacao) */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const listingId = formData.get("listing_id") as string | null;
  const partyType = formData.get("party_type") as string | null;
  const partyName = formData.get("party_name") as string | null;
  const documentType = (formData.get("document_type") as string) || "outro";

  if (!file || !listingId || !partyType) {
    return NextResponse.json({ error: "file, listing_id e party_type são obrigatórios" }, { status: 422 });
  }
  if (!["comprador", "vendedor"].includes(partyType)) {
    return NextResponse.json({ error: "party_type inválido" }, { status: 422 });
  }

  const filename = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `cm-kyc/${listingId}/${partyType}_${Date.now()}_${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await svc().storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: `Upload falhou: ${uploadError.message}` }, { status: 500 });

  const { data: doc, error: insertError } = await svc()
    .from("cm_kyc_documents")
    .insert({
      listing_id: listingId,
      party_type: partyType,
      party_name: partyName || null,
      document_type: documentType,
      storage_path: storagePath,
      original_filename: file.name,
      created_by: caller.userId,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ document: doc }, { status: 201 });
}
