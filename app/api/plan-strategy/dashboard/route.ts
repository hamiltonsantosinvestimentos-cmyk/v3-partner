import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { SECTORS, getRealizadoPorMes, getMRRAcumuladoPorMes, type Sector } from "@/lib/sector-goals";
import { CADENCES, periodLabel, type Cadence } from "@/lib/plan-strategy";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];

async function getAuthedAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role ?? "")) return null;
  return user;
}

// GET — cruza metas (realizado x meta, de /projeto) com status de cadência (de /plan-strategy) por vertical, no período corrente
export async function GET() {
  const user = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const db = serviceClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const currentPeriods = Object.fromEntries(CADENCES.map(c => [c, periodLabel(now, c)])) as Record<Cadence, string>;

  const [{ data: goalRows }, { data: checkinRows }, mrrPorMes, realizadoEntries] = await Promise.all([
    db.from("sector_goals").select("sector, month, meta_valor").eq("year", year).in("month", [0, month]),
    db.from("strategic_cadence_checkins").select("sector, cadence, period_label, status")
      .in("cadence", CADENCES as unknown as string[])
      .in("period_label", Object.values(currentPeriods)),
    getMRRAcumuladoPorMes(db, year),
    Promise.all(SECTORS.map(async (s) => [s, await getRealizadoPorMes(db, s, year)] as const)),
  ]);

  const realizadoMap = new Map<Sector, Awaited<ReturnType<typeof getRealizadoPorMes>>>(realizadoEntries);

  const metaBySector = new Map<Sector, { mensal: number; anual: number }>();
  for (const s of SECTORS) metaBySector.set(s, { mensal: 0, anual: 0 });
  for (const row of goalRows ?? []) {
    const entry = metaBySector.get(row.sector as Sector);
    if (!entry) continue;
    if (row.month === 0) entry.anual = row.meta_valor ?? 0;
    else if (row.month === month) entry.mensal = row.meta_valor ?? 0;
  }

  const cadenceBySector: Record<Sector, Record<Cadence, { status: string; period_label: string }>> =
    Object.fromEntries(SECTORS.map(s => [
      s,
      Object.fromEntries(CADENCES.map(c => [c, { status: "PENDENTE", period_label: currentPeriods[c] }])),
    ])) as never;

  for (const row of checkinRows ?? []) {
    const sector = row.sector as Sector;
    const cadence = row.cadence as Cadence;
    if (cadenceBySector[sector]?.[cadence] && row.period_label === currentPeriods[cadence]) {
      cadenceBySector[sector][cadence] = { status: row.status, period_label: row.period_label };
    }
  }

  const sectors = SECTORS.map((s) => {
    const realizadoMes = realizadoMap.get(s)?.[month] ?? { valor: 0, quantidade: 0 };
    const meta = metaBySector.get(s)!;
    return {
      sector: s,
      meta_mensal: meta.mensal,
      realizado_mensal: realizadoMes.valor,
      pct_mensal: meta.mensal > 0 ? Math.round((realizadoMes.valor / meta.mensal) * 100) : 0,
      meta_anual: meta.anual,
      mrr: s === "ASSINATURAS" ? (mrrPorMes[month] ?? 0) : null,
      cadence: cadenceBySector[s],
    };
  });

  return NextResponse.json({ year, month, periods: currentPeriods, sectors });
}
