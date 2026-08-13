import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/cm/listings/nda-queue — fila de NDAs marcados por GESTAO/MESA_OPERACIONAL aguardando
 *  aprovacao de diretor. So ADMIN ve/aprova (mesmo gate do PATCH em /nda-authorize) -- este endpoint
 *  so lista o que ja foi submetido com anexo real via /nda-authorize POST, nunca fabrica nada. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas ADMIN pode ver a fila de autorização de NDA" }, { status: 403 });
  }

  const { data, error } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id, apelido, valor_face, asset_type, nda_document_url, nda_authorization_reason, nda_authorization_requested_at, requested_by:nda_authorization_requested_by(id, full_name)")
    .eq("nda_authorization_status", "pending_director")
    .order("nda_authorization_requested_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listings: data ?? [] });
}
