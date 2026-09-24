import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularComissaoLicenciado, lerAliquotaComissao } from "@/lib/credit-commissions";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";
import { ehAnaliseDoSite } from "@/lib/analise-site";

/**
 * RELATÓRIO MENSAL POR PARTNER — MESA DE CRÉDITO (23/09/2026, pedido do Hamilton)
 *
 * Um único cálculo para 3 lugares (nunca duplicar):
 *   1. GET /api/cron/relatorio-mensal-partners — todo dia 1, mês anterior: e-mail para cada
 *      partner com o dele + e-mail consolidado para os sócios.
 *   2. /mesa-credito/relatorio-mensal — mesma informação na plataforma (partner vê o dele,
 *      Mesa/Gestão/Admin vê todos), qualquer mês.
 *
 * Propostas do MÊS = criadas no mês. Carteira, previsão e acumulado olham todas as propostas
 * do partner (não só as do mês), senão "previsão das aprovadas" ignoraria o que foi enviado
 * antes e aprovado agora.
 */

export const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "PARTNER_HE", "ENTERPRISE"] as const;

// Mesmo ID de perfil usado em app/api/contracts/approve/route.ts (conta ADMIN real do Hamilton).
export const SOCIOS_IDS = [
  "d0af8eaa-9f3c-4e7a-b8c6-613736524317", // João Lemos
  "75c6cac4-8d30-436e-b9a6-d5d494d7470b", // Hamilton Santos (suporte@, ADMIN)
  "d5f26efd-8ed5-4d90-b3f4-9ce0004803c5", // Robson Lino
];

export const STAGE_LABELS: Record<string, string> = {
  RECEBIDO: "Recebido", TRIAGEM: "Triagem", ANALISE: "Análise de Crédito",
  PENDENCIA: "Pendência de Docs", AVALIACAO_IMOVEL: "Avaliação de Imóvel", APROVACAO: "Em Aprovação",
  CONTRATO_ASSINADO: "Contrato Assinado", REGISTRO_IMOVEL: "Registro de Imóveis",
  LIBERADO: "Recurso Liberado", REPROVADO: "Reprovado", DECLINADO: "Declinado", FINALIZADO: "Finalizado",
};

const FOI_PARA_ANALISE = new Set(["ANALISE", "PENDENCIA", "AVALIACAO_IMOVEL", "APROVACAO", "CONTRATO_ASSINADO", "REGISTRO_IMOVEL", "LIBERADO", "FINALIZADO"]);
const LIBERADA = new Set(["LIBERADO", "FINALIZADO"]);
const RECUSADA = new Set(["REPROVADO", "DECLINADO"]);
const EM_ABERTO = new Set(["RECEBIDO", "TRIAGEM", "ANALISE", "PENDENCIA", "AVALIACAO_IMOVEL", "APROVACAO", "CONTRATO_ASSINADO", "REGISTRO_IMOVEL"]);

export interface Periodo { chave: string; label: string; inicio: string; fim: string }

/** "2026-09" → período do mês; sem argumento → mês anterior ao de hoje (fuso de Brasília). */
export function periodoDoMes(chave?: string | null): Periodo {
  let ano: number;
  let mes: number; // 1-12
  const m = chave?.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    ano = Number(m[1]);
    mes = Number(m[2]);
  } else {
    const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    ano = hoje.getFullYear();
    mes = hoje.getMonth(); // mês anterior (0 = dezembro do ano anterior)
    if (mes === 0) { mes = 12; ano -= 1; }
  }
  // Limites em horário de Brasília (UTC-3, sem horário de verão desde 2019).
  const inicio = new Date(Date.UTC(ano, mes - 1, 1, 3, 0, 0)).toISOString();
  const fim = new Date(Date.UTC(ano, mes, 1, 3, 0, 0)).toISOString();
  const label = new Date(Date.UTC(ano, mes - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return { chave: `${ano}-${String(mes).padStart(2, "0")}`, label, inicio, fim };
}

export interface PropostaLinha {
  id: string;
  code: string | null;
  cliente: string;
  linha: string | null;
  nivel: string | null;
  valor: number;
  estagio: string;
  estagioLabel: string;
  checklistCompleto: boolean;
  foiParaAnalise: boolean;
  criadaEm: string;
}

export interface RelatorioPartner {
  partner: { id: string; nome: string; email: string | null; role: string; plano: string };
  propostasMes: PropostaLinha[];
  mes: {
    enviadas: number;
    valorTotal: number;
    ticketMedio: number;
    foramParaAnalise: number;
    checklistCompleto: number;
    pendenciaDocs: number;
    emAprovacao: number;
    aprovadas: number;
    liberadas: number;
    valorLiberado: number;
    recusadas: number;
    taxaConversao: number | null; // liberadas / enviadas (%)
  };
  carteira: { emAberto: number; valorEmAberto: number; porEstagio: { estagio: string; label: string; qtd: number; valor: number }[] };
  comissao: {
    doMes: number;
    doMesPaga: number;
    doMesAReceber: number;
    previsaoAprovadas: number;
    propostasNaPrevisao: number;
    previsaoSemPercentual: boolean; // ENTERPRISE: % negociável, previsão fica zerada
    /** Aprovadas (botão Aprovar) ainda sem % de mandato/instituição no modal: fora da previsão. */
    aprovadasSemPercentual: number;
    acumulada: number;
    acumuladaPaga: number;
    acumuladaAReceber: number;
  };
}

export interface RelatorioMensal {
  periodo: Periodo;
  partners: RelatorioPartner[];
  totais: {
    partnersAtivos: number;
    enviadas: number;
    valorTotal: number;
    foramParaAnalise: number;
    checklistCompleto: number;
    aprovadas: number;
    liberadas: number;
    valorLiberado: number;
    comissaoMes: number;
    previsaoAprovadas: number;
    comissaoAcumulada: number;
  };
}

type PropostaRow = {
  id: string; code: string | null; client_name: string | null; title: string | null; credit_line: string | null;
  current_level: string | null; stage: string | null; status: string | null; requested_value: number | null;
  approved_value: number | null; valor_credito_atual: number | null; comissao_mandato_perc: number | null;
  comissao_instituicao_perc: number | null; credit_profile_id: string | null; partner_id: string | null;
  metadata: Record<string, unknown> | null; created_at: string;
};

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monta o relatório do mês. `partnerId` restringe a um partner (tela do próprio partner). */
export async function montarRelatorioMensal(db: SupabaseClient, periodo: Periodo, partnerId?: string): Promise<RelatorioMensal> {
  let partnersQ = db.from("profiles").select("id, full_name, email, role, is_active").in("role", [...PARTNER_ROLES]);
  if (partnerId) partnersQ = partnersQ.eq("id", partnerId);
  const { data: partnersData } = await partnersQ;

  let propsQ = db
    .from("credit_desk_proposals")
    .select("id, code, client_name, title, credit_line, current_level, stage, status, requested_value, approved_value, valor_credito_atual, comissao_mandato_perc, comissao_instituicao_perc, credit_profile_id, partner_id, metadata, created_at")
    .is("deleted_at", null)
    .not("partner_id", "is", null);
  if (partnerId) propsQ = propsQ.eq("partner_id", partnerId);
  const { data: propsData } = await propsQ;
  const propostas = ((propsData ?? []) as PropostaRow[]).filter((p) => !ehAnaliseDoSite(p));

  let comQ = db
    .from("commissions")
    .select("partner_id, commission_value, status, created_at")
    .neq("status", "CANCELADA");
  if (partnerId) comQ = comQ.eq("partner_id", partnerId);
  const { data: comData } = await comQ;
  const comissoes = (comData ?? []) as { partner_id: string; commission_value: number | null; status: string; created_at: string }[];

  const aliquota = await lerAliquotaComissao(db);
  // Compara como número: o banco devolve "+00:00" e o período é "Z" (texto não bate).
  const ini = Date.parse(periodo.inicio);
  const fim = Date.parse(periodo.fim);
  const noMes = (iso: string) => { const t = Date.parse(iso); return t >= ini && t < fim; };

  const relatorios: RelatorioPartner[] = [];
  for (const p of partnersData ?? []) {
    const minhas = propostas.filter((x) => x.partner_id === p.id);
    const minhasCom = comissoes.filter((c) => c.partner_id === p.id);
    // Partner sem nenhuma proposta nem comissão na vida e inativo: não entra.
    if (!partnerId && minhas.length === 0 && minhasCom.length === 0) continue;
    if (!partnerId && p.is_active === false && minhas.length === 0) continue;

    const doMes = minhas.filter((x) => noMes(x.created_at)).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const linhas: PropostaLinha[] = doMes.map((x) => {
      const estagio = x.stage ?? "RECEBIDO";
      const meta = x.metadata ?? {};
      return {
        id: x.id,
        code: x.code,
        cliente: x.client_name ?? x.title ?? "—",
        linha: x.credit_line,
        nivel: x.current_level,
        valor: num(x.requested_value),
        estagio,
        estagioLabel: STAGE_LABELS[estagio] ?? estagio,
        checklistCompleto: Boolean(meta.docs_checklist_confirmed_at),
        foiParaAnalise: FOI_PARA_ANALISE.has(estagio) || Boolean(x.credit_profile_id),
        criadaEm: x.created_at,
      };
    });

    const enviadas = linhas.length;
    const valorTotal = linhas.reduce((s, l) => s + l.valor, 0);
    const liberadasMes = doMes.filter((x) => LIBERADA.has(x.stage ?? ""));
    // Aprovada = crédito aprovado pelo botão "Aprovar" do modal (status APPROVED).
    const aprovadasMes = doMes.filter((x) => x.status === "APPROVED");

    const abertas = minhas.filter((x) => EM_ABERTO.has(x.stage ?? "RECEBIDO"));
    const porEstagio = [...EM_ABERTO].map((e) => {
      const xs = abertas.filter((x) => (x.stage ?? "RECEBIDO") === e);
      return { estagio: e, label: STAGE_LABELS[e], qtd: xs.length, valor: xs.reduce((s, x) => s + num(x.requested_value), 0) };
    }).filter((e) => e.qtd > 0);

    // Previsão (regra do Hamilton, 23/09/2026): só crédito APROVADO pelo botão "Aprovar" e com
    // os % de comissão de mandato E instituição já preenchidos no modal; ainda não liberado
    // (no LIBERADO a comissão real é gerada e passa a contar em "do mês"/"acumulada").
    const aprovadasALiberar = minhas.filter((x) =>
      x.status === "APPROVED" &&
      !LIBERADA.has(x.stage ?? "") && !RECUSADA.has(x.stage ?? "") &&
      (x.metadata ?? {}).commissions_generated !== true,
    );
    const comPercentual = (x: PropostaRow) => x.comissao_mandato_perc != null && x.comissao_instituicao_perc != null;
    const naPrevisao = aprovadasALiberar.filter(comPercentual);
    const previsao = naPrevisao.reduce((s, x) => s + calcularComissaoLicenciado(x, p.role, aliquota).licenciadoValue, 0);

    const comMes = minhasCom.filter((c) => noMes(c.created_at));
    const soma = (xs: typeof minhasCom) => round2(xs.reduce((s, c) => s + num(c.commission_value), 0));

    relatorios.push({
      partner: { id: p.id, nome: p.full_name ?? p.email ?? "Partner", email: p.email, role: p.role, plano: ROLE_LABELS[p.role as UserRole] ?? p.role },
      propostasMes: linhas,
      mes: {
        enviadas,
        valorTotal,
        ticketMedio: enviadas ? valorTotal / enviadas : 0,
        foramParaAnalise: linhas.filter((l) => l.foiParaAnalise).length,
        checklistCompleto: linhas.filter((l) => l.checklistCompleto).length,
        pendenciaDocs: linhas.filter((l) => l.estagio === "PENDENCIA").length,
        emAprovacao: linhas.filter((l) => l.estagio === "APROVACAO").length,
        aprovadas: aprovadasMes.length,
        liberadas: liberadasMes.length,
        valorLiberado: liberadasMes.reduce((s, x) => s + num(x.valor_credito_atual ?? x.approved_value ?? x.requested_value), 0),
        recusadas: linhas.filter((l) => RECUSADA.has(l.estagio)).length,
        taxaConversao: enviadas ? (liberadasMes.length / enviadas) * 100 : null,
      },
      carteira: { emAberto: abertas.length, valorEmAberto: abertas.reduce((s, x) => s + num(x.requested_value), 0), porEstagio },
      comissao: {
        doMes: soma(comMes),
        doMesPaga: soma(comMes.filter((c) => c.status === "PAGA")),
        doMesAReceber: soma(comMes.filter((c) => c.status !== "PAGA")),
        previsaoAprovadas: round2(previsao),
        propostasNaPrevisao: naPrevisao.length,
        previsaoSemPercentual: naPrevisao.length > 0 && p.role === "ENTERPRISE",
        aprovadasSemPercentual: aprovadasALiberar.length - naPrevisao.length,
        acumulada: soma(minhasCom),
        acumuladaPaga: soma(minhasCom.filter((c) => c.status === "PAGA")),
        acumuladaAReceber: soma(minhasCom.filter((c) => c.status !== "PAGA")),
      },
    });
  }

  // Mais movimento primeiro
  relatorios.sort((a, b) => b.mes.valorTotal - a.mes.valorTotal || b.carteira.valorEmAberto - a.carteira.valorEmAberto);

  const t = (f: (r: RelatorioPartner) => number) => relatorios.reduce((s, r) => s + f(r), 0);
  return {
    periodo,
    partners: relatorios,
    totais: {
      partnersAtivos: relatorios.filter((r) => r.mes.enviadas > 0).length,
      enviadas: t((r) => r.mes.enviadas),
      valorTotal: t((r) => r.mes.valorTotal),
      foramParaAnalise: t((r) => r.mes.foramParaAnalise),
      checklistCompleto: t((r) => r.mes.checklistCompleto),
      aprovadas: t((r) => r.mes.aprovadas),
      liberadas: t((r) => r.mes.liberadas),
      valorLiberado: t((r) => r.mes.valorLiberado),
      comissaoMes: round2(t((r) => r.comissao.doMes)),
      previsaoAprovadas: round2(t((r) => r.comissao.previsaoAprovadas)),
      comissaoAcumulada: round2(t((r) => r.comissao.acumulada)),
    },
  };
}

// ─── E-mail (HTML inline, paleta V3) ──────────────────────────────────────────

export const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const C = { navy: "#09081A", card: "#162744", borda: "#243A66", ouro: "#C9A84C", ouroClaro: "#E8C97A", cream: "#F0ECE4", muted: "#9BAFC5" };

function kpi(label: string, valor: string, sub?: string) {
  return `<td style="padding:6px;width:33%;vertical-align:top;"><div style="background:#13223A;border:1px solid ${C.borda};border-radius:8px;padding:12px 14px;">
    <div style="font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:.08em;">${label}</div>
    <div style="font-size:18px;font-weight:800;color:${C.cream};margin-top:4px;">${valor}</div>
    ${sub ? `<div style="font-size:11px;color:${C.muted};margin-top:2px;">${sub}</div>` : ""}
  </div></td>`;
}
const kpiRow = (cells: string[]) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${cells.join("")}</tr></table>`;
const secao = (titulo: string) => `<p style="margin:26px 0 8px;font-size:11px;font-weight:700;color:${C.ouro};text-transform:uppercase;letter-spacing:.12em;">${titulo}</p>`;

function tabela(cab: string[], linhas: string[][]) {
  if (linhas.length === 0) return `<p style="font-size:12px;color:${C.muted};margin:0;">Nada no período.</p>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:12px;">
    <tr>${cab.map((h) => `<th align="left" style="padding:7px 6px;border-bottom:1px solid ${C.borda};color:${C.muted};font-weight:600;font-size:10px;text-transform:uppercase;">${h}</th>`).join("")}</tr>
    ${linhas.map((l) => `<tr>${l.map((c) => `<td style="padding:7px 6px;border-bottom:1px solid rgba(36,58,102,.5);color:${C.cream};">${c}</td>`).join("")}</tr>`).join("")}
  </table>`;
}

function moldura(titulo: string, subtitulo: string, corpo: string, ctaUrl: string) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:${C.navy};font-family:'DM Sans',Arial,sans-serif;">
<div style="max-width:720px;margin:32px auto;background:${C.card};border-radius:12px;overflow:hidden;border:1px solid ${C.borda};">
  <div style="padding:22px 28px;border-bottom:1px solid ${C.borda};background:${C.navy};">
    <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:30px;display:block;">
  </div>
  <div style="padding:26px 28px;">
    <p style="margin:0;font-size:10px;font-weight:700;color:${C.ouro};text-transform:uppercase;letter-spacing:.14em;">Mesa de Crédito · Relatório mensal</p>
    <h2 style="margin:6px 0 4px;font-size:20px;font-weight:700;color:${C.cream};">${esc(titulo)}</h2>
    <p style="margin:0 0 8px;font-size:13px;color:${C.muted};">${esc(subtitulo)}</p>
    ${corpo}
    <div style="margin-top:28px;"><a href="${ctaUrl}" style="display:inline-block;background:${C.ouro};color:${C.navy};text-decoration:none;padding:11px 24px;border-radius:8px;font-weight:700;font-size:13px;">Ver na plataforma →</a></div>
  </div>
  <div style="padding:16px 28px;border-top:1px solid ${C.borda};background:${C.navy};">
    <p style="margin:0;font-size:11px;color:${C.muted};">V3 Partners · E-mail automático enviado todo dia 1, não responda.</p>
  </div>
</div></body></html>`;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.v3partners.com.br";

function blocoPartner(r: RelatorioPartner) {
  const m = r.mes;
  const c = r.comissao;
  return `
  ${secao("Propostas do mês")}
  ${kpiRow([
    kpi("Enviadas", String(m.enviadas), brl(m.valorTotal)),
    kpi("Foram para análise", String(m.foramParaAnalise), m.enviadas ? `${Math.round((m.foramParaAnalise / m.enviadas) * 100)}% das enviadas` : undefined),
    kpi("Checklist completo", String(m.checklistCompleto), m.enviadas ? `${Math.round((m.checklistCompleto / m.enviadas) * 100)}% das enviadas` : undefined),
  ])}
  ${kpiRow([
    kpi("Ticket médio", brl(m.ticketMedio)),
    kpi("Aprovadas / liberadas", `${m.aprovadas} / ${m.liberadas}`, m.liberadas ? brl(m.valorLiberado) + " liberados" : undefined),
    kpi("Pendência de docs", String(m.pendenciaDocs), m.recusadas ? `${m.recusadas} reprovada(s)/declinada(s)` : undefined),
  ])}
  ${secao("Comissões")}
  ${kpiRow([
    kpi("Comissão do mês", brl(c.doMes), `${brl(c.doMesPaga)} paga · ${brl(c.doMesAReceber)} a receber`),
    kpi("Previsão (aprovadas)", c.previsaoSemPercentual ? "A definir" : brl(c.previsaoAprovadas), `${c.propostasNaPrevisao} aprovada(s) a liberar${c.aprovadasSemPercentual ? ` · ${c.aprovadasSemPercentual} sem % de comissão` : ""}`),
    kpi("Comissão acumulada", brl(c.acumulada), `${brl(c.acumuladaPaga)} paga · ${brl(c.acumuladaAReceber)} a receber`),
  ])}
  ${secao("Propostas enviadas no mês")}
  ${tabela(
    ["Código", "Cliente", "Linha", "Valor", "Etapa", "Análise", "Checklist"],
    r.propostasMes.map((p) => [
      esc(p.code ?? "—"), esc(p.cliente), esc(p.linha ?? "—"), brl(p.valor), esc(p.estagioLabel),
      p.foiParaAnalise ? "✓" : "—", p.checklistCompleto ? "✓" : "—",
    ]),
  )}
  ${secao("Carteira em aberto (todas as propostas)")}
  ${tabela(["Etapa", "Qtd.", "Valor"], r.carteira.porEstagio.map((e) => [esc(e.label), String(e.qtd), brl(e.valor)]))}
  <p style="margin:8px 0 0;font-size:12px;color:${C.muted};">Total em aberto: <strong style="color:${C.cream};">${r.carteira.emAberto} proposta(s) · ${brl(r.carteira.valorEmAberto)}</strong></p>`;
}

export function htmlRelatorioPartner(rel: RelatorioMensal, r: RelatorioPartner) {
  const semMov = r.mes.enviadas === 0;
  const corpo = `${semMov ? `<div style="margin-top:14px;padding:12px 16px;background:#13223A;border-radius:8px;border-left:3px solid ${C.muted};font-size:13px;color:${C.muted};">Nenhuma proposta enviada em ${esc(rel.periodo.label)}. A carteira e as comissões abaixo seguem valendo.</div>` : ""}${blocoPartner(r)}
  <p style="margin:18px 0 0;font-size:11px;color:${C.muted};">Previsão = comissão estimada dos créditos já aprovados, com % de mandato e instituição definidos, que ainda não foram liberados, pela regra do seu plano (${esc(r.partner.plano)}). O valor final é confirmado na liberação do recurso.</p>`;
  return moldura(`Olá, ${r.partner.nome}`, `Seu resumo de ${rel.periodo.label}`, corpo, `${APP_URL}/mesa-credito/relatorio-mensal?mes=${rel.periodo.chave}`);
}

export function htmlRelatorioSocios(rel: RelatorioMensal) {
  const t = rel.totais;
  const resumo = `
  ${secao("Consolidado da rede")}
  ${kpiRow([
    kpi("Propostas enviadas", String(t.enviadas), brl(t.valorTotal)),
    kpi("Partners com envio", String(t.partnersAtivos), `${rel.partners.length} partner(s) no relatório`),
    kpi("Foram para análise", String(t.foramParaAnalise), `${t.checklistCompleto} com checklist completo`),
  ])}
  ${kpiRow([
    kpi("Aprovadas / liberadas", `${t.aprovadas} / ${t.liberadas}`, t.liberadas ? `${brl(t.valorLiberado)} liberados` : undefined),
    kpi("Comissão do mês", brl(t.comissaoMes), `Previsão aprovadas: ${brl(t.previsaoAprovadas)}`),
    kpi("Comissão acumulada", brl(t.comissaoAcumulada)),
  ])}
  ${secao("Ranking de partners no mês")}
  ${tabela(
    ["Partner", "Plano", "Env.", "Valor", "Análise", "Checklist", "Aprov./Lib.", "Com. mês", "Previsão", "Acumulada"],
    rel.partners.map((r) => [
      esc(r.partner.nome), esc(r.partner.plano), String(r.mes.enviadas), brl(r.mes.valorTotal), String(r.mes.foramParaAnalise),
      String(r.mes.checklistCompleto), `${r.mes.aprovadas}/${r.mes.liberadas}`, brl(r.comissao.doMes),
      r.comissao.previsaoSemPercentual ? "a definir" : brl(r.comissao.previsaoAprovadas), brl(r.comissao.acumulada),
    ]),
  )}`;
  const detalhes = rel.partners
    .filter((r) => r.mes.enviadas > 0 || r.carteira.emAberto > 0)
    .map((r) => `<div style="margin-top:30px;padding-top:6px;border-top:1px solid ${C.borda};">
      <p style="margin:14px 0 0;font-size:15px;font-weight:700;color:${C.cream};">${esc(r.partner.nome)} <span style="font-size:12px;font-weight:400;color:${C.muted};">· ${esc(r.partner.plano)}</span></p>
      ${blocoPartner(r)}</div>`)
    .join("");
  return moldura(`Relatório de partners · ${rel.periodo.label}`, "Consolidado para os sócios da V3", resumo + detalhes, `${APP_URL}/mesa-credito/relatorio-mensal?mes=${rel.periodo.chave}`);
}

// ─── Envio (cron do dia 1 e reenvio manual pela tela) ─────────────────────────

const chaveEnvio = (p: Periodo) => `relatorio_mensal_partners_enviado:${p.chave}`;

/**
 * Envia o relatório de cada partner + o consolidado para os sócios. Idempotente por mês
 * (marca em platform_settings): retry do cron não duplica e-mail; `forcar` reenvia.
 */
export async function enviarRelatorioMensal(db: SupabaseClient, periodo: Periodo, opts: { forcar?: boolean } = {}) {
  const { data: marca } = await db.from("platform_settings").select("value").eq("key", chaveEnvio(periodo)).maybeSingle();
  if (marca?.value && !opts.forcar) return { ok: true as const, jaEnviado: true, enviadoEm: marca.value, partners: 0, socios: 0 };

  const { enviarEmailHtml } = await import("@/lib/email");
  const rel = await montarRelatorioMensal(db, periodo);

  let partners = 0;
  for (const r of rel.partners) {
    if (!r.partner.email) continue;
    // Sem proposta no mês, sem carteira e sem comissão: não manda e-mail vazio.
    if (r.mes.enviadas === 0 && r.carteira.emAberto === 0 && r.comissao.acumulada === 0) continue;
    await enviarEmailHtml(r.partner.email, `📊 Seu relatório mensal · Mesa de Crédito · ${periodo.label}`, htmlRelatorioPartner(rel, r));
    partners++;
  }

  const { data: socios } = await db.from("profiles").select("email").in("id", SOCIOS_IDS);
  const emailsSocios = [...new Set((socios ?? []).map((s) => s.email).filter(Boolean) as string[])];
  const htmlSocios = htmlRelatorioSocios(rel);
  for (const e of emailsSocios) {
    await enviarEmailHtml(e, `📊 Relatório de partners · Mesa de Crédito · ${periodo.label}`, htmlSocios);
  }

  await db.from("platform_settings").upsert(
    { key: chaveEnvio(periodo), value: new Date().toISOString(), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  return { ok: true as const, jaEnviado: false, partners, socios: emailsSocios.length };
}
