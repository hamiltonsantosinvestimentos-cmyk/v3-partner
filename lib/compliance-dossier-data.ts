import { createClient as sc } from "@supabase/supabase-js";

// Dados do Dossiê de Risco (Cockpit de Compliance, Fase 4, 10/09/2026).
// Reaproveita as mesmas fontes já usadas na síntese do Forja Jurídico
// (app/api/cm/forja/compile-thesis) -- OCR + due diligence -- somando a
// Checktudo (Fase 2) e os intermediários qualificados (Fase 3), que o
// Forja Jurídico não tinha quando foi escrito em 21/08/2026.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export interface ComplianceDossierDoc {
  document_type: string;
  original_filename: string | null;
  validation_status: string | null;
  confiabilidade: number | null;
}

export interface ComplianceDossierDDRecord {
  tool: string;
  query_type: string;
  query_value: string;
  totalProcessos: number | null;
  created_at: string;
}

export interface ComplianceDossierChecktudoRecord {
  querycode: number;
  risk_flags: Record<string, unknown>;
  created_at: string;
}

export interface ComplianceDossierIntermediary {
  full_name: string;
  role_in_document: string;
  cpf_cnpj: string | null;
  checked: boolean;
}

export interface ComplianceDossierSignoff {
  signer_name: string;
  signer_role: "socio_admin" | "juridico";
  signed_at: string;
}

export interface ComplianceDossierData {
  listingId: string;
  anonymousId: string;
  assetType: string;
  sellerName: string;
  sellerCpfCnpj: string | null;
  enteDevedor: string | null;
  valorFace: number | null;
  riskScore: number | null;
  listingStatus: string;
  emittedAt: string;
  code: string; // protocolo do dossiê, reaproveita anonymous_id como referência
  docs: ComplianceDossierDoc[];
  ddRecords: ComplianceDossierDDRecord[];
  checktudoRecords: ComplianceDossierChecktudoRecord[];
  intermediaries: ComplianceDossierIntermediary[];
  riskDossierText: string | null;
  riskDossierGeneratedAt: string | null;
  signoffs: ComplianceDossierSignoff[];
}

const INTERMEDIARY_ROLES = ["mandatario", "intermediario_finder_venda", "intermediario_finder_compra"];

export async function buildComplianceDossierData(listingId: string): Promise<ComplianceDossierData | null> {
  const db = svc();

  const { data: listing } = await db
    .from("cm_asset_listings")
    .select("id, anonymous_id, asset_type, seller_name, seller_cpf_cnpj, ente_devedor, valor_face, risk_score, listing_status, risk_dossier_text, risk_dossier_generated_at")
    .eq("id", listingId)
    .single();

  if (!listing) return null;

  const [{ data: docsRaw }, { data: ddRaw }, { data: checktudoRaw }, { data: batches }, { data: signoffsRaw }] = await Promise.all([
    db.from("cm_listing_documents")
      .select("document_type, ocr_result, validation_status, original_filename")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false })
      .limit(15),
    db.from("cm_due_diligence_records")
      .select("tool, query_type, query_value, result, created_at")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false })
      .limit(10),
    db.from("cm_compliance_checktudo_records")
      .select("querycode, risk_flags, created_at")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false })
      .limit(10),
    db.from("cm_qualification_batches")
      .select("id, cm_party_qualifications(full_name, role_in_document, cpf_cnpj)")
      .eq("listing_id", listingId),
    db.from("cm_risk_dossier_signoffs")
      .select("signer_name, signer_role, signed_at")
      .eq("listing_id", listingId),
  ]);

  const ddDocs = new Set(
    ((ddRaw ?? []) as { query_value: string }[]).map((r) => r.query_value.replace(/\D/g, ""))
  );

  const parties = (batches ?? []).flatMap((b: any) => b.cm_party_qualifications ?? []);
  const intermediaries: ComplianceDossierIntermediary[] = parties
    .filter((p: any) => INTERMEDIARY_ROLES.includes(p.role_in_document))
    .map((p: any) => ({
      full_name: p.full_name,
      role_in_document: p.role_in_document,
      cpf_cnpj: p.cpf_cnpj ?? null,
      checked: p.cpf_cnpj ? ddDocs.has(String(p.cpf_cnpj).replace(/\D/g, "")) : false,
    }));

  const docs: ComplianceDossierDoc[] = ((docsRaw ?? []) as any[]).map((d) => {
    const ocr = d.ocr_result as Record<string, unknown> | null;
    const confiabilidade = ocr && typeof ocr === "object" && typeof ocr.confiabilidade === "number" ? ocr.confiabilidade : null;
    return {
      document_type: d.document_type,
      original_filename: d.original_filename,
      validation_status: d.validation_status,
      confiabilidade,
    };
  });

  const ddRecords: ComplianceDossierDDRecord[] = ((ddRaw ?? []) as any[]).map((r) => ({
    tool: r.tool,
    query_type: r.query_type,
    query_value: r.query_value,
    totalProcessos: (r.result as any)?.total_processos ?? null,
    created_at: r.created_at,
  }));

  const checktudoRecords: ComplianceDossierChecktudoRecord[] = ((checktudoRaw ?? []) as any[]).map((r) => ({
    querycode: r.querycode,
    risk_flags: r.risk_flags ?? {},
    created_at: r.created_at,
  }));

  return {
    listingId: listing.id,
    anonymousId: listing.anonymous_id,
    assetType: listing.asset_type,
    sellerName: listing.seller_name,
    sellerCpfCnpj: listing.seller_cpf_cnpj,
    enteDevedor: listing.ente_devedor,
    valorFace: listing.valor_face,
    riskScore: listing.risk_score,
    listingStatus: listing.listing_status,
    emittedAt: new Date().toLocaleDateString("pt-BR"),
    code: `${listing.anonymous_id}-DOSSIE`,
    docs,
    ddRecords,
    checktudoRecords,
    intermediaries,
    riskDossierText: listing.risk_dossier_text,
    riskDossierGeneratedAt: listing.risk_dossier_generated_at,
    signoffs: (signoffsRaw ?? []) as ComplianceDossierSignoff[],
  };
}
