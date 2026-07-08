import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isValidSector, getRealizadoPorMes } from "@/lib/sector-goals";

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

// GET ?sector=X&year=Y — metas mensais (1-12) + meta anual, com realizado calculado a partir dos dados reais
export async function GET(req: NextRequest) {
  const user = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const sector = req.nextUrl.searchParams.get("sector") ?? "";
  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (!isValidSector(sector) || !year) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });

  const db = serviceClient();

  const [{ data: goalRows }, realizadoPorMes] = await Promise.all([
    db.from("sector_goals").select("*").eq("sector", sector).eq("year", year),
    getRealizadoPorMes(db, sector, year),
  ]);

  const goalByMonth = new Map<number, { meta_valor: number; meta_quantidade: number | null }>();
  for (const row of goalRows ?? []) {
    goalByMonth.set(row.month, { meta_valor: row.meta_valor, meta_quantidade: row.meta_quantidade });
  }

  const monthly = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const goal = goalByMonth.get(month);
    const realizado = realizadoPorMes[month] ?? 0;
    const meta_valor = goal?.meta_valor ?? 0;
    return {
      month,
      meta_valor,
      meta_quantidade: goal?.meta_quantidade ?? null,
      realizado,
      pct: meta_valor > 0 ? Math.round((realizado / meta_valor) * 100) : 0,
    };
  });

  const annualGoal = goalByMonth.get(0);
  const realizadoAnual = Object.values(realizadoPorMes).reduce((s, v) => s + v, 0);
  const annualMetaValor = annualGoal?.meta_valor ?? 0;

  return NextResponse.json({
    sector, year,
    monthly,
    annual: {
      meta_valor: annualMetaValor,
      meta_quantidade: annualGoal?.meta_quantidade ?? null,
      realizado: realizadoAnual,
      pct: annualMetaValor > 0 ? Math.round((realizadoAnual / annualMetaValor) * 100) : 0,
    },
  });
}

// PATCH — cria/atualiza uma meta (month=null é a meta anual)
export async function PATCH(req: NextRequest) {
  const user = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { sector, year, month, meta_valor, meta_quantidade } = body as {
    sector: string; year: number; month: number | null; meta_valor: number; meta_quantidade?: number | null;
  };

  // month=null (ou 0) representa a meta ANUAL — armazenada com o sentinela 0
  const monthValue = month ?? 0;
  if (!isValidSector(sector) || !year || meta_valor === undefined) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }
  if (monthValue < 0 || monthValue > 12) {
    return NextResponse.json({ error: "Mês inválido" }, { status: 400 });
  }

  const { error } = await serviceClient().from("sector_goals").upsert({
    sector, year, month: monthValue,
    meta_valor, meta_quantidade: meta_quantidade ?? null,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }, { onConflict: "sector,year,month" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
