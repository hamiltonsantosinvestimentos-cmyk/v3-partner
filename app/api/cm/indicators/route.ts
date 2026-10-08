import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import {
  buildFunnel, buildReasons, buildStageTimes, formatDateBr, formatDateTimeBr, periodStart,
  type Entity, type Transition,
} from "@/lib/cm-indicators";

// Indicadores e gargalos da Bolsa de Ativos (Bloco 4, 08/10/2026), SOMENTE LEITURA.
// BRIEF: scratchpad brief-bloco4-indicadores.md (REVISAO v2). A resposta tem apenas contagens,
// medianas e rotulos de etapa e de categoria: nunca id, apelido, codigo anonimo, nome ou documento
// de ativo, comprador ou parte. Acesso: papeis da Mesa, checado no servidor (403 para os demais).

export const maxDuration = 30;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const NO_STORE = { "Cache-Control": "no-store" };
const MESA_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const PERIODS: Record<string, number | null> = { "30": 30, "90": 90, "180": 180, tudo: null };
const PERIOD_LABELS: Record<string, string> = { "30": "Últimos 30 dias", "90": "Últimos 90 dias", "180": "Últimos 180 dias", tudo: "Todo o histórico" };
const PAGE = 1000;

type TransitionRow = { listing_id: string | null; demand_id: string | null; to_status: string; created_at: string; reason_category: string | null };

async function fetchAllTransitions(db: ReturnType<typeof svc>): Promise<TransitionRow[]> {
  const out: TransitionRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("cm_status_transitions")
      .select("listing_id, demand_id, to_status, created_at, reason_category")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error("transitions");
    out.push(...((data ?? []) as TransitionRow[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });
  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!MESA_ROLES.includes(profile?.role as string)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403, headers: NO_STORE });
  }

  const periodKey = req.nextUrl.searchParams.get("period") ?? "90";
  if (!(periodKey in PERIODS)) return NextResponse.json({ error: "Período inválido" }, { status: 422, headers: NO_STORE });
  const now = new Date();
  const start = periodStart(PERIODS[periodKey], now);

  try {
    const [listingsRes, demandsRes, allTransitions] = await Promise.all([
      db.from("cm_asset_listings").select("id, listing_status, created_at, updated_at").is("deleted_at", null),
      db.from("investor_demands").select("id, status, created_at, updated_at"),
      fetchAllTransitions(db),
    ]);
    if (listingsRes.error || demandsRes.error) throw new Error("entities");

    const toEntity = (r: { id: string; created_at: string | null; updated_at: string | null }, status: string): Entity => ({
      id: r.id, status,
      createdAt: r.created_at ? new Date(r.created_at) : null,
      updatedAt: r.updated_at ? new Date(r.updated_at) : null,
    });
    const listings = (listingsRes.data ?? []).map((r) => toEntity(r, r.listing_status as string));
    const demands = (demandsRes.data ?? []).map((r) => toEntity(r, r.status as string));

    // Ultima transicao para o status ATUAL de cada entidade (retrato do funil nao depende do periodo).
    const statusById = new Map<string, string>([...listings, ...demands].map((e) => [e.id, e.status]));
    const lastToCurrent = new Map<string, Date>();
    for (const t of allTransitions) {
      const id = t.listing_id ?? t.demand_id;
      if (!id) continue;
      const current = statusById.get(id);
      if (current && (t.to_status === current)) lastToCurrent.set(id, new Date(t.created_at)); // ordenado por data: a ultima vence
    }

    // Blocos 3 e 4 respeitam o periodo.
    const inPeriod = allTransitions.filter((t) => !start || new Date(t.created_at) >= start);
    const asTransition = (t: TransitionRow): Transition => ({
      entityId: (t.listing_id ?? t.demand_id) as string,
      toStatus: t.to_status,
      createdAt: new Date(t.created_at),
      reasonCategory: t.reason_category,
    });
    const saleTransitions = inPeriod.filter((t) => t.listing_id).map(asTransition);
    const buyTransitions = inPeriod.filter((t) => t.demand_id && !t.listing_id).map(asTransition);
    const refusals = inPeriod.filter((t) => t.to_status === "reprovado");

    const oldest = inPeriod.length > 0 ? new Date(inPeriod[0].created_at) : null;

    return NextResponse.json({
      generated_at_br: formatDateTimeBr(now),
      period: { key: periodKey, label: PERIOD_LABELS[periodKey] },
      venda: buildFunnel("venda", listings, new Map([...lastToCurrent].filter(([id]) => listings.some((l) => l.id === id))), now),
      compra: buildFunnel("compra", demands, new Map([...lastToCurrent].filter(([id]) => demands.some((d) => d.id === id))), now),
      tempo_mediano: { venda: buildStageTimes("venda", saleTransitions), compra: buildStageTimes("compra", buyTransitions) },
      motivos: buildReasons(refusals.map((t) => t.reason_category)),
      total_recusas: refusals.length,
      oldest_transition_br: oldest ? formatDateBr(oldest) : null,
    }, { headers: NO_STORE });
  } catch (e) {
    console.error("[indicators] falha ao montar indicadores", (e as Error).message);
    return NextResponse.json({ error: "Não foi possível carregar os indicadores agora" }, { status: 500, headers: NO_STORE });
  }
}
