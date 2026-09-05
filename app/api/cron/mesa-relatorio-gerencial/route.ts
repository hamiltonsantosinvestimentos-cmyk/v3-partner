import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";
import Anthropic from "@anthropic-ai/sdk";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// BRIEF aprovado por João em 05/09/2026 (2026-09-05_Operacional_BRIEF-
// Relatorio-Gerencial-Mesa-MA-Bolsa-Ativos_v1.html), "Go". Reaproveita o
// mesmo padrão de cron já em produção 3x (weekly-digest, monthly-report,
// cm-sla-alert): Bearer CRON_SECRET, chamado por workflow n8n thin-trigger.
// Rota nova e independente (não expande weekly-digest/monthly-report, que
// são digest PESSOAL de Partner, público diferente deste relatório
// GERENCIAL interno da Mesa, ver achado do BRIEF).

const MA_STAGE_LABELS: Record<string, string> = {
  PROSPECTING: "Prospecção",
  QUALIFICATION: "Qualificação",
  IOI: "Análise de Viabilidade",
  PROPOSAL: "Estruturação da Oferta",
  NEGOTIATION: "Negociação",
  DUE_DILIGENCE: "Due Diligence",
  CLOSING: "Aprovação Final e Fechamento",
  CLOSED_WON: "Fechado (Ganho)",
  CLOSED_LOST: "Fechado (Perdido)",
};
const MA_OPEN_STAGES = ["PROSPECTING", "QUALIFICATION", "IOI", "PROPOSAL", "NEGOTIATION", "DUE_DILIGENCE", "CLOSING"];

const LISTING_STATUS_LABELS: Record<string, string> = {
  reuniao_validada: "Reunião Validada",
  formulario_preenchido: "Formulário Preenchido",
  nda_assinado: "NDA Assinado",
  em_analise: "Em Análise",
  aprovado_head: "Aprovado pelo Head",
  ativo_vitrine: "Ativo na Vitrine",
  proposta_recebida: "Proposta Recebida",
  em_escrow_due_diligence: "Escrow / Due Diligence",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

const QUALIFICATION_STUCK_DAYS = 5;
const CONTRACT_SLA_HOURS = 48;
const LISTING_NO_BID_DAYS = 15;
const MA_DEAL_STUCK_DAYS = 15;

const JURIDICO_EMAIL = "luis.athaydes@v3partners.com.br";
// generated_reports.user_id é NOT NULL (relatório sempre precisa de um
// "dono"). Relatório gerado pelo cron, sem usuário humano por trás do
// clique — usa o perfil de João (ADMIN, sócio fundador) como dono
// sistêmico, mesmo padrão de fallback já usado em outros pontos do
// sistema quando uma ação automática precisa de um profile_id real.
const SYSTEM_OWNER_ID = "d0af8eaa-9f3c-4e7a-b8c6-613736524317";

type PeriodBounds = { label: string; start: Date; end: Date };

function resolvePeriod(period: string): PeriodBounds | null {
  const now = new Date();
  if (period === "semanal") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      label: `Semanal, ${start.toLocaleDateString("pt-BR")} a ${now.toLocaleDateString("pt-BR")}`,
      start,
      end: now,
    };
  }
  if (period === "mensal") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return {
      label: `Mensal, ${start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
      start,
      end,
    };
  }
  return null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / 86_400_000);
}

function fmtDays(n: number): string {
  return n.toFixed(1).replace(".0", "");
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const period = new URL(req.url).searchParams.get("period") ?? "";
  const bounds = resolvePeriod(period);
  if (!bounds) {
    return NextResponse.json({ error: "period obrigatório, use 'semanal' ou 'mensal'" }, { status: 422 });
  }

  const db = svc();
  const now = new Date();

  // ── MESA M&A ────────────────────────────────────────────────────────────
  const { data: allDeals } = await db
    .from("ma_deals")
    .select("id, code, target_company, stage, assigned_to, created_at")
    .is("deleted_at", null);

  const deals = allDeals ?? [];
  const openDeals = deals.filter((d: any) => MA_OPEN_STAGES.includes(d.stage));

  const stageCounts: Record<string, number> = {};
  for (const d of deals) stageCounts[d.stage] = (stageCounts[d.stage] ?? 0) + 1;

  const createdInPeriod = deals.filter((d: any) => {
    const t = new Date(d.created_at);
    return t >= bounds.start && t <= bounds.end;
  }).length;

  const { data: historyInPeriod } = await db
    .from("ma_deal_history")
    .select("deal_id, from_stage, to_stage, created_at")
    .gte("created_at", bounds.start.toISOString())
    .lte("created_at", bounds.end.toISOString());

  const closedWonInPeriod = (historyInPeriod ?? []).filter((h: any) => h.to_stage === "CLOSED_WON").length;
  const closedLostInPeriod = (historyInPeriod ?? []).filter((h: any) => h.to_stage === "CLOSED_LOST").length;

  // Tempo real em cada fase: para todo deal com histórico, cada transição
  // dura até a próxima transição do mesmo deal (ou até agora, se ainda não
  // mudou de fase depois dela). Deals sem nenhum histórico contam o tempo
  // inteiro desde a criação na fase atual (intervalo aberto).
  const { data: allHistory } = await db
    .from("ma_deal_history")
    .select("deal_id, from_stage, to_stage, created_at")
    .order("deal_id", { ascending: true })
    .order("created_at", { ascending: true });

  const historyByDeal = new Map<string, { to_stage: string; created_at: string }[]>();
  for (const h of allHistory ?? []) {
    const arr = historyByDeal.get(h.deal_id) ?? [];
    arr.push({ to_stage: h.to_stage, created_at: h.created_at });
    historyByDeal.set(h.deal_id, arr);
  }

  const stageDurationsDays: Record<string, number[]> = {};
  const lastChangeByDeal = new Map<string, Date>();
  for (const deal of deals) {
    const hist = historyByDeal.get(deal.id) ?? [];
    let cursor = new Date(deal.created_at);
    for (let i = 0; i < hist.length; i++) {
      const entry = hist[i];
      const entryTime = new Date(entry.created_at);
      const nextTime = hist[i + 1] ? new Date(hist[i + 1].created_at) : now;
      const stageDuringInterval = i === 0 ? deal.stage /* aproximação: fase antes da 1a transição não é rastreada, ignorado abaixo */ : hist[i - 1].to_stage;
      if (i > 0) {
        (stageDurationsDays[stageDuringInterval] ??= []).push(daysBetween(entryTime, nextTime));
      }
      cursor = entryTime;
    }
    if (hist.length > 0) {
      const lastEntry = hist[hist.length - 1];
      (stageDurationsDays[lastEntry.to_stage] ??= []).push(daysBetween(new Date(lastEntry.created_at), now));
      lastChangeByDeal.set(deal.id, new Date(lastEntry.created_at));
    } else {
      (stageDurationsDays[deal.stage] ??= []).push(daysBetween(cursor, now));
      lastChangeByDeal.set(deal.id, new Date(deal.created_at));
    }
  }

  const avgDaysPerStage: Record<string, number> = {};
  for (const [stage, durations] of Object.entries(stageDurationsDays)) {
    avgDaysPerStage[stage] = durations.reduce((s, d) => s + d, 0) / durations.length;
  }

  const stuckDeals = openDeals
    .map((d: any) => ({
      ...d,
      diasParado: daysBetween(lastChangeByDeal.get(d.id) ?? new Date(d.created_at), now),
    }))
    .filter((d: any) => d.diasParado >= MA_DEAL_STUCK_DAYS)
    .sort((a: any, b: any) => b.diasParado - a.diasParado)
    .slice(0, 5);

  const loadByAssignee: Record<string, number> = {};
  for (const d of openDeals) {
    const key = d.assigned_to ?? "sem_responsavel";
    loadByAssignee[key] = (loadByAssignee[key] ?? 0) + 1;
  }
  const assigneeIds = Object.keys(loadByAssignee).filter((k) => k !== "sem_responsavel");
  const { data: assigneeProfiles } = assigneeIds.length
    ? await db.from("profiles").select("id, full_name").in("id", assigneeIds)
    : { data: [] as any[] };
  const assigneeNames = new Map((assigneeProfiles ?? []).map((p: any) => [p.id, p.full_name]));

  // ── BOLSA DE ATIVOS ──────────────────────────────────────────────────────
  const { data: allListings } = await db
    .from("cm_asset_listings")
    .select("id, anonymous_id, listing_status, created_at")
    .is("deleted_at", null);

  const listings = allListings ?? [];
  const listingStatusCounts: Record<string, number> = {};
  for (const l of listings) listingStatusCounts[l.listing_status] = (listingStatusCounts[l.listing_status] ?? 0) + 1;

  const { data: stuckBatches } = await db
    .from("cm_qualification_batches")
    .select("id, listing_id, operation_contract_id, document_type, status, created_at")
    .in("status", ["coletando", "aguardando_triagem_governanca"])
    .lt("created_at", new Date(now.getTime() - QUALIFICATION_STUCK_DAYS * 86_400_000).toISOString());

  const { data: pendingContracts } = await db
    .from("operation_contracts")
    .select("id, contract_title, listing_id, sent_to_signature_at, updated_at, cm_asset_listings(anonymous_id)")
    .eq("vertical", "capital_markets")
    .not("status_signature", "in", "(assinado,cancelado,rascunho)");

  const contractsSlaEstourado = (pendingContracts ?? [])
    .map((c: any) => {
      const baseTime = c.sent_to_signature_at ?? c.updated_at;
      const hours = Math.floor((now.getTime() - new Date(baseTime).getTime()) / 3_600_000);
      return { ...c, hours };
    })
    .filter((c: any) => c.hours >= CONTRACT_SLA_HOURS);

  const vitrineListings = listings.filter(
    (l: any) => l.listing_status === "ativo_vitrine" && new Date(l.created_at) < new Date(now.getTime() - LISTING_NO_BID_DAYS * 86_400_000)
  );
  let listingsSemOferta: any[] = [];
  if (vitrineListings.length > 0) {
    const { data: bids } = await db
      .from("cm_bids")
      .select("listing_id")
      .in("listing_id", vitrineListings.map((l: any) => l.id));
    const listingsComOferta = new Set((bids ?? []).map((b: any) => b.listing_id));
    listingsSemOferta = vitrineListings
      .filter((l: any) => !listingsComOferta.has(l.id))
      .map((l: any) => ({ ...l, diasParado: daysBetween(new Date(l.created_at), now) }));
  }

  // ── GARGALOS CONSOLIDADOS ────────────────────────────────────────────────
  type Gargalo = { origem: string; item: string; diasParado: number; detalhe: string };
  const gargalos: Gargalo[] = [
    ...stuckDeals.map((d: any) => ({
      origem: "Mesa M&A",
      item: `${d.code} · ${d.target_company}`,
      diasParado: d.diasParado,
      detalhe: `Parado em "${MA_STAGE_LABELS[d.stage] ?? d.stage}" desde a última mudança de fase`,
    })),
    ...(stuckBatches ?? []).map((b: any) => ({
      origem: "Bolsa de Ativos",
      item: `Qualificação ${b.document_type ?? b.id}`,
      diasParado: daysBetween(new Date(b.created_at), now),
      detalhe: `Lote de qualificação parado em "${b.status}" (desde a criação do lote)`,
    })),
    ...contractsSlaEstourado.map((c: any) => ({
      origem: "Bolsa de Ativos",
      item: `${c.cm_asset_listings?.anonymous_id ?? c.contract_title}`,
      diasParado: c.hours / 24,
      detalhe: `Contrato pendente de assinatura há ${c.hours}h (SLA ${CONTRACT_SLA_HOURS}h)`,
    })),
    ...listingsSemOferta.map((l: any) => ({
      origem: "Bolsa de Ativos",
      item: l.anonymous_id,
      diasParado: l.diasParado,
      detalhe: "Na Vitrine sem nenhuma oferta recebida (desde a última atualização do ativo)",
    })),
  ].sort((a, b) => b.diasParado - a.diasParado);

  // ── RESUMO EXECUTIVO POR IA (best-effort, nunca inventa número) ─────────
  let aiSummary = "";
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const contextoNumeros = `
Período: ${bounds.label}
Mesa M&A: ${deals.length} deals ativos no total (${openDeals.length} em aberto), ${createdInPeriod} criados no período, ${closedWonInPeriod} fechados ganhos e ${closedLostInPeriod} fechados perdidos no período, ${stuckDeals.length} deals parados há mais de ${MA_DEAL_STUCK_DAYS} dias na mesma fase.
Bolsa de Ativos: ${listings.length} ativos cadastrados, ${(stuckBatches ?? []).length} lotes de qualificação parados há mais de ${QUALIFICATION_STUCK_DAYS} dias, ${contractsSlaEstourado.length} contratos com SLA de assinatura estourado, ${listingsSemOferta.length} ativos na Vitrine sem oferta há mais de ${LISTING_NO_BID_DAYS} dias.
Total de gargalos identificados: ${gargalos.length}.`.trim();

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      messages: [{
        role: "user",
        content: `Você é analista de operações da V3 Partners. Escreva um resumo executivo CURTO (máximo 5 frases) para a diretoria, em português, interpretando SOMENTE os números abaixo, sem inventar nenhum dado novo. Foque em apontar o gargalo mais crítico e uma recomendação objetiva. Sem markdown pesado, texto corrido.\n\n${contextoNumeros}`,
      }],
    });
    aiSummary = msg.content[0].type === "text" ? msg.content[0].text : "";
  } catch (err) {
    console.error("[mesa-relatorio-gerencial] falha ao gerar resumo executivo por IA:", err);
    aiSummary = "";
  }

  // ── HTML ─────────────────────────────────────────────────────────────────
  const stageRows = MA_OPEN_STAGES.concat(["CLOSED_WON", "CLOSED_LOST"])
    .map((s) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#F5F1E8">${MA_STAGE_LABELS[s]}</td><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#9BAFC5">${stageCounts[s] ?? 0}</td><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#9BAFC5">${avgDaysPerStage[s] ? fmtDays(avgDaysPerStage[s]) + " dias" : "N/D"}</td></tr>`)
    .join("");

  const stuckDealRows = stuckDeals.length
    ? stuckDeals.map((d: any) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#F5F1E8">${d.code} · ${d.target_company}</td><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#9BAFC5">${MA_STAGE_LABELS[d.stage] ?? d.stage}</td><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#9BAFC5">${assigneeNames.get(d.assigned_to) ?? "sem responsável"}</td><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#ef4444;font-weight:700">${fmtDays(d.diasParado)}d</td></tr>`).join("")
    : `<tr><td colspan="4" style="padding:8px 12px;color:#9BAFC5">Nenhum deal parado há mais de ${MA_DEAL_STUCK_DAYS} dias na mesma fase.</td></tr>`;

  const loadRows = Object.entries(loadByAssignee)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#F5F1E8">${id === "sem_responsavel" ? "Sem responsável" : (assigneeNames.get(id) ?? id)}</td><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#9BAFC5">${count}</td></tr>`)
    .join("");

  const listingStatusRows = Object.entries(listingStatusCounts)
    .map(([status, count]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#F5F1E8">${LISTING_STATUS_LABELS[status] ?? status}</td><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#9BAFC5">${count}</td></tr>`)
    .join("");

  const gargaloRows = gargalos.length
    ? gargalos.slice(0, 10).map((g) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#E8C97A;font-weight:700">${g.origem}</td><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#F5F1E8">${g.item}</td><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#9BAFC5">${g.detalhe}</td><td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#ef4444;font-weight:700">${fmtDays(g.diasParado)}d</td></tr>`).join("")
    : `<tr><td colspan="4" style="padding:8px 12px;color:#6FCF97">Nenhum gargalo identificado neste período.</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" /></head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#09081A;color:#F5F1E8;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A;padding:40px 0;">
<tr><td align="center">
<table width="680" cellpadding="0" cellspacing="0" style="background:#13223A;border:1px solid #243A66;border-radius:12px;overflow:hidden;">
<tr><td style="padding:12px 32px;background:#162744;text-align:center;">
<img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" height="32" />
</td></tr>
<tr><td style="background:#162744;padding:24px 32px;border-bottom:1px solid #243A66;">
<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#C9A84C;">Relatório Gerencial, Mesa M&amp;A + Bolsa de Ativos</p>
<h1 style="margin:8px 0 0;font-size:20px;font-weight:700;color:#F5F1E8;">${bounds.label}</h1>
</td></tr>
<tr><td style="padding:32px;">

<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;">Resumo Executivo</p>
<p style="margin:0 0 24px;font-size:13px;color:#F5F1E8;line-height:1.7;">${aiSummary || "Resumo executivo indisponível nesta geração. Ver números detalhados abaixo."}</p>

<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;">Mesa M&amp;A, Deals por Fase</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px;margin-bottom:20px;">
<thead><tr style="color:#E8C97A;text-transform:uppercase;font-size:10px;"><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Fase</th><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Deals</th><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Tempo médio real na fase</th></tr></thead>
<tbody>${stageRows}</tbody>
</table>
<p style="margin:0 0 16px;font-size:12px;color:#9BAFC5;">${createdInPeriod} deals criados · ${closedWonInPeriod} fechados ganhos · ${closedLostInPeriod} fechados perdidos, no período.</p>

<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;">Mesa M&amp;A, Deals Parados (mais de ${MA_DEAL_STUCK_DAYS} dias na mesma fase)</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px;margin-bottom:20px;">
<thead><tr style="color:#E8C97A;text-transform:uppercase;font-size:10px;"><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Deal</th><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Fase</th><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Responsável</th><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Parado há</th></tr></thead>
<tbody>${stuckDealRows}</tbody>
</table>

<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;">Mesa M&amp;A, Carga por Responsável (deals em aberto)</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px;margin-bottom:20px;">
<thead><tr style="color:#E8C97A;text-transform:uppercase;font-size:10px;"><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Responsável</th><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Deals em aberto</th></tr></thead>
<tbody>${loadRows}</tbody>
</table>

<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;">Bolsa de Ativos, Ativos por Status</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px;margin-bottom:20px;">
<thead><tr style="color:#E8C97A;text-transform:uppercase;font-size:10px;"><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Status</th><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Ativos</th></tr></thead>
<tbody>${listingStatusRows}</tbody>
</table>

<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;">Gargalos Consolidados (Mesa M&amp;A + Bolsa de Ativos)</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px;margin-bottom:8px;">
<thead><tr style="color:#E8C97A;text-transform:uppercase;font-size:10px;"><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Mesa</th><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Item</th><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Detalhe</th><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Parado há</th></tr></thead>
<tbody>${gargaloRows}</tbody>
</table>
<p style="margin:12px 0 0;font-size:11px;color:#9BAFC5;">Para itens da Bolsa de Ativos, "parado há" é medido a partir da última atualização do ativo/lote, não da entrada no status atual (a Bolsa de Ativos ainda não tem histórico de status dedicado, diferente da Mesa M&amp;A).</p>

</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const gate = auditHtml(html);
  const finalHtml = gate.blocking.length > 0 ? html : gate.corrected;
  if (gate.blocking.length > 0) console.error("[mesa-relatorio-gerencial] Brand Guardian bloqueou:", gate.blocking);

  const title = `Relatório Gerencial ${period === "semanal" ? "Semanal" : "Mensal"}, Mesa M&A + Bolsa de Ativos (${bounds.label})`;

  const { data: savedReport, error: saveError } = await db
    .from("generated_reports")
    .insert({
      title,
      html: finalHtml,
      squad_id: "mesa-relatorio-gerencial",
      output_type: "report",
      user_id: SYSTEM_OWNER_ID,
    })
    .select("id")
    .single();

  if (saveError) console.error("[mesa-relatorio-gerencial] falha ao salvar em generated_reports:", saveError);

  if (process.env.RESEND_API_KEY) {
    const { data: admins } = await db.from("profiles").select("email").eq("role", "ADMIN").eq("is_active", true);
    const recipients = Array.from(new Set([...(admins ?? []).map((a: any) => a.email).filter(Boolean), JURIDICO_EMAIL]));
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "V3 Partners Mesa <noreply@v3partners.com.br>",
        to: recipients,
        subject: auditText(title).corrected,
        html: finalHtml,
      });
    } catch (err) {
      console.error("[mesa-relatorio-gerencial] falha ao enviar e-mail:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    report_id: savedReport?.id ?? null,
    period: bounds.label,
    ma: { total: deals.length, abertos: openDeals.length, criados_no_periodo: createdInPeriod, fechados_ganhos: closedWonInPeriod, fechados_perdidos: closedLostInPeriod, parados: stuckDeals.length },
    bolsa: { total_ativos: listings.length, lotes_parados: (stuckBatches ?? []).length, contratos_sla_estourado: contractsSlaEstourado.length, ativos_sem_oferta: listingsSemOferta.length },
    gargalos_total: gargalos.length,
  });
}
