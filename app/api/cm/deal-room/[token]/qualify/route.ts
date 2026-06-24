import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: access } = await svc()
    .from("cm_deal_room_access")
    .select("id, nda_accepted, access_tier, revoked, expires_at, listing_id, buyer_name, buyer_company")
    .eq("access_token", token)
    .single();

  if (!access || access.revoked)
    return NextResponse.json({ error: "Link inválido ou revogado" }, { status: 404 });

  if (access.expires_at && new Date(access.expires_at) < new Date())
    return NextResponse.json({ error: "Link expirado" }, { status: 410 });

  if (!access.nda_accepted)
    return NextResponse.json({ error: "NDA precisa ser aceito antes de qualificar" }, { status: 422 });

  if (access.access_tier !== "nda_only")
    return NextResponse.json({ error: "Qualificação já enviada", access_tier: access.access_tier }, { status: 409 });

  const formData = await req.formData();
  const file = formData.get("proof_of_funds") as File | null;
  const buyerName = formData.get("buyer_name") as string | null;
  const buyerCompany = formData.get("buyer_company") as string | null;
  const notes = formData.get("notes") as string | null;

  let storagePath: string | null = null;

  if (file) {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const safeName = `proof-${access.id}${ext}`;
    const path = `cm-qualifications/${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await svc().storage
      .from("documents")
      .upload(path, buffer, { contentType: file.type, upsert: true });

    if (uploadErr)
      return NextResponse.json({ error: `Erro no upload: ${uploadErr.message}` }, { status: 500 });

    storagePath = path;
  }

  const { error } = await svc()
    .from("cm_deal_room_access")
    .update({
      qualification_status: "pendente",
      proof_of_funds_path: storagePath,
      qualification_notes: notes,
      buyer_name: buyerName || access.buyer_name,
      buyer_company: buyerCompany || access.buyer_company,
    })
    .eq("id", access.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    message: "Qualificação enviada. A equipe V3 Partners analisará e liberará o acesso.",
  });
}
