import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { hasComplianceDashboardAccess } from "@/lib/cm/compliance-access";
import { generateAndStoreComplianceDossierPdf } from "@/lib/compliance-dossier-generate";

// Quórum de fechamento do Dossiê de Risco (Cockpit de Compliance, Fase 4,
// 10/09/2026), regra confirmada por João em 22/08/2026: 1 Sócio ADMIN
// (João, Hamilton ou Robson, qualquer um dos três) + Dr. Luis Athaydes
// (jurídico). Mesmos IDs/mapas já usados em
// app/api/contracts/templates/[id]/review/route.ts (quórum de aprovação de
// minuta) -- duplicado aqui de propósito (mesmo padrão já usado no resto do
// projeto pra esses 2 mapas pequenos, nunca importado entre rotas).

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const JURIDICO: Record<string, string> = {
  "82171bc1-edbd-40f8-936b-1b26d412a121": "Dr. Luis Athaydes",
};
// Hamilton tem 2 contas (27a8a72e..., hamilton@, PARTNER_PRO, demonstração
// pra prospects; 75c6cac4..., suporte@, ADMIN, conta real dele) -- usa a
// real aqui, mesma correção já aplicada em outras 2 rotas de quórum.
const SOCIO_ADMIN: Record<string, string> = {
  "d5f26efd-8ed5-4d90-b3f4-9ce0004803c5": "Robson Lino",
  "d0af8eaa-9f3c-4e7a-b8c6-613736524317": "João Lemos",
  "75c6cac4-8d30-436e-b9a6-d5d494d7470b": "Hamilton Santos",
};

async function getSigner(userId: string | undefined) {
  if (!userId) return null;
  if (JURIDICO[userId]) return { userId, name: JURIDICO[userId], role: "juridico" as const };
  if (SOCIO_ADMIN[userId]) return { userId, name: SOCIO_ADMIN[userId], role: "socio_admin" as const };
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const allowed = await hasComplianceDashboardAccess(user?.id);
  if (!allowed) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const { data: signoffs } = await svc()
    .from("cm_risk_dossier_signoffs")
    .select("signer_name, signer_role, signed_at")
    .eq("listing_id", id);

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("risk_dossier_finalized_at, risk_dossier_pdf_path, risk_dossier_hash, risk_dossier_text, risk_dossier_generated_at")
    .eq("id", id)
    .single();

  return NextResponse.json({
    signoffs: signoffs ?? [],
    finalized_at: listing?.risk_dossier_finalized_at ?? null,
    pdf_path: listing?.risk_dossier_pdf_path ?? null,
    hash: listing?.risk_dossier_hash ?? null,
    risk_dossier_text: listing?.risk_dossier_text ?? null,
    risk_dossier_generated_at: listing?.risk_dossier_generated_at ?? null,
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const allowed = await hasComplianceDashboardAccess(user?.id);
  if (!allowed) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const signer = await getSigner(user?.id);
  if (!signer) {
    return NextResponse.json({ error: "Apenas Sócio ADMIN (João, Hamilton ou Robson) ou o Jurídico (Dr. Luis Athaydes) podem assinar o Dossiê de Risco" }, { status: 403 });
  }

  const { id } = await params;
  const db = svc();

  const { data: listing } = await db.from("cm_asset_listings").select("risk_dossier_text, risk_dossier_finalized_at").eq("id", id).single();
  if (!listing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });
  if (listing.risk_dossier_finalized_at) return NextResponse.json({ error: "Dossiê já finalizado" }, { status: 409 });
  if (!listing.risk_dossier_text) {
    return NextResponse.json({ error: "Compile o parecer (\"Compilar Tese & Dossiê\") antes de assinar" }, { status: 422 });
  }

  const { error: insertErr } = await db
    .from("cm_risk_dossier_signoffs")
    .upsert({ listing_id: id, signer_id: signer.userId, signer_name: signer.name, signer_role: signer.role }, { onConflict: "listing_id,signer_id" });
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  const { data: allSignoffs } = await db.from("cm_risk_dossier_signoffs").select("signer_role").eq("listing_id", id);
  const hasSocio = (allSignoffs ?? []).some((s) => s.signer_role === "socio_admin");
  const hasJuridico = (allSignoffs ?? []).some((s) => s.signer_role === "juridico");

  if (hasSocio && hasJuridico) {
    const result = await generateAndStoreComplianceDossierPdf(id);
    if (!result.ok) {
      // Quórum fica registrado mesmo se o PDF falhar -- não perde as assinaturas
      // por um erro de geração, o próximo signoff (idempotente via upsert) ou
      // uma rota de retry futura pode tentar de novo sem repetir a assinatura.
      return NextResponse.json({ ok: true, quorum_closed: true, pdf_error: result.error }, { status: 200 });
    }
    return NextResponse.json({ ok: true, quorum_closed: true, pdf_url: result.pdf_url, hash: result.hash });
  }

  return NextResponse.json({ ok: true, quorum_closed: false });
}
