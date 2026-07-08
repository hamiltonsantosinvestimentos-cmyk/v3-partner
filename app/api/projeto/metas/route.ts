import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isValidSector, getRealizadoPorMes, getMRRAcumuladoPorMes } from "@/lib/sector-goals";

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
  const isAssinaturas = sector === "ASSINATURAS";

  const [{ data: goalRows }, realizadoPorMes, mrrPorMes] = await Promise.all([
    db.from("sector_goals").select("*").eq("sector", sector).eq("year", year),
    getRealizadoPorMes(db, sector, year),
    isAssinaturas ? getMRRAcumuladoPorMes(db, year) : Promise.resolve(null),
  ]);

  const goalByMonth = new Map<number, {
    meta_valor: number; meta_quantidade: number | null; comissao_percent: number | null;
    custo_sdr_percent: number | null; custo_closer_percent: number | null;
  }>();
  for (const row of goalRows ?? []) {
    goalByMonth.set(row.month, {
      meta_valor: row.meta_valor, meta_quantidade: row.meta_quantidade, comissao_percent: row.comissao_percent,
      custo_sdr_percent: row.custo_sdr_percent, custo_closer_percent: row.custo_closer_percent,
    });
  }

  const annualGoal = goalByMonth.get(0);
  // % definidos na linha anual valem pra todos os meses do ano
  const comissaoPercent = annualGoal?.comissao_percent ?? 0;
  const custoSdrPercent = annualGoal?.custo_sdr_percent ?? 0;
  const custoCloserPercent = annualGoal?.custo_closer_percent ?? 0;

  const monthly = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const goal = goalByMonth.get(month);
    const realizadoMes = realizadoPorMes[month] ?? { valor: 0, quantidade: 0 };
    const meta_valor = goal?.meta_valor ?? 0;
    const meta_quantidade = goal?.meta_quantidade ?? null;
    // Custo de comissão SDR/Closer incide sobre a venda nova gerada no mês (não sobre o MRR acumulado)
    const custoSdr = realizadoMes.valor * (custoSdrPercent / 100);
    const custoCloser = realizadoMes.valor * (custoCloserPercent / 100);
    return {
      month,
      meta_valor,
      meta_quantidade,
      realizado: realizadoMes.valor,
      realizado_quantidade: realizadoMes.quantidade,
      pct: meta_valor > 0 ? Math.round((realizadoMes.valor / meta_valor) * 100) : 0,
      pct_quantidade: meta_quantidade ? Math.round((realizadoMes.quantidade / meta_quantidade) * 100) : 0,
      comissao: meta_valor * (comissaoPercent / 100),
      ...(isAssinaturas ? {
        mrr: mrrPorMes?.[month] ?? 0,
        custo_sdr: custoSdr,
        custo_closer: custoCloser,
        lucro_liquido: realizadoMes.valor - custoSdr - custoCloser,
      } : {}),
    };
  });

  const realizadoAnual = monthly.reduce((s, m) => s + m.realizado, 0);
  const realizadoQuantidadeAnual = monthly.reduce((s, m) => s + m.realizado_quantidade, 0);
  const annualMetaValor = annualGoal?.meta_valor ?? 0;
  const annualMetaQuantidade = annualGoal?.meta_quantidade ?? null;
  const comissaoAnual = monthly.reduce((s, m) => s + m.comissao, 0);

  return NextResponse.json({
    sector, year,
    comissao_percent: comissaoPercent,
    ...(isAssinaturas ? { custo_sdr_percent: custoSdrPercent, custo_closer_percent: custoCloserPercent } : {}),
    monthly,
    annual: {
      meta_valor: annualMetaValor,
      meta_quantidade: annualMetaQuantidade,
      realizado: realizadoAnual,
      realizado_quantidade: realizadoQuantidadeAnual,
      pct: annualMetaValor > 0 ? Math.round((realizadoAnual / annualMetaValor) * 100) : 0,
      pct_quantidade: annualMetaQuantidade ? Math.round((realizadoQuantidadeAnual / annualMetaQuantidade) * 100) : 0,
      comissao: comissaoAnual,
      ...(isAssinaturas ? {
        mrr_final: mrrPorMes?.[12] ?? 0,
        custo_sdr: monthly.reduce((s, m) => s + (m.custo_sdr ?? 0), 0),
        custo_closer: monthly.reduce((s, m) => s + (m.custo_closer ?? 0), 0),
        lucro_liquido: monthly.reduce((s, m) => s + (m.lucro_liquido ?? 0), 0),
      } : {}),
    },
  });
}

// PATCH — cria/atualiza uma meta (month=null é a meta anual)
export async function PATCH(req: NextRequest) {
  const user = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { sector, year, month, meta_valor, meta_quantidade, comissao_percent, custo_sdr_percent, custo_closer_percent } = body as {
    sector: string; year: number; month: number | null; meta_valor: number; meta_quantidade?: number | null;
    comissao_percent?: number | null; custo_sdr_percent?: number | null; custo_closer_percent?: number | null;
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
    // % só são relevantes/aplicados na linha anual (month=0)
    ...(monthValue === 0 ? {
      comissao_percent: comissao_percent ?? null,
      custo_sdr_percent: custo_sdr_percent ?? null,
      custo_closer_percent: custo_closer_percent ?? null,
    } : {}),
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }, { onConflict: "sector,year,month" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
