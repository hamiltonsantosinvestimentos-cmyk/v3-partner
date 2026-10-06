import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { normalizeDocument, detectDocumentType } from "@/lib/v3-clients";
import { maskCpfCnpj } from "@/lib/qualification-mask";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "no-store" };

// Compliance (05/10/2026, BRIEF de Padronização da Qualificação): o documento do cliente sai
// MASCARADO (CPF: ***.123.456-**; CNPJ é dado público e fica intacto). O valor real só sai de
// POST /api/clientes/[id]/reveal, com log gravado antes. Toda consulta grava log de leitura em
// audit_logs com await, ANTES de devolver o dado (nunca `void ...insert()`).

// GET /api/clientes/[documento] — Registro Central de Cliente (Client 360).
// Devolve tudo que está vinculado a um CPF/CNPJ entre as verticais que já
// têm v3_client_id. Fase 1 (08/08): Crédito, Bolsa de Ativos, Credit Engine,
// Partners. Fase B (11/08): M&A, via ma_deal_clients (papel + ciclo de vida
// por deal). Fase C (11/08): KYC + trajetória de risco por dimensão
// (crédito e compliance nunca fundidos num indicador só — são instrumentos
// diferentes, ver migration 20260811b). Fase D (11/08): contratos, join de
// 2 saltos via deal_id/credit_proposal_id/listing_id (operation_contracts
// não tem v3_client_id direto). CRM/Consórcio ficam fora até terem
// vínculo próprio — nunca inventado aqui a partir de JSONB solto.
export async function GET(req: NextRequest, { params }: { params: Promise<{ documento: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role as string)) {
    return NextResponse.json({ error: "Sem permissão para consultar o Registro Central de Cliente" }, { status: 403 });
  }

  const { documento } = await params;
  const byId = UUID_RE.test(documento);
  const svc = serviceClient();

  let client: { id: string; document_number: string; document_type: string; legal_name: string | null; first_seen_vertical: string | null; first_seen_at: string } | null = null;
  let docType: string | null = null;

  if (byId) {
    // Consulta por id (link da ficha da parte): CPF/CNPJ nunca vai na URL. Mesmo 404 genérico
    // para "não existe" e "sem vínculo", sem confirmar nada sobre o id.
    const { data, error } = await svc
      .from("v3_clients")
      .select("id, document_number, document_type, legal_name, first_seen_vertical, first_seen_at")
      .eq("id", documento)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Erro ao consultar cliente" }, { status: 500, headers: NO_STORE });
    if (!data) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404, headers: NO_STORE });
    client = data;
  } else {
    const digits = normalizeDocument(documento);
    docType = detectDocumentType(digits);
    if (!docType) {
      return NextResponse.json({ error: "Documento inválido, informe um CPF (11 dígitos) ou CNPJ (14 dígitos)" }, { status: 400, headers: NO_STORE });
    }
    const { data, error: clientError } = await svc
      .from("v3_clients")
      .select("id, document_number, document_type, legal_name, first_seen_vertical, first_seen_at")
      .eq("document_number", digits)
      .maybeSingle();
    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500, headers: NO_STORE });
    if (!data) {
      return NextResponse.json({ found: false, document_number: maskCpfCnpj(digits), document_type: docType }, { headers: NO_STORE });
    }
    client = data;
  }

  // Log de leitura ANTES do dado. Falhou, nada sai.
  const { error: logError } = await svc.from("audit_logs").insert({
    user_id: user.id,
    action: "cliente_360_consulta",
    entity: "v3_clients",
    entity_id: client.id,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
  });
  if (logError) {
    console.error("[clientes 360] falha ao gravar log de consulta", { client_id: client.id, code: logError.code });
    return NextResponse.json({ error: "Não foi possível registrar a consulta, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  const [credito, bolsa, creditEngine, partners, maDeals, kyc, trajetoria, sugestoes] = await Promise.all([
    svc.from("credit_desk_proposals")
      .select("id, code, title, client_name, credit_line, requested_value, stage, status, created_at")
      .eq("v3_client_id", client.id).order("created_at", { ascending: false }),
    svc.from("cm_asset_listings")
      .select("id, numero_interno, seller_name, asset_type, valor_face, listing_status, created_at")
      .eq("v3_client_id", client.id).order("created_at", { ascending: false }),
    svc.from("credit_profiles")
      .select("id, tier, score_total, analysis_type, created_at")
      .eq("v3_client_id", client.id).order("created_at", { ascending: false }),
    svc.from("partner_registrations")
      .select("id, nome_completo, plano, status, created_at")
      .eq("v3_client_id", client.id).order("created_at", { ascending: false }),
    svc.from("ma_deal_clients")
      .select("id, role, status, created_at, ma_deals(id, code, title, stage)")
      .eq("v3_client_id", client.id).order("created_at", { ascending: false }),
    svc.from("kyc_analyses")
      .select("id, score, risk_label, verdict, dd_level, created_at")
      .eq("v3_client_id", client.id).order("created_at", { ascending: false }),
    svc.from("v3_client_risk_trajectory")
      .select("dimension, score_atual, classificacao_atual, score_anterior, direcao, created_at")
      .eq("v3_client_id", client.id)
      .order("created_at", { ascending: false }),
    svc.from("v3_client_risk_suggestions")
      .select("id, dimension, suggestion, status, created_at")
      .eq("v3_client_id", client.id)
      .eq("status", "aberta")
      .order("created_at", { ascending: false }),
  ]);

  // Trajetória: só a linha mais recente de cada dimensão (a view devolve o
  // histórico inteiro, o resumo pro card é só o estado atual + direção).
  const trajetoriaPorDimensao: Record<string, unknown> = {};
  for (const row of trajetoria.data ?? []) {
    if (!trajetoriaPorDimensao[row.dimension]) trajetoriaPorDimensao[row.dimension] = row;
  }

  // Fase D: contratos, join de 2 saltos (operation_contracts não tem
  // v3_client_id direto — liga em deal_id/credit_proposal_id/listing_id,
  // que já resolvemos acima). Só consulta se houver pelo menos um id de
  // origem, evita "or=()" vazio malformado.
  const dealIds = (maDeals.data ?? []).map(d => (d.ma_deals as unknown as { id: string } | null)?.id).filter(Boolean);
  const propostaIds = (credito.data ?? []).map(c => c.id);
  const listingIds = (bolsa.data ?? []).map(l => l.id);

  let contratos: { id: string; contract_code: string | null; contract_title: string; vertical: string; status_signature: string; deal_id: string | null; credit_proposal_id: string | null; listing_id: string | null; created_at: string }[] = [];
  if (dealIds.length || propostaIds.length || listingIds.length) {
    const orParts: string[] = [];
    if (dealIds.length) orParts.push(`deal_id.in.(${dealIds.join(",")})`);
    if (propostaIds.length) orParts.push(`credit_proposal_id.in.(${propostaIds.join(",")})`);
    if (listingIds.length) orParts.push(`listing_id.in.(${listingIds.join(",")})`);

    const { data } = await svc
      .from("operation_contracts")
      .select("id, contract_code, contract_title, vertical, status_signature, deal_id, credit_proposal_id, listing_id, created_at")
      .or(orParts.join(","))
      .order("created_at", { ascending: false });
    contratos = data ?? [];
  }

  return NextResponse.json({
    found: true,
    client: { ...client, document_number: maskCpfCnpj(client.document_number) ?? "" },
    credito: credito.data ?? [],
    bolsa_de_ativos: bolsa.data ?? [],
    credit_engine: creditEngine.data ?? [],
    partners: partners.data ?? [],
    ma: maDeals.data ?? [],
    kyc: kyc.data ?? [],
    contratos,
    risco: { trajetoria: trajetoriaPorDimensao, sugestoes: sugestoes.data ?? [] },
  }, { headers: NO_STORE });
}
