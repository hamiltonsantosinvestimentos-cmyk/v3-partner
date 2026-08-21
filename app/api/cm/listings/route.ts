import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { issueV3Code, resolveSectorCode } from "@/lib/v3-codes";
import { resolveClient } from "@/lib/v3-clients";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
// Partner originador (originator_profile_id) so ve os proprios ativos -- achado 13/08/2026:
// esta rota nunca liberou leitura pra Partner nenhum, mesmo tabela ja tendo originator_profile_id
// desde 07/07 (espelha ma_deals). Mesmo padrao ja usado em GET /api/cm/investor-demands.
const PARTNER_ROLES = ["PARTNER", "PARTNER_PRO", "STARTER", "ENTERPRISE"];

async function getCallerRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

async function getCallerOrPartner(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile) return null;
  const role = profile.role as string;
  if (ALLOWED_ROLES.includes(role)) return { userId: user.id, role, isPartner: false as const };
  if (PARTNER_ROLES.includes(role)) return { userId: user.id, role, isPartner: true as const };
  return null;
}

export async function GET(req: NextRequest) {
  const caller = await getCallerOrPartner(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const mine = searchParams.get("mine") === "true";

  let query = svc()
    .from("cm_asset_listings")
    .select("*, cm_bids(count), cm_listing_documents(count), originator:originator_profile_id(id, full_name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("listing_status", status);
  // Partner nunca ve o portfolio inteiro, so o que ele mesmo originou -- filtro forcado no
  // servidor, nunca aceito do client (mesmo principio de origin_partner_id em investor_demands).
  if (caller.isPartner) query = query.eq("originator_profile_id", caller.userId);
  else if (mine) query = query.eq("created_by", caller.userId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const listings = data ?? [];
  return NextResponse.json({ listings: await withDaysInStage(listings) });
}

// Etapa 6 (Kanban UX, 21/08/2026): "dias na fase atual" pro badge/micro-timeline do board.
// cm_status_transitions ja existe desde 19/06 (grava toda chamada de
// transition_cm_listing_status()) mas nunca foi lida pela UI. Uma listagem recem-criada
// nunca passou pela funcao de transicao (o INSERT em POST /listings seta listing_status
// direto), entao ela nao tem nenhuma linha em cm_status_transitions ainda -- nesse caso o
// fallback e o created_at da propria listagem. 1 query agregada pro lote inteiro, nunca N+1.
async function withDaysInStage<T extends { id: string; listing_status: string; created_at: string }>(
  listings: T[]
): Promise<(T & { days_in_stage: number })[]> {
  if (listings.length === 0) return [];
  const ids = listings.map((l) => l.id);
  const { data: transitions } = await svc()
    .from("cm_status_transitions")
    .select("listing_id, to_status, created_at")
    .in("listing_id", ids)
    .order("created_at", { ascending: false });

  const enteredAt = new Map<string, string>();
  for (const t of transitions ?? []) {
    const key = `${t.listing_id}:${t.to_status}`;
    if (!enteredAt.has(key)) enteredAt.set(key, t.created_at); // primeira ocorrencia = mais recente (ordenado desc)
  }

  const now = Date.now();
  return listings.map((l) => {
    const since = enteredAt.get(`${l.id}:${l.listing_status}`) ?? l.created_at;
    const days = Math.max(0, Math.floor((now - new Date(since).getTime()) / 86_400_000));
    return { ...l, days_in_stage: days };
  });
}

export async function POST(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    asset_type, seller_name, seller_cpf_cnpj,
    ente_devedor, uf_ente_devedor, municipio_ente_devedor, esfera, tribunal, natureza, numero_processo,
    valor_face, valor_atualizado, desagio_pretendido, prazo_estimado_meses,
    allows_tranching, tranche_valor_minimo, conditional_blocks, metadata, ma_deal_id,
    apelido, originator_profile_id, originator_referral_id, currency,
  } = body;

  if (!asset_type || !seller_name || !valor_face) {
    return NextResponse.json({
      error: "Campos obrigatórios: asset_type, seller_name, valor_face"
    }, { status: 422 });
  }

  const CM_CURRENCIES = ["BRL", "USD", "EUR"];
  if (currency !== undefined && !CM_CURRENCIES.includes(currency)) {
    return NextResponse.json({ error: `Moeda "${currency}" inválida. Use BRL, USD ou EUR.` }, { status: 422 });
  }

  // Filtro compulsorio de portfolio (Mesa Operacional 2026-07-15): CGI/CRI/FIDC nao sao
  // mais aceitos em novos cadastros da Bolsa de Ativos financeira. Valores permanecem no
  // enum do banco (Postgres nao permite DROP VALUE) so por compatibilidade com listagens
  // historicas ja existentes — bloqueio vale so para CRIACAO de listagem nova.
  if (["cgi", "cri", "fidc"].includes(asset_type)) {
    return NextResponse.json({
      error: `Classe de ativo "${asset_type.toUpperCase()}" não é mais aceita para novos cadastros. Use: Precatório, Direito Creditório, IPI, ICMS ou Outros.`
    }, { status: 422 });
  }

  // Governanca de Numeracao V3, Fase 2 (10/08/2026): anonymous_id passa a ser
  // emitido por issueV3Code(), sucedendo generate_cm_anonymous_id() -- exatamente
  // o alvo ja registrado em v3_code_series (BA/PR -> cm_asset_listings.anonymous_id)
  // desde a Fase 1a (05/08). Listagens antigas no formato CM-OT-FED-NNNN /
  // CM-PR-FED-NNNN permanecem intocadas; so listagens novas usam o formato V3.
  const ESFERA_CODE: Record<string, string> = { federal: "FED", estadual: "EST", municipal: "MUN" };
  let anonId: string;
  try {
    if (asset_type === "precatorio") {
      const esferaCode = ESFERA_CODE[(esfera ?? "Federal").toLowerCase()] ?? "FED";
      anonId = await issueV3Code("PR", esferaCode);
    } else {
      // Bolsa de Ativos nao tem campo de setor economico proprio na listagem
      // hoje -- resolveSectorCode(null) cai no fallback GRL, intencional e
      // auditavel (ver comentario da funcao em lib/v3-codes.ts).
      const sectorCode = await resolveSectorCode(null);
      anonId = await issueV3Code("BA", sectorCode);
    }
  } catch (codeErr) {
    const msg = codeErr instanceof Error ? codeErr.message : String(codeErr);
    return NextResponse.json({ error: `Falha ao emitir código da listagem: ${msg}` }, { status: 500 });
  }
  const { data: numeroInterno } = await svc().rpc("generate_cm_numero_interno");

  // Client 360, Fase A (10/08/2026): best-effort, nunca bloqueia a criacao.
  const v3ClientId = await resolveClient(seller_cpf_cnpj, { legalName: seller_name, vertical: "bolsa_de_ativos" }).catch(() => null);

  const { data: listing, error } = await svc()
    .from("cm_asset_listings")
    .insert({
      anonymous_id: anonId,
      apelido: apelido ?? null,
      numero_interno: numeroInterno,
      originator_profile_id: originator_profile_id ?? null,
      originator_referral_id: originator_referral_id ?? null,
      asset_type,
      currency: currency ?? "BRL",
      seller_name,
      seller_cpf_cnpj: seller_cpf_cnpj ?? null,
      v3_client_id: v3ClientId,
      seller_profile_id: null,
      ma_deal_id: ma_deal_id ?? null,
      ente_devedor: ente_devedor ?? null,
      uf_ente_devedor: uf_ente_devedor ?? null,
      municipio_ente_devedor: municipio_ente_devedor ?? null,
      esfera: esfera ?? null,
      tribunal: tribunal ?? null,
      natureza: natureza ?? null,
      numero_processo: numero_processo ?? null,
      valor_face: Number(valor_face),
      valor_atualizado: valor_atualizado ? Number(valor_atualizado) : null,
      desagio_pretendido: desagio_pretendido ? Number(desagio_pretendido) : null,
      prazo_estimado_meses: prazo_estimado_meses ? Number(prazo_estimado_meses) : null,
      allows_tranching: allows_tranching ?? false,
      tranche_valor_minimo: tranche_valor_minimo ? Number(tranche_valor_minimo) : null,
      conditional_blocks: conditional_blocks ?? null,
      metadata: metadata ?? {},
      listing_status: "reuniao_validada",
      meeting_validated_at: new Date().toISOString(),
      created_by: caller.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Governanca Documental Universal, Fase 2 (10/08/2026): pasta publica do
  // cliente em BolsaDeAtivos. Best-effort -- nunca bloqueia a criacao da
  // listagem, mesmo padrao do notificar-por-email em outras rotas do
  // portal: a pasta e um reforco de governanca, nao um requisito de negocio.
  const { error: folderError } = await svc().rpc("create_deal_folder", {
    p_vertical: "BolsaDeAtivos",
    p_deal_code: anonId,
    p_client_name: seller_name,
    p_user_id: caller.userId,
  });
  if (folderError) console.error("[cm/listings POST] falha ao criar pasta MPS", folderError.message);

  return NextResponse.json({ listing }, { status: 201 });
}
