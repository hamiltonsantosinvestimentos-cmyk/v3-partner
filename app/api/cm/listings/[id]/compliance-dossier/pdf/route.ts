import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { hasComplianceDashboardAccess } from "@/lib/cm/compliance-access";

// GET /api/cm/listings/[id]/compliance-dossier/pdf -- reassina a URL do PDF
// já finalizado (a assinatura de 30 dias gerada no fechamento do quórum
// pode expirar; esta rota nunca gera PDF novo, só re-assina o já existente).

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const BUCKET = "documents"; // ver nota em lib/compliance-dossier-generate.ts
const SIGNED_URL_SECONDS = 30 * 24 * 60 * 60;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const allowed = await hasComplianceDashboardAccess(user?.id);
  if (!allowed) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const db = svc();
  const { data: listing } = await db.from("cm_asset_listings").select("risk_dossier_pdf_path, risk_dossier_hash, risk_dossier_finalized_at").eq("id", id).single();

  if (!listing?.risk_dossier_pdf_path) {
    return NextResponse.json({ error: "Dossiê ainda não finalizado (quórum incompleto)" }, { status: 404 });
  }

  const { data: signed, error } = await db.storage.from(BUCKET).createSignedUrl(listing.risk_dossier_pdf_path, SIGNED_URL_SECONDS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    pdf_url: signed.signedUrl,
    hash: listing.risk_dossier_hash,
    finalized_at: listing.risk_dossier_finalized_at,
  });
}
