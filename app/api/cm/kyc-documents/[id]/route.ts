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

/**
 * PATCH /api/cm/kyc-documents/[id] — aprova (promove para cm_listing_documents,
 * visivel no Deal Room publico) ou rejeita (fica retido, nunca sai do painel segregado).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { action, rejection_reason } = await req.json();

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action deve ser approve ou reject" }, { status: 422 });
  }

  const { data: doc } = await svc().from("cm_kyc_documents").select("*").eq("id", id).single();
  if (!doc) return NextResponse.json({ error: "Documento KYC não encontrado" }, { status: 404 });
  if (doc.status !== "pendente") {
    return NextResponse.json({ error: `Documento já processado (status: ${doc.status})` }, { status: 422 });
  }

  if (action === "reject") {
    const { data, error } = await svc()
      .from("cm_kyc_documents")
      .update({
        status: "rejeitado",
        reviewed_by: caller.userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejection_reason ?? null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ document: data });
  }

  // approve: promove o documento para cm_listing_documents (repositorio publico do Deal Room)
  const { data: promoted, error: promoteError } = await svc()
    .from("cm_listing_documents")
    .insert({
      listing_id: doc.listing_id,
      document_type: `kyc_${doc.party_type}_${doc.document_type}`,
      storage_path: doc.storage_path,
      original_filename: doc.original_filename,
      validation_status: "validado",
    })
    .select("id")
    .single();

  if (promoteError) return NextResponse.json({ error: promoteError.message }, { status: 500 });

  const { data, error } = await svc()
    .from("cm_kyc_documents")
    .update({
      status: "aprovado",
      reviewed_by: caller.userId,
      reviewed_at: new Date().toISOString(),
      promoted_document_id: promoted.id,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}
