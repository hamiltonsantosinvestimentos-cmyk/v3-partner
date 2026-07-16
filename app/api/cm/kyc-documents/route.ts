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

/** GET /api/cm/kyc-documents?listing_id=X — painel segregado, documentos retidos ate aprovacao
 *  Mescla dois fluxos que antes ficavam desconectados (bug reportado pela Mesa Operacional 2026-07-15,
 *  "propostas nao aparecem no quadro de KYC"): uploads internos da Mesa (cm_kyc_documents, por listing_id)
 *  + LOI/MOU e Procuracao que o proprio comprador ja enviou no Buy Intake Wizard publico
 *  (investor_demand_documents, ligados por demand_id — sem listing_id proprio, so existe via
 *  demand_matches quando o motor de matchmaking cruzou o mandato de busca com este ativo). */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listing_id");
  if (!listingId) return NextResponse.json({ error: "listing_id obrigatório" }, { status: 422 });

  const db = svc();

  const [internalDocs, matches] = await Promise.all([
    db.from("cm_kyc_documents").select("*").eq("listing_id", listingId).order("created_at", { ascending: false }),
    db.from("demand_matches").select("demand_id, investor_demands(nome_contato)").eq("listing_id", listingId),
  ]);

  if (internalDocs.error) return NextResponse.json({ error: internalDocs.error.message }, { status: 500 });

  const demandIds = [...new Set((matches.data ?? []).map((m) => m.demand_id).filter(Boolean))];
  let buyerDocs: any[] = [];

  if (demandIds.length > 0) {
    const { data: demandDocs } = await db
      .from("investor_demand_documents")
      .select("id, demand_id, document_type, storage_path, original_filename, created_at")
      .in("demand_id", demandIds);

    const nameByDemand = new Map(
      (matches.data ?? []).map((m: any) => [m.demand_id, m.investor_demands?.nome_contato ?? "Comprador"])
    );

    buyerDocs = (demandDocs ?? []).map((d) => ({
      id: d.id,
      listing_id: listingId,
      party_type: "comprador",
      party_name: nameByDemand.get(d.demand_id) ?? "Comprador",
      document_type: d.document_type,
      storage_path: d.storage_path,
      original_filename: d.original_filename,
      status: "enviado_pelo_comprador",
      created_at: d.created_at,
      source: "buyer_intake",
    }));
  }

  const documents = [...(internalDocs.data ?? []).map((d) => ({ ...d, source: "mesa_upload" })), ...buyerDocs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ documents });
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
