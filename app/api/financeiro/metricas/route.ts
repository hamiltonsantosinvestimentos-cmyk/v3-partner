import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const PRECO_PARTNER = 197;
const PRECO_PRO = 397;

/** GET /api/financeiro/metricas — MRR, ARR, Churn, Conversão, Crescimento */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: me } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "FINANCEIRO"].includes((me as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const db = svc();

  // Todos os partners (PARTNER + PARTNER_PRO)
  const { data: allPartners } = await db
    .from("profiles")
    .select("id, role, is_active, trial_expires_at, created_at")
    .in("role", ["PARTNER", "PARTNER_PRO"])
    .order("created_at", { ascending: true });

  const partners = allPartners ?? [];
  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();

  // Helpers de data
  const inicioMesAtual = new Date(anoAtual, mesAtual - 1, 1);
  const inicioMesAnterior = new Date(anoAtual, mesAtual - 2, 1);
  const fimMesAnterior = new Date(anoAtual, mesAtual - 1, 0);

  // Partners ativos agora
  const ativos = partners.filter(p => {
    if (!p.is_active) return false;
    if (!p.trial_expires_at) return true;
    return new Date(p.trial_expires_at) >= now;
  });

  const ativosPartner = ativos.filter(p => p.role === "PARTNER").length;
  const ativosPro = ativos.filter(p => p.role === "PARTNER_PRO").length;

  // MRR atual
  const mrr = ativosPartner * PRECO_PARTNER + ativosPro * PRECO_PRO;
  const arr = mrr * 12;

  // Partners novos este mês (criados em mesAtual/anoAtual)
  const novosEsteMes = partners.filter(p => {
    const d = new Date(p.created_at);
    return d >= inicioMesAtual;
  }).length;

  // Partners existentes no início do mês (para calcular churn)
  const ativosInicioMes = partners.filter(p => {
    const criado = new Date(p.created_at);
    if (criado >= inicioMesAtual) return false; // não existia no início do mês
    // estava ativo no início do mês = is_active E trial_expires_at >= início do mês
    if (!p.is_active) return false;
    if (!p.trial_expires_at) return true;
    return new Date(p.trial_expires_at) >= inicioMesAtual;
  }).length;

  // Cancelados/expirados este mês
  const canceladosEsteMes = partners.filter(p => {
    const criado = new Date(p.created_at);
    if (criado >= inicioMesAtual) return false;
    const expirou = p.trial_expires_at ? new Date(p.trial_expires_at) : null;
    if (!p.is_active) return true; // suspenso
    if (expirou && expirou >= inicioMesAtual && expirou < now) return true; // expirou neste mês
    return false;
  }).length;

  const churnRate = ativosInicioMes > 0
    ? Math.round((canceladosEsteMes / ativosInicioMes) * 100 * 10) / 10
    : 0;

  // MRR mês anterior (para crescimento MoM)
  const ativosMesAnterior = partners.filter(p => {
    const criado = new Date(p.created_at);
    if (criado > fimMesAnterior) return false;
    if (!p.is_active) return false;
    if (!p.trial_expires_at) return true;
    return new Date(p.trial_expires_at) >= inicioMesAnterior;
  });

  const mrrMesAnterior =
    ativosMesAnterior.filter(p => p.role === "PARTNER").length * PRECO_PARTNER +
    ativosMesAnterior.filter(p => p.role === "PARTNER_PRO").length * PRECO_PRO;

  const crescimentoMoM = mrrMesAnterior > 0
    ? Math.round(((mrr - mrrMesAnterior) / mrrMesAnterior) * 100 * 10) / 10
    : 0;

  // Série histórica mensal (últimos 6 meses) para gráfico — calculada uma vez sobre o array já carregado
  const serie: Array<{ mes: string; mrr: number; partners: number; novos: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anoAtual, mesAtual - 1 - i, 1);
    const fim = new Date(anoAtual, mesAtual - 1 - i + 1, 0, 23, 59, 59);
    const nomeMes = d.toLocaleString("pt-BR", { month: "short" });
    const dTime = d.getTime();
    const fimTime = fim.getTime();
    let countPartner = 0, countPro = 0, novosNoMes = 0;
    for (const p of partners) {
      const criadoTime = new Date(p.created_at).getTime();
      if (criadoTime >= dTime && criadoTime <= fimTime) novosNoMes++;
      if (criadoTime > fimTime) continue;
      if (!p.is_active && i > 0) continue;
      const expTime = p.trial_expires_at ? new Date(p.trial_expires_at).getTime() : Infinity;
      if (expTime < dTime) continue;
      if (p.role === "PARTNER") countPartner++;
      else if (p.role === "PARTNER_PRO") countPro++;
    }
    serie.push({
      mes: nomeMes,
      mrr: countPartner * PRECO_PARTNER + countPro * PRECO_PRO,
      partners: countPartner + countPro,
      novos: novosNoMes,
    });
  }

  // Receita real registrada (financeiro_records)
  let receitaRegistrada = 0;
  let pagamentosHistorico: Array<{ mes: string; valor: number }> = [];
  try {
    const { data: records } = await db
      .from("financeiro_records")
      .select("data, created_at")
      .eq("type", "ASSINATURA_PAGAMENTO")
      .order("created_at", { ascending: false })
      .limit(200);

    receitaRegistrada = (records ?? []).reduce((s: number, r: { data: { valor?: number } }) => {
      return s + (r.data?.valor ?? 0);
    }, 0);

    // Agrupa por mês/ano para o gráfico de receita real
    const porMes: Record<string, number> = {};
    for (const r of records ?? []) {
      const d = new Date(r.created_at);
      const key = `${d.toLocaleString("pt-BR", { month: "short" })}/${d.getFullYear().toString().slice(2)}`;
      porMes[key] = (porMes[key] ?? 0) + ((r.data as { valor?: number })?.valor ?? 0);
    }
    pagamentosHistorico = Object.entries(porMes)
      .slice(0, 6)
      .map(([mes, valor]) => ({ mes, valor }))
      .reverse();
  } catch { /* financeiro_records pode não existir */ }

  // LTV estimado (MRR médio × meses de vida estimado)
  const ticketMedioMensal = ativos.length > 0 ? mrr / ativos.length : 0;
  const ltv = ticketMedioMensal * (churnRate > 0 ? (1 / (churnRate / 100)) : 12);

  return NextResponse.json({
    // KPIs
    mrr,
    arr,
    churnRate,
    crescimentoMoM,
    novosEsteMes,
    totalAtivos: ativos.length,
    ativosPartner,
    ativosPro,
    totalPartners: partners.length,
    ticketMedioMensal: Math.round(ticketMedioMensal * 100) / 100,
    ltv: Math.round(ltv),
    receitaRegistrada,
    // Série histórica
    serie,
    pagamentosHistorico,
  });
}
