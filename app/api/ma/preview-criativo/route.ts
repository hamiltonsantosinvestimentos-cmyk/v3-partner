import { NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { DEMO_DEALS } from "@/lib/demo-data";

const IS_DEMO = false;

// DM Sans (operacional) + Cormorant Garamond (cerimônial — capas CIM)
const FONT = `https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&display=swap`;

const CSS_BASE = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'DM Sans',sans-serif;background:#09081A;color:#F0ECE4}
  .gold{color:#C9A84C} .gold-light{color:#E8C97A} .muted{color:#7A8FA8}
  .card{background:#162744;border:1px solid #243A66;border-radius:12px;padding:24px}
  .label{font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#C9A84C}
  .divider{height:1px;background:linear-gradient(90deg,#C9A84C33,transparent);margin:20px 0}
  @media print{
    html,body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;margin:0!important;padding:0!important;}
  }
`;

function formatBRL(v: number) {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)} B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)} MM`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} K`;
  return `R$ ${v}`;
}

function formatUSD(v: number) {
  const usd = v / 5.1;
  if (usd >= 1e9) return `USD ${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `USD ${(usd / 1e6).toFixed(1)}M`;
  return `USD ${(usd / 1e3).toFixed(0)}K`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getForjaData(ad: any) {
  const fr = ad?.forja_result ?? {};
  return {
    narrative_pt: (fr.narrative_pt ?? "") as string,
    narrative_en: (fr.narrative_en ?? "") as string,
    tese: Array.isArray(fr.tese_investimento) ? fr.tese_investimento as string[] : [],
  };
}

// Constrói métricas ricas a partir de financial_projections — substitui os 3 itens genéricos
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMetricasFromFP(fp: any, deal: any): { label: string; value: string; sub?: string }[] {
  if (!fp) return [];
  const m: { label: string; value: string; sub?: string }[] = [];

  // Receita bruta realizada mais recente
  const receitas: { ano: number; tipo: string; valor: number }[] = fp.receita ?? [];
  const realizadas = receitas.filter(r => r.tipo === "realizado").sort((a, b) => b.ano - a.ano);
  if (realizadas[0]) {
    m.push({ label: `Receita Bruta ${realizadas[0].ano}`, value: formatBRL(realizadas[0].valor), sub: "realizado" });
  }

  // NOI cenário base
  const noi = fp.scenarios?.base?.noi_anual;
  if (noi) m.push({ label: "NOI Cenário Base", value: formatBRL(noi), sub: "anual projetado" });

  // Cap Rate base
  const capBase = fp.scenarios?.base?.cap_rate;
  if (capBase) m.push({ label: "Cap Rate Base", value: `${(capBase * 100).toFixed(1)}%`, sub: "cenário conservador" });

  // Valuation com expansão
  const valExp = fp.scenarios?.expansao?.valuation;
  if (valExp && deal.deal_value && valExp > deal.deal_value) {
    m.push({ label: "Upside c/ Expansão", value: formatBRL(valExp), sub: "+3 pavimentos projetado" });
  }

  // Cap Rate expansão
  const capExp = fp.scenarios?.expansao?.cap_rate;
  if (capExp) m.push({ label: "Cap Rate Expansão", value: `${(capExp * 100).toFixed(1)}%`, sub: "pós-obra projetado" });

  // NOI expansão
  const noiExp = fp.scenarios?.expansao?.noi_anual;
  if (noiExp) m.push({ label: "NOI c/ Expansão", value: formatBRL(noiExp), sub: "anual pós-expansão" });

  return m;
}

// Renderiza tese_investimento como bullets (array) ou parágrafo (string legado)
function renderTese(tese: string[] | string, style = "font-size:12px;color:#7A8FA8;line-height:1.7"): string {
  if (Array.isArray(tese) && tese.length > 0) {
    return tese.map(b =>
      `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
         <div style="width:5px;height:5px;border-radius:50%;background:#C9A84C;flex-shrink:0;margin-top:5px;"></div>
         <p style="${style}">${b}</p>
       </div>`
    ).join("");
  }
  if (typeof tese === "string" && tese.trim()) {
    return `<p style="${style}">${tese}</p>`;
  }
  return "";
}

// ── CIM — fiel ao modelo de referência V3 (engenharia reversa completa) ─────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCIM(deal: any, lang: string, investor?: InvestorInfo | null): string {
  const ad = deal.asset_data ?? {};
  const isPt = lang === "pt-br";
  const forja = getForjaData(ad);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fp = ad.financial_projections as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fr = ad.forja_result as any ?? {};

  // Helper: extrai campo do array validated do FORJA
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const val = (field: string): string => (fr.validated ?? []).find((v: any) => v.field === field)?.value ?? "";

  const desc = isPt
    ? (forja.narrative_pt || ad.descricao_ptbr || ad.descricao || "")
    : (forja.narrative_en || ad.descricao_en || ad.descricao_ptbr || "");

  const teseArr: string[] = forja.tese.length > 0 ? forja.tese
    : Array.isArray(ad.diferenciais) ? ad.diferenciais : [];

  const riscos: { nivel: string; descricao: string; mitigacao: string }[] = ad.riscos ?? [];

  const receitas: { ano: number; tipo: string; valor: number }[] = fp?.receita ?? [];
  const sc = fp?.scenarios as Record<string, { noi_anual?: number; cap_rate?: number; valuation?: number }> | undefined;
  const despesas = fp?.despesas_breakdown as Record<string, number> | undefined;
  const vacancias: { pct: number; pavimento: string }[] = fp?.vacancia_pct ?? [];

  const foundingYear = val("founding_year") ? parseInt(val("founding_year")) : null;
  const anosOp = foundingYear ? `${new Date().getFullYear() - foundingYear} anos` : "";

  const totalDesp = despesas ? Object.values(despesas).reduce((s, v) => s + v, 0) : 0;

  // receita realizada mais recente
  const receitaReal = receitas.filter(r => r.tipo === "realizado").sort((a,b) => b.ano - a.ano)[0];
  // crescimento YoY
  const receitaAnt = receitas.filter(r => r.tipo === "realizado").sort((a,b) => b.ano - a.ano)[1];
  const yoy = receitaReal && receitaAnt ? ((receitaReal.valor / receitaAnt.valor - 1) * 100) : null;

  const nivelColor = (n: string) =>
    n?.toLowerCase().includes("baixo") || n?.toLowerCase().includes("low") ? "var(--green-ok)"
    : n?.toLowerCase().includes("medio") || n?.toLowerCase().includes("medium") ? "var(--amber)"
    : "var(--red-risk)";
  const nivelClass = (n: string) =>
    n?.toLowerCase().includes("baixo") || n?.toLowerCase().includes("low") ? "risk-baixo"
    : n?.toLowerCase().includes("medio") || n?.toLowerCase().includes("medium") ? "risk-medio"
    : "risk-alto";

  // KPIs para seção 02
  const kpi1 = receitaReal ? { label: `Receita ${receitaReal.ano}`, val: formatBRL(receitaReal.valor), sub: yoy ? `+${yoy.toFixed(1)}% vs ${receitaAnt?.ano}` : "realizado", badge: yoy ? `↑ +${yoy.toFixed(1)}% YoY` : "" } : null;
  const kpi2 = val("area_construida") ? { label: "Área Construída", val: val("area_construida"), sub: "GLA atual" } : null;
  const kpi3 = sc?.base?.noi_anual ? { label: "NOI Base Anual", val: formatBRL(sc.base.noi_anual), sub: "cenário conservador" } : null;
  const kpi4 = sc?.base?.cap_rate ? { label: "Cap Rate Base", val: `${(sc.base.cap_rate*100).toFixed(1)}%`, sub: "sobre valuation pedido" } : null;

  const kpis = [kpi1, kpi2, kpi3, kpi4].filter(Boolean);

  // info-card Ficha do Ativo
  const fichaRows: [string, string, string?][] = [
    deal.target_company && ["Ativo", deal.target_company],
    val("tipo_operacao") && ["Operação", val("tipo_operacao")],
    deal.sector && ["Setor", deal.sector],
    deal.location && ["Localização", deal.location, "gold"],
    foundingYear && ["Fundação", `${foundingYear}${anosOp ? " ("+anosOp+")" : ""}`],
    val("area_construida") && ["Área Construída", val("area_construida"), "gold"],
    deal.deal_value && ["Valuation", formatBRL(deal.deal_value), "gold"],
    val("divida_total") && ["Dívida Total", val("divida_total"), "amber"],
    val("processos_judiciais") && ["Processos Judiciais", val("processos_judiciais"), val("processos_judiciais").toLowerCase().includes("sem") ? "green" : "amber"],
    deal.code && ["Processo V3", deal.code],
  ].filter(Boolean) as [string, string, string?][];

  // Cenários para seção 06
  type Cen = { label: string; tag: string; tagClass: string; metrics: [string,string][] };
  const cenarios: Cen[] = [];
  if (sc?.base) cenarios.push({
    label: "Cenário Base", tag: "Atual", tagClass: "tag-base",
    metrics: [
      receitaReal ? [`Receita ${receitaReal.ano}`, formatBRL(receitaReal.valor)] : null,
      sc.base.noi_anual ? ["NOI est./ano", formatBRL(sc.base.noi_anual)] : null,
      sc.base.cap_rate ? ["Cap Rate implícito", `~${(sc.base.cap_rate*100).toFixed(1)}%`] : null,
      sc.base.valuation ? ["Valuation", formatBRL(sc.base.valuation)] : (deal.deal_value ? ["Valuation", formatBRL(deal.deal_value)] : null),
    ].filter(Boolean) as [string,string][],
  });
  if (sc?.estabilizado) cenarios.push({
    label: "Cenário Estabilizado", tag: "18–24 meses", tagClass: "tag-estabilizado",
    metrics: [
      sc.estabilizado.noi_anual ? ["NOI anual estabilizado", formatBRL(sc.estabilizado.noi_anual)] : null,
      sc.estabilizado.cap_rate ? ["Cap Rate estabilizado", `~${(sc.estabilizado.cap_rate*100).toFixed(1)}%`] : null,
      sc.estabilizado.valuation ? ["Valor justo estimado", formatBRL(sc.estabilizado.valuation)] : null,
    ].filter(Boolean) as [string,string][],
  });
  if (sc?.expansao) cenarios.push({
    label: "Cenário c/ Expansão", tag: "36–48 meses", tagClass: "tag-expansao",
    metrics: [
      sc.expansao.noi_anual ? ["NOI anual expandido", formatBRL(sc.expansao.noi_anual)] : null,
      sc.expansao.cap_rate ? ["Cap Rate expansão", `~${(sc.expansao.cap_rate*100).toFixed(1)}%`] : null,
      sc.expansao.valuation ? ["Valor potencial", formatBRL(sc.expansao.valuation)] : null,
    ].filter(Boolean) as [string,string][],
  });

  const hasFinanceiro = receitas.length > 0 || !!despesas;
  const hasCenarios = cenarios.length > 0;

  // Tese estratégica de posicionamento (João Lemos)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const te = ad.tese_estrategica as any;

  // Valuation breakdown — imóveis penhorados + créditos judiciais + soma de partes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vb = ad.valuation_breakdown as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imovelPenhorados: { origem: string; qtd_imoveis: number; localizacao: string; valor_estimado: number; valor_esperado: number; probabilidade_realizacao: number; nota: string }[] = ad.imoveis_penhorados ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creditosJudiciais: { origem: string; valor_face: number; valor_esperado: number; probabilidade_realizacao: number; nota: string }[] = ad.creditos_judiciais ?? [];
  const hasValuation = !!vb || imovelPenhorados.length > 0;

  // Contagem dinâmica de seções numeradas
  let secN = 2; // 01 sumário, 02 destaques já fixos
  const nextSec = () => `0${++secN}`;
  const secFinanceiro  = hasFinanceiro  ? nextSec() : "";
  const secCenarios    = hasCenarios    ? nextSec() : "";
  const secValuation   = hasValuation   ? nextSec() : "";
  const secRiscos      = nextSec();
  const secEstrutura   = nextSec();

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>CIM — ${deal.target_company} | V3 Partners</title>
<link href="${FONT}" rel="stylesheet">
<style>
  :root{
    --navy:#09081A;--navy-mid:#0F0E2A;--navy-light:#1A1836;
    --gold:#C9A84C;--gold-light:#E2C97A;--gold-dark:#A8873A;
    --cream:#F5F1E8;--cream-dark:#EDE8DA;--muted:#9BAFC5;--white:#FFFFFF;
    --red-risk:#E05555;--green-ok:#4CAF7D;--amber:#E89B3A;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'DM Sans',sans-serif;background:var(--navy);color:var(--cream);font-size:14px;line-height:1.6;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  @media print{
    /* ── CONFIG DA PÁGINA ── */
    @page{size:A4 portrait;margin:17mm 0 13mm 0}
    /* FIX 1: capa sem timbrado — margin zero remove espaço do header/footer na pág 1 */
    /* Embutido no HTML (não via addStyleTag) para ser processado no layout inicial */
    @page:first{margin:0!important}

    /* ── FIX 2: FUNDO SÓLIDO NAVY — sem borda branca em nenhuma direção ──
       html (não só body) preenche o canvas completo da página no Puppeteer/Chrome,
       incluindo áreas de margem. Cor exata do manual V3: Navy Deep #09081A.
       Margem lateral = 0 no pdf() → fundo navy chega até a borda física do papel. */
    html{
      background:#09081A!important;
      -webkit-print-color-adjust:exact!important;
      print-color-adjust:exact!important;
      height:100%!important;
    }
    body{
      background:#09081A!important;color:#F5F1E8!important;
      font-size:9px!important;line-height:1.4!important;
      -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;
      min-height:100%!important;
    }
    /* FIX 3: padding interno das seções = 14mm (margem lateral do pdf() é 0) */
    .section,.section-alt{
      padding-left:14mm!important;padding-right:14mm!important;
    }
    *{box-shadow:none!important;text-shadow:none!important}
    *{overflow:visible!important}

    /* ── COVER: A4 full-bleed, 3 zonas, sem timbrado (@page :first margin=0) ── */
    .cover{
      min-height:297mm!important;
      background:#09081A!important;
      -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;
      page-break-after:always!important;break-after:page!important;
      overflow:hidden!important;
    }
    /* Zonas calibradas por φ em A4 */
    /* Zona 1: logo sozinha, topo esquerdo */
    .cover-z1{padding:14mm 14mm 0!important;align-items:flex-start!important;justify-content:flex-start!important}
    .cover-logo-label{display:none!important}
    /* φ: padding-bottom 22% → título no ponto áureo 113mm */
    .cover-z2{padding:0 14mm!important;padding-bottom:22%!important}
    .cover-z3{padding:8mm 14mm 14mm!important}
    /* φ: métricas ocupam 100% da largura com proporção de caixa φ:1 */
    .cover-metrics{max-width:100%!important;width:100%!important}
    .cover-metric{min-height:22mm!important;padding:10px 12px!important}
    /* Logo capa: 22mm (dentro do range 20–28mm do brandbook) */
    .cover-logo-img{height:22mm!important;width:auto!important}
    /* Cormorant Garamond 600 Italic: 62px → 46pt */
    .cover-title{font-size:46pt!important;line-height:1.02!important;letter-spacing:-0.02em!important}
    /* DM Sans 300 subtítulo: 18px → 14pt */
    .cover-subtitle{font-size:14pt!important;font-weight:300!important}
    /* Location: 12px → 9pt */
    .cover-location{font-size:9pt!important;margin-bottom:28pt!important}
    /* Eyebrow: 8px → 6pt — Gold Light #E8C97A obrigatório */
    .cover-eyebrow{font-size:6pt!important;color:#E8C97A!important;margin-bottom:14pt!important}
    .cover-eyebrow-badge{font-size:7pt!important}
    /* Métricas: valor 20px → 15pt | labels 9px → 7pt */
    .cover-metrics{max-width:100%!important}
    .cover-metric{padding:14px 16px!important}
    .cover-metric-value{font-size:15pt!important}
    .cover-metric-label{font-size:7pt!important}
    .cover-metric-sub{font-size:7pt!important}
    /* Legal */
    .cover-confidential{padding:10px 14px!important;max-width:340px!important}
    .cover-confidential-title{font-size:7pt!important}
    .cover-confidential-text{font-size:8pt!important;line-height:1.5!important}
    .cover-process-code{font-size:10pt!important}
    .cover-process-date{font-size:8pt!important}

    /* ── FIX 3: SEÇÕES COMPACTAS — máximo aproveitamento do papel ── */
    .section,.section-alt{
      padding-top:14px!important;padding-bottom:14px!important;
      break-inside:avoid-page;page-break-inside:avoid;
      -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;
    }
    .section{background:#09081A!important}
    .section-alt{background:#0F0E2A!important}

    /* FIX 3: SEM page-break-before automático em seções
       Conteúdo flui naturalmente → menos páginas, melhor aproveitamento do papel
       Única quebra obrigatória: após a capa (.cover já tem break-after:page) */
    .section.page-break,.section-alt.page-break{
      /* page-break-before REMOVIDO — deixa o Chrome paginar conforme o espaço */
      break-before:auto;
    }

    /* Header da seção — não quebrar */
    .section-header{
      break-inside:avoid!important;page-break-inside:avoid!important;
      margin-bottom:12px!important;
    }
    .section-number{width:28px!important;height:28px!important;font-size:11px!important}
    .section-title{font-size:16px!important}

    /* ── EXEC GRID: proporções A4 ── */
    .exec-grid{
      grid-template-columns:1fr 220px!important;
      gap:14px!important;
      break-inside:avoid!important;
    }
    .exec-lead{font-size:10px!important;line-height:1.5!important;margin-bottom:10px!important}
    .exec-highlight{padding:10px 14px!important;margin-top:10px!important}
    .exec-highlight p{font-size:10px!important;line-height:1.5!important}

    /* ── INFO CARD ── */
    .info-card{
      background:#1A1836!important;
      -webkit-print-color-adjust:exact!important;
      break-inside:avoid!important;page-break-inside:avoid!important;
    }
    .info-card-header{padding:8px 14px!important;font-size:9px!important}
    .info-row{padding:7px 14px!important}
    .info-label{font-size:9px!important}
    .info-value{font-size:10px!important}

    /* ── KPI GRID: 4 colunas compactadas ── */
    .kpi-grid{
      gap:8px!important;margin-bottom:16px!important;
      break-inside:avoid!important;page-break-inside:avoid!important;
    }
    .kpi-card{
      padding:12px 14px!important;
      background:#0F0E2A!important;
      -webkit-print-color-adjust:exact!important;
      break-inside:avoid!important;page-break-inside:avoid!important;
    }
    .kpi-label{font-size:8px!important;margin-bottom:6px!important}
    .kpi-value{font-size:18px!important;margin-bottom:3px!important;color:#C9A84C!important}
    .kpi-sub{font-size:9px!important}
    .kpi-badge{font-size:9px!important;padding:2px 6px!important;margin-top:4px!important}

    /* ── THESIS GRID ── */
    .thesis-grid{gap:8px!important;break-inside:avoid!important}
    .thesis-item{
      padding:12px 14px!important;gap:10px!important;
      background:#1A1836!important;
      -webkit-print-color-adjust:exact!important;
      break-inside:avoid!important;page-break-inside:avoid!important;
    }
    .thesis-num{width:24px!important;height:24px!important;font-size:11px!important;flex-shrink:0!important}
    .thesis-content h4{font-size:10px!important;margin-bottom:4px!important}
    .thesis-content p{font-size:9px!important;line-height:1.4!important}

    /* ── FIN TABLE ── */
    .fin-grid{gap:14px!important}
    .fin-table td{padding:6px 0!important;font-size:10px!important}
    .info-card-header + table{padding:10px 14px!important}

    /* ── UPSIDE SCENARIOS ── */
    .upside-scenario{
      background:#1A1836!important;
      -webkit-print-color-adjust:exact!important;
      break-inside:avoid!important;page-break-inside:avoid!important;
    }
    .upside-header{padding:10px 16px!important}
    .upside-header h3{font-size:12px!important}
    .upside-body{padding:12px 16px!important}
    .upside-metric{padding:4px 0!important;font-size:10px!important}

    /* ── RISK TABLE ── */
    .risk-table{width:100%!important;border-collapse:collapse!important}
    .risk-table th{
      background:#0F0E2A!important;color:#E2C97A!important;
      padding:7px 10px!important;font-size:8px!important;
      -webkit-print-color-adjust:exact!important;
    }
    .risk-table td{padding:8px 10px!important;font-size:9px!important;vertical-align:top!important}
    .risk-table tr{break-inside:avoid!important;page-break-inside:avoid!important}
    .risk-badge{font-size:8px!important;padding:2px 6px!important}

    /* ── TENANT TABLE (valuation) ── */
    .tenant-table{width:100%!important;border-collapse:collapse!important;break-inside:avoid!important}
    .tenant-table th{
      background:#0F0E2A!important;color:#E2C97A!important;
      padding:6px 10px!important;font-size:8px!important;
      -webkit-print-color-adjust:exact!important;
    }
    .tenant-table td{padding:7px 10px!important;font-size:9px!important}
    .tenant-table tr{break-inside:avoid!important;page-break-inside:avoid!important}
    .status-badge{font-size:8px!important;padding:1px 5px!important}

    /* ── FOOTER HTML: oculto em print ──
       Timbrado Puppeteer (footer template) já exibe logo + CNPJ + Pág X/Y
       Manter doc-footer visível evita sobreposição de logomarca na última página */
    .doc-footer{display:none!important}

    /* ── TIPOGRAFIA GLOBAL ── */
    h1{font-size:16px!important;letter-spacing:-0.5px!important}
    h2{font-size:13px!important}
    h3{font-size:11px!important}
    p,li,span{font-size:10px!important;line-height:1.45!important}
    td,th{font-size:10px!important}

    /* ── UTILS ── */
    .no-print,nav,button,[data-no-print]{display:none!important}
    a[href]::after{content:none!important}
    .divider{margin:12px 0!important}
    .mt-16,.mt-24,.mt-32{margin-top:8px!important}
    .mb-24{margin-bottom:8px!important}

    /* ── WATERMARK: visível apenas em print ── */
    .v3-watermark{
      display:block!important;position:fixed;
      top:50%;left:50%;
      transform:translate(-50%,-50%) rotate(-35deg);
      font-size:40px;font-weight:800;
      color:rgba(201,168,76,0.07);
      white-space:nowrap;pointer-events:none;z-index:9999;
      -webkit-print-color-adjust:exact!important;
      font-family:'DM Sans',sans-serif;
    }
  }
  /* ══════════════════════════════════════════════════════
     COVER — 3 ZONAS (brandbook V4.2 + regra dos terços)
     Zona 1 (identidade ~18%) | Zona 2 (título ~52%, centro óptico 38%) | Zona 3 (legal ~30%)
     ══════════════════════════════════════════════════════ */
  .cover{
    min-height:100vh;
    background:var(--navy);
    display:flex;flex-direction:column;
    position:relative;overflow:hidden;
  }
  /* Linha gold premium no topo */
  .cover::before{
    content:'';position:absolute;top:0;left:0;right:0;height:4px;
    background:linear-gradient(90deg,#A8873A,#C9A84C,#E8C97A 50%,#C9A84C,#A8873A);
    z-index:2;
  }
  /* Grid sutil 72px (brandbook) */
  .cover-grid{
    position:absolute;inset:0;
    background-image:
      linear-gradient(rgba(201,168,76,0.04)1px,transparent 1px),
      linear-gradient(90deg,rgba(201,168,76,0.04)1px,transparent 1px);
    background-size:72px 72px;pointer-events:none;z-index:0;
  }
  /* Glare radial central */
  .cover-glare{
    position:absolute;inset:0;
    background:radial-gradient(ellipse 70% 55% at 50% 42%,rgba(201,168,76,0.05) 0%,transparent 65%);
    pointer-events:none;z-index:0;
  }

  /* ════════════════════════════════════════════════════
     ZONA 1 — Logo sozinha, colada ao topo esquerdo
     Nenhum outro elemento nesta zona — apenas a marca
     ════════════════════════════════════════════════════ */
  .cover-z1{
    padding:48px 60px 0;
    display:flex;
    align-items:flex-start;
    justify-content:flex-start;  /* logo ancorada à esquerda */
    position:relative;z-index:1;
  }
  .cover-logo-wrap{display:block}  /* bloco simples — sem flex */
  .cover-logo-img{
    height:60px;width:auto;          /* brandbook: 56–80px em capa CIM */
    image-rendering:crisp-edges;
    filter:drop-shadow(0 0 10px rgba(201,168,76,.25));
    display:block;
  }
  /* label oculto — logo sozinha na capa */
  .cover-logo-label{ display:none }
  .cover-eyebrow-badge{
    display:inline-flex;align-items:center;gap:8px;
    background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.25);
    border-radius:3px;padding:7px 16px;
    font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;
    color:var(--gold);white-space:nowrap;
  }

  /* ════════════════════════════════════════════════════
     ZONA 2 — Título no ponto áureo (113,4mm do topo)
     padding-bottom:22% desloca o centro geométrico do
     flex para coincidir com 113mm = 297 ÷ φ²
     ════════════════════════════════════════════════════ */
  .cover-z2{
    flex:1;
    display:flex;flex-direction:column;justify-content:center;
    padding:0 60px;
    padding-bottom:22%;          /* ← φ: posiciona título no ponto áureo 113mm */
    position:relative;z-index:1;
  }
  .cover-eyebrow{
    font-size:8px;font-weight:700;letter-spacing:0.35em;text-transform:uppercase;
    color:#E8C97A;/* Gold Light — label abaixo de 12px, obrigatório */
    margin-bottom:24px;
  }
  /* Cormorant Garamond Italic 600 — exclusivo para título de capa CIM */
  .cover-title{
    font-family:'Cormorant Garamond',Georgia,serif;
    font-style:italic;font-weight:600;
    font-size:62px;line-height:1.02;letter-spacing:-0.02em;
    color:#F5F1E8;/* Cream V4 */
    margin-bottom:12px;
  }
  .cover-subtitle{
    font-family:'DM Sans',sans-serif;
    font-size:18px;font-weight:300;
    color:#9BAFC5;letter-spacing:0.02em;
    margin-bottom:6px;
  }
  .cover-location{
    font-size:12px;color:#9BAFC5;margin-bottom:52px;
    font-weight:400;letter-spacing:0.01em;
  }
  /* ════════════════════════════════════════════════════
     Barra de 4 métricas — proporção áurea φ:1
     Cada box: largura ÷ φ = altura → 1 box ≈ 46mm × 28mm
     Alinhamento: todos os boxes com mesma altura mínima
     ════════════════════════════════════════════════════ */
  .cover-metrics{
    display:grid;grid-template-columns:repeat(4,1fr);
    gap:1px;
    background:rgba(255,255,255,0.06);
    border-radius:8px;
    max-width:100%;              /* φ: ocupa toda a largura disponível */
    align-items:stretch;         /* φ: todos os boxes com mesma altura */
  }
  .cover-metric{
    background:#1A1836;
    padding:20px 22px;
    min-height:80px;             /* φ: 46mm/φ = 28mm ≈ 80px → proporção áurea */
    display:flex;flex-direction:column;justify-content:space-between;
    position:relative;
  }
  .cover-metric::after{
    content:'';position:absolute;bottom:0;left:0;right:0;
    height:2px;background:linear-gradient(90deg,transparent,#C9A84C,transparent);
    opacity:0.3;
  }
  .cover-metric-label{
    font-size:9px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;
    color:#9BAFC5;margin-bottom:6px;
    white-space:nowrap;          /* impede quebra de linha no label */
  }
  .cover-metric-value{
    font-size:20px;font-weight:700;color:#C9A84C;
    line-height:1;margin-bottom:4px;
    white-space:nowrap;
  }
  .cover-metric-sub{font-size:9px;color:#9BAFC5;white-space:nowrap}

  /* ════════════════════════════════════════════════════
     ZONA 3 — Legal (seção áurea inferior: 297÷φ = 183mm)
     align-items:flex-end mantém conteúdo na base da zona
     ════════════════════════════════════════════════════ */
  .cover-z3{
    padding:32px 60px 52px;
    display:flex;justify-content:space-between;
    align-items:flex-end;        /* φ: ancora conteúdo na base */
    position:relative;z-index:1;
  }
  .cover-confidential{
    background:rgba(224,85,85,0.1);border:1px solid rgba(224,85,85,0.25);
    border-radius:4px;padding:14px 20px;max-width:480px;
  }
  .cover-confidential-title{
    font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;
    color:#E05555;margin-bottom:6px;
  }
  .cover-confidential-text{font-size:10px;color:#9BAFC5;line-height:1.6}
  .cover-process{text-align:right}
  .cover-process-code{
    font-size:13px;font-weight:700;color:#C9A84C;
    letter-spacing:0.05em;margin-bottom:4px;
  }
  .cover-process-date{font-size:10px;color:#9BAFC5;line-height:1.5}
  /* SECTIONS */
  .section{padding:60px;border-bottom:1px solid rgba(255,255,255,0.05)}
  .section-alt{background:var(--navy-mid)}
  .section-header{display:flex;align-items:center;gap:16px;margin-bottom:40px}
  .section-number{width:36px;height:36px;background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.3);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--gold);flex-shrink:0}
  .section-title{font-size:24px;font-weight:700;color:var(--white);letter-spacing:-0.5px}
  .section-title span{color:var(--gold)}
  /* EXEC */
  .exec-grid{display:grid;grid-template-columns:1fr 380px;gap:40px}
  .exec-lead{font-size:14px;font-weight:400;color:var(--cream);line-height:1.8;margin-bottom:20px}
  .exec-highlight{background:rgba(201,168,76,0.08);border-left:3px solid var(--gold);padding:16px 20px;border-radius:0 8px 8px 0;margin-top:24px}
  .exec-highlight p{font-size:13px;color:var(--cream);line-height:1.7}
  .exec-highlight strong{color:var(--gold)}
  /* INFO CARD */
  .info-card{background:var(--navy-light);border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden}
  .info-card-header{background:rgba(201,168,76,0.1);border-bottom:1px solid rgba(201,168,76,0.2);padding:14px 20px;font-size:11px;font-weight:600;letter-spacing:2px;color:var(--gold);text-transform:uppercase}
  .info-row{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.04);gap:12px}
  .info-row:last-child{border-bottom:none}
  .info-label{font-size:11px;color:var(--muted);font-weight:500}
  .info-value{font-size:13px;font-weight:600;color:var(--cream);text-align:right}
  .info-value.gold{color:var(--gold)}.info-value.green{color:var(--green-ok)}.info-value.amber{color:var(--amber)}.info-value.red{color:var(--red-risk)}
  /* KPI */
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:40px}
  .kpi-grid-3{grid-template-columns:repeat(3,1fr)}
  .kpi-card{background:var(--navy-light);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:24px;position:relative;overflow:hidden;break-inside:avoid}
  .kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--gold-dark),var(--gold))}
  .kpi-label{font-size:10px;font-weight:600;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:12px}
  .kpi-value{font-size:28px;font-weight:700;color:var(--gold);line-height:1;margin-bottom:6px}
  .kpi-sub{font-size:12px;color:var(--muted)}
  .kpi-badge{display:inline-flex;align-items:center;gap:4px;background:rgba(76,175,125,0.12);border:1px solid rgba(76,175,125,0.3);border-radius:4px;padding:3px 8px;font-size:11px;font-weight:600;color:var(--green-ok);margin-top:8px}
  /* THESIS */
  .thesis-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
  .thesis-item{background:var(--navy-light);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:24px;display:flex;gap:16px;break-inside:avoid}
  .thesis-num{width:32px;height:32px;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--gold);flex-shrink:0}
  .thesis-content h4{font-size:14px;font-weight:600;color:var(--white);margin-bottom:8px;line-height:1.3}
  .thesis-content p{font-size:12px;color:var(--muted);line-height:1.6}
  /* FINANCIAL */
  .fin-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .fin-table{width:100%;border-collapse:collapse}
  .fin-table tr{border-bottom:1px solid rgba(255,255,255,0.05)}
  .fin-table td{padding:10px 0;font-size:13px}
  .fin-table td:last-child{text-align:right;font-weight:600;color:var(--cream)}
  .fin-table .total-row td{color:var(--gold);font-weight:700;border-top:1px solid rgba(201,168,76,0.3);padding-top:14px}
  .fin-table .sub-row td{color:var(--muted);font-size:12px}
  .fin-table .growth td:last-child{color:var(--green-ok)}
  /* SCENARIOS */
  .upside-scenario{background:var(--navy-light);border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;break-inside:avoid}
  .upside-header{padding:16px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.06)}
  .upside-header h3{font-size:15px;font-weight:600;color:var(--white)}
  .upside-tag{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:4px 10px;border-radius:4px}
  .tag-base{background:rgba(155,175,197,0.1);color:var(--muted)}
  .tag-estabilizado{background:rgba(232,155,58,0.15);color:var(--amber)}
  .tag-expansao{background:rgba(201,168,76,0.15);color:var(--gold)}
  .upside-body{padding:20px 24px}
  .upside-metric{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04)}
  .upside-metric:last-child{border:none}
  .upside-metric span:first-child{color:var(--muted)}
  .upside-metric span:last-child{font-weight:600;color:var(--cream)}
  .upside-metric.highlight span:last-child{color:var(--gold);font-size:16px;font-weight:700}
  /* RISK TABLE */
  .risk-table{width:100%;border-collapse:collapse}
  .risk-table th{background:rgba(201,168,76,0.1);color:var(--gold);font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;padding:10px 14px;text-align:left}
  .risk-table td{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;vertical-align:top}
  .risk-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
  .risk-alto{background:rgba(224,85,85,0.12);color:var(--red-risk)}
  .risk-medio{background:rgba(232,155,58,0.12);color:var(--amber)}
  .risk-baixo{background:rgba(76,175,125,0.12);color:var(--green-ok)}
  /* FOOTER */
  .doc-footer{background:var(--navy-mid);padding:32px 60px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.06)}
  .footer-logo img{height:32px;opacity:0.7}
  .footer-info{text-align:center;font-size:11px;color:var(--muted);line-height:1.6}
  .footer-ref{text-align:right;font-size:11px;color:var(--muted)}
  .footer-ref strong{color:var(--gold);display:block;margin-bottom:2px}
  /* UTILS */
  .divider{height:1px;background:rgba(255,255,255,0.06);margin:32px 0}
  .mt-16{margin-top:16px}.mt-24{margin-top:24px}.mt-32{margin-top:32px}.mb-24{margin-bottom:24px}
  a{color:var(--gold);text-decoration:none}
  /* TENANT / VALUATION TABLE */
  .tenant-table{width:100%;border-collapse:collapse;font-size:12px}
  .tenant-table th{background:rgba(201,168,76,0.1);color:var(--gold);font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;padding:10px 14px;text-align:left;border-bottom:1px solid rgba(201,168,76,0.2)}
  .tenant-table td{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04);color:var(--cream)}
  .status-badge{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase}
  .status-active{background:rgba(76,175,125,0.12);color:var(--green-ok);border:1px solid rgba(76,175,125,0.3)}
  .status-vacant{background:rgba(224,85,85,0.08);color:var(--red-risk);border:1px solid rgba(224,85,85,0.2)}
  .status-indet{background:rgba(155,175,197,0.1);color:var(--muted);border:1px solid rgba(155,175,197,0.2)}
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════
     CAPA — 3 ZONAS (Regra dos Terços + Centro Óptico 38%)
     ═══════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-grid"></div>
  <div class="cover-glare"></div>

  <!-- ZONA 1: Logo sozinha — topo esquerdo, sem outros elementos -->
  <div class="cover-z1">
    <div class="cover-logo-wrap">
      <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" class="cover-logo-img">
    </div>
  </div>

  <!-- ZONA 2: Badge + Título no ponto áureo + Métricas -->
  <div class="cover-z2">
    <div class="cover-eyebrow-badge" style="margin-bottom:32px;width:fit-content">
      ${deal.sector}${val("tipo_operacao") ? " &nbsp;·&nbsp; " + val("tipo_operacao") : ""}
    </div>
    <div class="cover-eyebrow">${isPt ? "OPORTUNIDADE DE INVESTIMENTO · V3 PARTNERS" : "INVESTMENT OPPORTUNITY · V3 PARTNERS"}</div>

    <!-- Cormorant Garamond Italic 600 — exclusivo capa CIM (brandbook V4.2 cap.03) -->
    <div class="cover-title">
      ${deal.target_company.includes("/")
        ? deal.target_company.split("/")[0].trim()
        : deal.target_company}
    </div>

    ${deal.target_company.includes("/") ? `
    <div class="cover-subtitle">${deal.target_company.split("/")[1].trim()}</div>` : ""}

    <div class="cover-location">
      ${deal.sector}${deal.location ? " &nbsp;·&nbsp; " + deal.location : ""}${anosOp ? " &nbsp;·&nbsp; " + anosOp : ""}
    </div>

    <!-- Barra de 4 métricas — dados reais do Supabase -->
    <div class="cover-metrics">
      ${deal.deal_value ? `
      <div class="cover-metric">
        <div class="cover-metric-label">${isPt ? "Valuation" : "Valuation"}</div>
        <div class="cover-metric-value">${formatBRL(deal.deal_value)}</div>
        <div class="cover-metric-sub">${val("tipo_operacao") || (isPt ? "100% das cotas" : "100% stake")}</div>
      </div>` : ""}
      ${receitaReal ? `
      <div class="cover-metric">
        <div class="cover-metric-label">${isPt ? "Receita " + receitaReal.ano : "Revenue " + receitaReal.ano}</div>
        <div class="cover-metric-value">${formatBRL(receitaReal.valor)}</div>
        <div class="cover-metric-sub">${yoy ? "+" + yoy.toFixed(1) + "% YoY" : isPt ? "realizado" : "realized"}</div>
      </div>` : ""}
      ${val("area_construida") ? `
      <div class="cover-metric">
        <div class="cover-metric-label">${isPt ? "Área Construída" : "Built Area"}</div>
        <div class="cover-metric-value">${val("area_construida").replace(" m²","")}<span style="font-size:12px;font-weight:400"> m²</span></div>
        <div class="cover-metric-sub">${isPt ? "GLA atual" : "current GLA"}</div>
      </div>` : ""}
      ${anosOp ? `
      <div class="cover-metric">
        <div class="cover-metric-label">${isPt ? "Operação" : "Operation"}</div>
        <div class="cover-metric-value">${anosOp}</div>
        <div class="cover-metric-sub">${foundingYear ? (isPt ? "Desde " : "Since ") + foundingYear : ""}</div>
      </div>` : sc?.base?.cap_rate ? `
      <div class="cover-metric">
        <div class="cover-metric-label">Cap Rate</div>
        <div class="cover-metric-value">${(sc.base.cap_rate*100).toFixed(1)}%</div>
        <div class="cover-metric-sub">${isPt ? "cenário base" : "base case"}</div>
      </div>` : ""}
    </div>
  </div>

  <!-- ZONA 3: Legal (bottom 30%) -->
  <div class="cover-z3">
    <div class="cover-confidential">
      <div class="cover-confidential-title">${isPt ? "Documento Estritamente Confidencial" : "Strictly Confidential Document"}</div>
      <div class="cover-confidential-text">${isPt
        ? "Este memorando é destinado exclusivamente ao destinatário autorizado e protegido por NDA. A reprodução ou divulgação não autorizada é expressamente proibida."
        : "This memorandum is intended solely for the authorized recipient and is protected by NDA. Unauthorized reproduction or disclosure is expressly prohibited."
      }</div>
    </div>
    <div class="cover-process">
      <div class="cover-process-code">${deal.code ?? ""}</div>
      <div class="cover-process-date">
        V3 Partners · Mesa de M&amp;A<br>
        ${new Date().toLocaleDateString(isPt ? "pt-BR" : "en-US", { month: "long", year: "numeric" })}
      </div>
    </div>
  </div>
</div>

<!-- ═══ 01. SUMÁRIO EXECUTIVO ═══ -->
<div class="section page-break">
  <div class="section-header">
    <div class="section-number">01</div>
    <h2 class="section-title">${isPt ? "Sumário <span>Executivo</span>" : "Executive <span>Summary</span>"}</h2>
  </div>
  <div class="exec-grid">
    <div>
      ${desc.split(/\.\s+/).filter(Boolean).map(p => `<p class="exec-lead">${p}${p.endsWith(".") ? "" : "."}</p>`).slice(0,3).join("")}

      ${te ? `
      <!-- TESE ESTRATÉGICA DE POSICIONAMENTO -->
      <div style="margin-top:24px;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);border-radius:10px;overflow:hidden">
        <div style="background:rgba(201,168,76,0.12);border-bottom:1px solid rgba(201,168,76,0.2);padding:12px 18px;display:flex;align-items:center;gap:10px">
          <div style="width:6px;height:6px;border-radius:50%;background:var(--gold);flex-shrink:0"></div>
          <span style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold)">${isPt ? "Visão Estratégica de Posicionamento" : "Strategic Positioning Vision"}</span>
        </div>
        <div style="padding:16px 18px">
          <p style="font-size:13px;font-weight:600;color:var(--cream);margin-bottom:14px;line-height:1.4">${te.posicionamento ?? ""}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            ${(te.mix_servicos?.length || te.mix_varejo?.length) ? `
            <div>
              ${te.mix_servicos?.length ? `
              <p style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:8px">${isPt ? "Serviços & Âncoras" : "Services & Anchors"}</p>
              <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">
                ${te.mix_servicos.map((s: string) => `<span style="background:rgba(155,175,197,0.1);border:1px solid rgba(155,175,197,0.2);border-radius:4px;padding:2px 8px;font-size:10px;color:var(--muted)">${s}</span>`).join("")}
              </div>` : ""}
              ${te.mix_varejo?.length ? `
              <p style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:8px">${isPt ? "Mix Varejo" : "Retail Mix"}</p>
              <div style="display:flex;flex-wrap:wrap;gap:5px">
                ${te.mix_varejo.map((s: string) => `<span style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);border-radius:4px;padding:2px 8px;font-size:10px;color:var(--gold-light)">${s}</span>`).join("")}
              </div>` : ""}
            </div>` : ""}
            ${(te.diferenciais_estrategicos?.length || te.restricoes_posicionamento?.length || te.comparaveis?.length) ? `
            <div>
              ${te.comparaveis?.length ? `
              <p style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:6px">${isPt ? "Análogos de Mercado" : "Market Comps"}</p>
              <p style="font-size:11px;color:var(--muted);margin-bottom:10px">${te.comparaveis.join(" · ")}</p>` : ""}
              ${te.diferenciais_estrategicos?.length ? `
              <p style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:6px">${isPt ? "Diferenciais" : "Key Differentials"}</p>
              ${te.diferenciais_estrategicos.map((d: string) => `
              <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:5px">
                <span style="color:var(--green-ok);font-size:10px;margin-top:1px;flex-shrink:0">✓</span>
                <span style="font-size:11px;color:var(--muted);line-height:1.4">${d}</span>
              </div>`).join("")}` : ""}
              ${te.restricoes_posicionamento?.length ? `
              <p style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--amber);margin-bottom:6px;margin-top:8px">${isPt ? "Restrições de Posicionamento" : "Positioning Constraints"}</p>
              ${te.restricoes_posicionamento.map((r: string) => `
              <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:5px">
                <span style="color:var(--amber);font-size:10px;margin-top:1px;flex-shrink:0">⚠</span>
                <span style="font-size:11px;color:var(--muted);line-height:1.4">${r}</span>
              </div>`).join("")}` : ""}
            </div>` : ""}
          </div>
        </div>
      </div>` : ""}
    </div>
    <div>
      <div class="info-card">
        <div class="info-card-header">${isPt ? "Ficha do Ativo" : "Asset Summary"}</div>
        ${fichaRows.map(([label, value, cls]) => `
        <div class="info-row">
          <span class="info-label">${label}</span>
          <span class="info-value${cls ? " "+cls : ""}">${value}</span>
        </div>`).join("")}
      </div>
    </div>
  </div>
</div>

<!-- ═══ 02. DESTAQUES DO INVESTIMENTO ═══ -->
<div class="section section-alt page-break">
  <div class="section-header">
    <div class="section-number">02</div>
    <h2 class="section-title">${isPt ? "Destaques do <span>Investimento</span>" : "Investment <span>Highlights</span>"}</h2>
  </div>
  ${kpis.length > 0 ? `
  <div class="kpi-grid${kpis.length <= 3 ? " kpi-grid-3" : ""}">
    ${kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-label">${k!.label}</div>
      <div class="kpi-value">${k!.val}</div>
      <div class="kpi-sub">${k!.sub}</div>
      ${(k as {badge?:string}).badge ? `<div class="kpi-badge">${(k as {badge?:string}).badge}</div>` : ""}
    </div>`).join("")}
  </div>` : ""}
  ${teseArr.length > 0 ? `
  <div class="thesis-grid">
    ${teseArr.map((t, i) => `
    <div class="thesis-item">
      <div class="thesis-num">${String(i+1).padStart(2,"0")}</div>
      <div class="thesis-content">
        <p>${t}</p>
      </div>
    </div>`).join("")}
  </div>` : ""}
</div>

${hasFinanceiro ? `
<!-- ═══ DESEMPENHO FINANCEIRO ═══ -->
<div class="section page-break">
  <div class="section-header">
    <div class="section-number">${secFinanceiro}</div>
    <h2 class="section-title">${isPt ? "Desempenho <span>Financeiro</span>" : "Financial <span>Performance</span>"}</h2>
  </div>
  <div class="fin-grid">
    <div>
      ${receitas.length > 0 ? `
      <div class="info-card">
        <div class="info-card-header">${isPt ? "Receita Anual" : "Annual Revenue"}</div>
        <table class="fin-table" style="padding:16px 20px;display:block">
          ${receitas.sort((a,b) => a.ano - b.ano).map((r, i, arr) => {
            const prev = arr[i-1];
            const growth = prev && r.tipo === "realizado" && prev.tipo === "realizado" ? ((r.valor/prev.valor-1)*100).toFixed(1) : null;
            return `<tr class="${r.tipo !== "realizado" ? "sub-row" : i === arr.filter(x=>x.tipo==="realizado").length - 1 ? "growth" : "sub-row"}">
              <td style="color:${r.tipo!=="realizado" ? "var(--muted)" : "var(--cream)"}${r.tipo!=="realizado" ? ";font-style:italic" : ""}">${r.tipo!=="realizado" ? r.ano+" (proj.)" : "<strong>"+r.ano+"</strong>"}</td>
              <td>${r.tipo !== "realizado" ? "" : growth ? `<span style="color:var(--green-ok)">↑ +${growth}%</span>` : ""}</td>
              <td><strong>${formatBRL(r.valor)}</strong></td>
            </tr>`;
          }).join("")}
        </table>
      </div>` : ""}
    </div>
    <div>
      ${despesas && totalDesp > 0 ? `
      <div class="info-card">
        <div class="info-card-header">${isPt ? "Despesas Operacionais (mensal)" : "Operating Expenses (monthly)"}</div>
        <table class="fin-table" style="padding:16px 20px;display:block">
          ${Object.entries(despesas).sort(([,a],[,b]) => (b as number)-(a as number)).map(([k,v]) => `
          <tr class="sub-row">
            <td>${k.charAt(0).toUpperCase()+k.slice(1).replace(/_/g," ")}</td>
            <td>${formatBRL(v as number)}</td>
          </tr>`).join("")}
          <tr class="total-row">
            <td>${isPt ? "Total despesas operacionais" : "Total operating expenses"}</td>
            <td>${formatBRL(totalDesp)}</td>
          </tr>
        </table>
      </div>` : ""}
    </div>
  </div>
  ${vacancias.length > 0 ? `
  <div class="mt-32">
    <h3 style="font-size:15px;color:var(--white);margin-bottom:16px">${isPt ? "Vacância por Pavimento" : "Vacancy by Floor"}</h3>
    ${vacancias.map(v => `
    <div style="margin-bottom:12px;display:flex;align-items:center;gap:16px">
      <span style="font-size:12px;color:var(--muted);width:120px;text-transform:capitalize">${v.pavimento}</span>
      <div style="flex:1;height:8px;background:var(--navy);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${(v.pct*100).toFixed(0)}%;background:${v.pct>0.5?"var(--red-risk)":v.pct>0.2?"var(--amber)":"var(--green-ok)"};border-radius:4px"></div>
      </div>
      <span style="font-size:13px;font-weight:700;color:${v.pct>0.5?"var(--red-risk)":v.pct>0.2?"var(--amber)":"var(--green-ok)"};width:60px;text-align:right">${(v.pct*100).toFixed(0)}% ${isPt ? "vago" : "vacant"}</span>
    </div>`).join("")}
  </div>` : ""}
</div>` : ""}

${hasCenarios ? `
<!-- ═══ CENÁRIOS DE RETORNO ═══ -->
<div class="section${hasFinanceiro ? "" : " page-break"} section-alt">
  <div class="section-header">
    <div class="section-number">${secCenarios}</div>
    <h2 class="section-title">${isPt ? "Cenários de <span>Retorno</span>" : "Return <span>Scenarios</span>"}</h2>
  </div>
  <div style="display:grid;grid-template-columns:repeat(${cenarios.length},1fr);gap:20px;margin-bottom:32px">
    ${cenarios.map(c => `
    <div class="upside-scenario">
      <div class="upside-header">
        <h3>${c.label}</h3>
        <span class="upside-tag ${c.tagClass}">${c.tag}</span>
      </div>
      <div class="upside-body">
        ${c.metrics.map((m, i) => `
        <div class="upside-metric${i === c.metrics.length-1 ? " highlight" : ""}">
          <span>${m[0]}</span><span>${m[1]}</span>
        </div>`).join("")}
      </div>
    </div>`).join("")}
  </div>
  <div class="exec-highlight">
    <p><strong>${isPt ? "Nota metodológica:" : "Methodology note:"}</strong> ${isPt ? "Os cenários são estimativas baseadas nos dados operacionais reais disponíveis. O NOI real depende de demonstrações financeiras auditadas. Recomendamos solicitar P&L consolidado ao vendedor antes de qualquer LOI vinculativa." : "Scenarios are estimates based on available operational data. Actual NOI depends on audited financial statements. We recommend requesting a consolidated P&L from the seller before any binding LOI."}</p>
  </div>
</div>` : ""}

${hasValuation ? `
<!-- ═══ COMPOSIÇÃO DO VALUATION ═══ -->
<div class="section page-break">
  <div class="section-header">
    <div class="section-number">${secValuation}</div>
    <h2 class="section-title">${isPt ? "Composição do <span>Valuation</span>" : "Valuation <span>Breakdown</span>"}</h2>
  </div>
  ${vb ? `
  <p style="color:var(--muted);font-size:13px;margin-bottom:24px;line-height:1.7">
    ${isPt
      ? "Análise V3 Partners — valuation decomposto por componente com probabilidade de realização ponderada. Valores do vendedor reproduzidos para transparência; validação por laudo independente obrigatória antes de qualquer LOI vinculante."
      : "V3 Partners analysis — valuation decomposed by component with weighted probability of realization. Seller values reproduced for transparency; independent appraisal required before any binding LOI."}
  </p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px">
    <div>
      <table class="tenant-table">
        <thead><tr>
          <th>${isPt ? "Componente" : "Component"}</th>
          <th>${isPt ? "Valor Pedido" : "Asking Value"}</th>
          <th>${isPt ? "Esperado V3" : "V3 Expected"}</th>
          <th>Status</th>
        </tr></thead>
        <tbody>
          ${vb.ativo_imobiliario_principal ? `
          <tr>
            <td style="color:var(--cream);font-weight:600">${isPt ? "Ativo imobiliário (prédio + terreno)" : "Real estate asset (building + land)"}</td>
            <td style="color:var(--cream);font-weight:600">${formatBRL(vb.ativo_imobiliario_principal.valor_vendedor)}</td>
            <td style="color:var(--cream);font-weight:600">${formatBRL(vb.ativo_imobiliario_principal.valor_vendedor)}</td>
            <td><span class="status-badge status-indet">${isPt ? "Validar laudo" : "Validate appraisal"}</span></td>
          </tr>` : ""}
          ${vb.aco_estrutural_expansao ? `
          <tr>
            <td style="color:var(--cream)">${isPt ? "Aço estrutural +4 andares" : "Structural steel +4 floors"}</td>
            <td>${formatBRL(vb.aco_estrutural_expansao.valor_vendedor)}</td>
            <td>${formatBRL(vb.aco_estrutural_expansao.valor_vendedor)}</td>
            <td><span class="status-badge status-indet">${isPt ? "Confirmar fisicamente" : "Physically confirm"}</span></td>
          </tr>` : ""}
          ${vb.fundo_de_comercio ? `
          <tr>
            <td style="color:var(--cream)">${isPt ? "Fundo de comércio (1º shopping do Brasil)" : "Goodwill (1st Brazilian mall)"}</td>
            <td>${formatBRL(vb.fundo_de_comercio.valor_vendedor)}</td>
            <td style="color:var(--amber)">${formatBRL(vb.fundo_de_comercio.valor_vendedor / 2)}</td>
            <td><span class="status-badge status-indet">${isPt ? "Subjetivo — negociável" : "Subjective — negotiable"}</span></td>
          </tr>` : ""}
          ${vb.imoveis_penhorados_total ? `
          <tr style="background:rgba(76,175,125,0.04)">
            <td style="color:var(--green-ok);font-weight:600">${isPt ? "6 imóveis penhorados (Tijuca + Barra)" : "6 seized properties (Tijuca + Barra)"}</td>
            <td style="color:var(--green-ok)">${formatBRL(vb.imoveis_penhorados_total.valor_face_total)}</td>
            <td style="color:var(--green-ok);font-weight:700">${formatBRL(vb.imoveis_penhorados_total.valor_esperado_ponderado)}</td>
            <td><span class="status-badge status-active">${isPt ? "Ativo real" : "Real asset"}</span></td>
          </tr>` : ""}
          ${vb.creditos_judiciais_total ? `
          <tr>
            <td style="color:var(--cream)">${isPt ? "Créditos judiciais (Americanas + ICMS)" : "Judicial credits (Americanas + ICMS)"}</td>
            <td style="color:var(--amber)">${formatBRL(vb.creditos_judiciais_total.valor_face_total)}</td>
            <td style="color:var(--amber)">${formatBRL(vb.creditos_judiciais_total.valor_esperado_ponderado)}</td>
            <td><span class="status-badge status-vacant">${isPt ? "Risco judicial" : "Judicial risk"}</span></td>
          </tr>` : ""}
          ${vb.passivo_iptu ? `
          <tr style="border-top:1px solid rgba(224,85,85,0.3)">
            <td style="color:var(--red-risk)">${isPt ? "(-) IPTU Concilia Rio" : "(-) Municipal tax IPTU"}</td>
            <td style="color:var(--red-risk)">(${formatBRL(Math.abs(vb.passivo_iptu.valor))})</td>
            <td style="color:var(--red-risk)">(${formatBRL(Math.abs(vb.passivo_iptu.valor))})</td>
            <td><span class="status-badge status-vacant">${isPt ? "Ônus fiscal" : "Tax lien"}</span></td>
          </tr>` : ""}
          <tr style="border-top:2px solid rgba(201,168,76,0.4)">
            <td style="color:var(--gold);font-weight:700;font-size:14px">${isPt ? "TOTAL" : "TOTAL"}</td>
            <td style="color:var(--gold);font-weight:700;font-size:16px">${deal.deal_value ? formatBRL(deal.deal_value) : "—"}</td>
            <td style="color:var(--gold);font-weight:700;font-size:16px">${vb.total_valor_esperado_v3?.subtotal_com_fundo_comercio_50pct ? formatBRL(vb.total_valor_esperado_v3.subtotal_com_fundo_comercio_50pct) : "—"}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="exec-highlight">
        <p><strong>${isPt ? "Visão V3 sobre o valuation:" : "V3 view on valuation:"}</strong> ${vb.total_valor_esperado_v3?.nota ?? (isPt ? "Análise V3 indica gap entre valuation pedido e valor esperado ponderado. Negociação deve focar no fundo de comércio e nos créditos judiciais contra Americanas." : "V3 analysis indicates gap between asking valuation and weighted expected value. Negotiation should focus on goodwill and judicial credits against Americanas.")}</p>
      </div>
      ${imovelPenhorados.length > 0 ? `
      <div class="info-card">
        <div class="info-card-header">${isPt ? "Imóveis Penhorados — Ativos Reais" : "Seized Properties — Real Assets"}</div>
        ${imovelPenhorados.map(ip => `
        <div class="info-row">
          <span class="info-label">${ip.origem} · ${ip.qtd_imoveis} ${isPt ? "imóvel(is)" : "property(ies)"} · ${ip.localizacao}</span>
          <span class="info-value green">${formatBRL(ip.valor_esperado)} <span style="font-size:10px;color:var(--muted)">(${(ip.probabilidade_realizacao*100).toFixed(0)}%)</span></span>
        </div>`).join("")}
        <div class="info-row" style="border-top:1px solid rgba(76,175,125,0.3)">
          <span class="info-label" style="color:var(--cream);font-weight:600">${isPt ? "Total esperado ponderado" : "Total weighted expected"}</span>
          <span class="info-value green">${formatBRL(imovelPenhorados.reduce((s,ip) => s + ip.valor_esperado, 0))}</span>
        </div>
      </div>` : ""}
    </div>
  </div>` : ""}
</div>` : ""}

<!-- ═══ FATORES DE RISCO ═══ -->
<div class="section page-break">
  <div class="section-header">
    <div class="section-number">${secRiscos}</div>
    <h2 class="section-title">${isPt ? "Fatores de <span>Risco</span>" : "Risk <span>Factors</span>"}</h2>
  </div>
  ${riscos.length > 0 ? `
  <table class="risk-table">
    <thead><tr>
      <th>${isPt ? "Risco" : "Risk"}</th>
      <th>${isPt ? "Nível" : "Level"}</th>
      <th>${isPt ? "Descrição" : "Description"}</th>
      <th>${isPt ? "Mitigação" : "Mitigation"}</th>
    </tr></thead>
    <tbody>
      ${riscos.map(r => `
      <tr>
        <td style="color:var(--cream);font-weight:600">${r.descricao.split("–")[0].split(":")[0].trim().substring(0,50)}</td>
        <td><span class="risk-badge ${nivelClass(r.nivel)}">${r.nivel.toUpperCase()}</span></td>
        <td style="color:var(--muted)">${r.descricao}</td>
        <td style="color:var(--muted)">${r.mitigacao}</td>
      </tr>`).join("")}
    </tbody>
  </table>` : `<p style="color:var(--muted);font-size:13px">${isPt ? "Análise de risco disponível no data room após NDA." : "Risk analysis available in data room after NDA."}</p>`}
</div>

<!-- ═══ ESTRUTURA DA TRANSAÇÃO ═══ -->
<div class="section section-alt page-break">
  <div class="section-header">
    <div class="section-number">${secEstrutura}</div>
    <h2 class="section-title">${isPt ? "Estrutura da <span>Transação</span>" : "Transaction <span>Structure</span>"}</h2>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px">
    <div>
      <h3 style="font-size:15px;color:var(--white);margin-bottom:16px">${isPt ? "Parâmetros da Operação" : "Transaction Parameters"}</h3>
      <div class="info-card">
        ${val("tipo_operacao") ? `<div class="info-row"><span class="info-label">${isPt?"Tipo de operação":"Transaction type"}</span><span class="info-value">${val("tipo_operacao")}</span></div>` : ""}
        ${deal.deal_value ? `<div class="info-row"><span class="info-label">${isPt?"Valuation pedido":"Asking valuation"}</span><span class="info-value gold">${formatBRL(deal.deal_value)}</span></div>` : ""}
        ${val("divida_total") ? `<div class="info-row"><span class="info-label">${isPt?"Passivo":"Liability"}</span><span class="info-value amber">${val("divida_total")}</span></div>` : ""}
        ${val("processos_judiciais") ? `<div class="info-row"><span class="info-label">${isPt?"Processos judiciais":"Litigation"}</span><span class="info-value ${val("processos_judiciais").toLowerCase().includes("sem") ? "green" : "amber"}">${val("processos_judiciais")}</span></div>` : ""}
        ${deal.code ? `<div class="info-row"><span class="info-label">${isPt?"Processo V3":"V3 Process"}</span><span class="info-value">${deal.code}</span></div>` : ""}
      </div>
    </div>
    <div>
      <h3 style="font-size:15px;color:var(--white);margin-bottom:16px">${isPt ? "Próximos Passos Recomendados" : "Recommended Next Steps"}</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${[
          [isPt ? "Data Room" : "Data Room", isPt ? "Solicitar acesso ao data room: DRE auditada 3 anos, contratos de locação, matrículas e certidões negativas." : "Request data room access: 3-year audited P&L, lease contracts, registrations and negative certificates."],
          [isPt ? "Laudo de Avaliação" : "Valuation Report", isPt ? "Contratar avaliador independente (MRICS) para emissão de laudo imobiliário formal com comparativos de mercado." : "Hire independent appraiser (MRICS) for formal real estate appraisal with market comparables."],
          [isPt ? "Due Diligence Jurídica" : "Legal Due Diligence", isPt ? "Verificar natureza das pendências declaradas, certidões de ônus reais e status do regime tributário." : "Verify declared liabilities, encumbrance certificates and tax regime status."],
          [isPt ? "LOI Não-Vinculante" : "Non-Binding LOI", isPt ? "Emitir Letter of Intent com valuation indicativo sujeito a due diligence, prazo e condições suspensivas." : "Issue Letter of Intent with indicative valuation subject to due diligence, timeline and conditions."],
          [isPt ? "SPA e Closing" : "SPA & Closing", isPt ? "Estruturar SPA com mecanismos de price adjustment baseados em EBITDA verificado e taxa de ocupação." : "Structure SPA with price adjustment mechanisms based on verified EBITDA and occupancy rate."],
        ].map(([label, desc], i) => `
        <div style="display:flex;gap:12px;align-items:flex-start">
          <div style="width:28px;height:28px;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--gold);flex-shrink:0">${String(i+1).padStart(2,"0")}</div>
          <div>
            <p style="font-size:13px;color:var(--cream);font-weight:600">${label}</p>
            <p style="font-size:12px;color:var(--muted)">${desc}</p>
          </div>
        </div>`).join("")}
      </div>
    </div>
  </div>
</div>

<!-- ═══ FOOTER ═══ -->
<div class="doc-footer">
  <div class="footer-logo">
    <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners">
  </div>
  <div class="footer-info">
    <strong style="color:var(--cream)">V3 Partners · Mesa de M&A</strong><br>
    Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro · RJ<br>
    <a href="https://v3partners.com.br">v3partners.com.br</a> · <span style="color:var(--gold)">joao.lemos@v3partners.com.br</span>
  </div>
  <div class="footer-ref">
    <strong>${deal.code ?? "V3 Partners"}</strong>
    CIM · ${new Date().toLocaleDateString(isPt ? "pt-BR" : "en-US", { month: "long", year: "numeric" })}<br>
    ${isPt ? "Documento Confidencial — NDA Exigido" : "Confidential Document — NDA Required"}
    ${investor ? `<br><span style="font-size:10px;color:var(--muted)">${isPt ? "Emitido para" : "Issued to"}: ${investor.name}${investor.company ? " · " + investor.company : ""}</span>` : ""}
  </div>
</div>

${investor ? `
<!-- WATERMARK OCULTA EM TELA, VISÍVEL APENAS EM PRINT -->
<div class="v3-watermark" style="display:none">
  CONFIDENCIAL · ${investor.name.toUpperCase()}${investor.company ? " · " + investor.company.toUpperCase() : ""} · ${new Date().toLocaleDateString("pt-BR")}
</div>

<script>
(function() {
  var printed = false;
  function registerPrint() {
    if (printed) return;
    printed = true;
    fetch('/api/investor/vdr/${investor.token}/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        doc_type: 'cim',
        deal_id:  '${deal.id}',
        deal_code: '${deal.code ?? ""}',
        timestamp: new Date().toISOString()
      })
    });
  }
  window.addEventListener('beforeprint', registerPrint);
  if (window.matchMedia) {
    window.matchMedia('print').addEventListener('change', function(e) {
      if (e.matches) registerPrint();
    });
  }
})();
<\/script>` : ""}

</body></html>`;
}

// ── TEASER CEGO ──────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTeaser(deal: any, lang: string): string {
  const ad = deal.asset_data ?? {};
  const isPt = lang === "pt-br";
  const forja = getForjaData(ad);

  // Descrição cega: preferência FORJA narrative → legado curto
  const desc = isPt
    ? (forja.narrative_pt || ad.teaser_ptbr || ad.descricao_ptbr || "")
    : (forja.narrative_en || ad.teaser_en || ad.descricao_en || "");

  // Tese: FORJA array → legado string
  const tese = forja.tese.length > 0
    ? forja.tese
    : isPt ? (ad.tese_investimento ?? "") : (ad.tese_investimento_en ?? ad.tese_investimento ?? "");

  // Região CEGA: apenas estado/UF
  const loc = (deal.location ?? "") as string;
  const regiaoBlind = (() => {
    const ufMatch = loc.match(/\b([A-Z]{2})\b/);
    if (ufMatch) return ufMatch[1];
    const estado = loc.match(/(Rio de Janeiro|São Paulo|Minas Gerais|Bahia|Paraná|Rio Grande do Sul|Pernambuco|Ceará|Goiás|Mato Grosso)/i);
    if (estado) return estado[0];
    const parts = loc.split(/[-·,\s]+/).filter(Boolean);
    return parts[parts.length - 1] ?? "Brasil";
  })();

  const metricas: { label: string; value: string; sub?: string }[] = ad.metricas ?? [];
  const diferenciais: string[] = ad.diferenciais ?? [];

  const t = isPt ? {
    teaser: "TEASER CEGO — OPORTUNIDADE M&A",
    oport: "Oportunidade de Aquisição",
    tese: "Tese de Investimento",
    metricas: "Métricas-Chave",
    difer: "Diferenciais",
    nda: "Mais informações disponíveis mediante NDA assinado.",
    ndaBtn: "Solicitar NDA e CIM Completo",
    aviso: "Documento confidencial. Destinado exclusivamente a investidores qualificados.",
    setor: "Setor",
    locRegiao: "Região",
    deal: "Valor do Deal",
    multiplo: "Múltiplo EBITDA",
  } : {
    teaser: "BLIND TEASER — M&A OPPORTUNITY",
    oport: "Acquisition Opportunity",
    tese: "Investment Thesis",
    metricas: "Key Metrics",
    difer: "Competitive Advantages",
    nda: "Full details available upon signed NDA.",
    ndaBtn: "Request NDA & Full CIM",
    aviso: "Confidential document. Intended solely for qualified investors.",
    setor: "Sector",
    locRegiao: "Region",
    deal: "Deal Value",
    multiplo: "EBITDA Multiple",
  };

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8">
<title>Teaser — ${deal.sector}</title>
<link href="${FONT}" rel="stylesheet">
<style>
${CSS_BASE}
@page{size:A4 portrait;margin:0}
body{background:#060515;padding:40px 0;display:flex;justify-content:center;min-height:100vh}
/* A4 exato em tela: 794px × 1123px */
.wrap{
  width:794px;height:1123px;
  padding:52px 60px;
  background:linear-gradient(155deg,#09081A 55%,#111F35 100%);
  display:flex;flex-direction:column;
  border:1px solid rgba(201,168,76,0.18);
  box-shadow:0 2px 0 0 rgba(201,168,76,0.4),0 8px 48px rgba(0,0,0,0.8);
  overflow:hidden;position:relative;
}
.wrap::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#C9A84C,#E8C97A 50%,#C9A84C,transparent)}
@media print{
  body{padding:0!important;}
  .wrap{
    width:210mm!important;height:297mm!important;
    padding:14mm 18mm!important;
    box-shadow:none!important;border:none!important;
    overflow:visible!important;
  }
  .wrap::before{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:48px}
.logo-box{display:inline-block}
.v3-name{font-size:12px;font-weight:700;color:#F0ECE4;margin-left:10px}
.badge-conf{font-size:9px;font-weight:700;letter-spacing:3px;color:#C9A84C;border:1px solid #C9A84C33;padding:5px 12px;border-radius:4px}
.bar{height:2px;background:linear-gradient(90deg,#C9A84C,#E8C97A,transparent);border-radius:2px;margin-bottom:36px}
.hero-label{font-size:9px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#C9A84C;margin-bottom:10px}
.hero-title{font-size:36px;font-weight:800;color:#F0ECE4;line-height:1.1;margin-bottom:8px}
.hero-sub{font-size:14px;color:#7A8FA8;margin-bottom:36px}
.meta-row{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:36px}
.meta-item p:first-child{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:4px}
.meta-item p:last-child{font-size:18px;font-weight:800;color:#F0ECE4}
.tese{background:#162744;border:1px solid #243A66;border-left:3px solid #C9A84C;border-radius:0 8px 8px 0;padding:18px 22px;margin-bottom:28px}
.tese p{font-size:12px;color:#7A8FA8;line-height:1.7}
.metrics-row{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:28px}
.metric-box{background:#162744;border:1px solid #243A66;border-radius:8px;padding:16px;border-top:2px solid #C9A84C}
.metric-box .label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:4px}
.metric-box .val{font-size:20px;font-weight:800;color:#E8C97A}
.metric-box .sub{font-size:10px;color:#7A8FA8;margin-top:2px}
.diff-list{list-style:none;margin-bottom:32px}
.diff-list li{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #243A6650}
.diff-list li:last-child{border:none}
.diff-list li::before{content:"";width:5px;height:5px;background:#C9A84C;border-radius:50%;margin-top:6px;flex-shrink:0}
.diff-list li span{font-size:12px;color:#7A8FA8;line-height:1.5}
.nda-box{background:#162744;border:1px solid #C9A84C33;border-radius:10px;padding:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:auto}
.nda-box p:first-child{font-size:12px;font-weight:600;color:#F0ECE4}
.nda-box p:last-child{font-size:10px;color:#7A8FA8;margin-top:2px}
.nda-btn{background:linear-gradient(135deg,#C9A84C,#E8C97A);color:#09081A;font-size:11px;font-weight:700;padding:10px 18px;border-radius:8px;text-decoration:none;white-space:nowrap;flex-shrink:0}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #243A66;display:flex;justify-content:space-between;align-items:center}
.footer p{font-size:10px;color:#7A8FA8}
</style>
</head><body>
<div class="wrap">
  <div class="top">
    <div style="display:flex;align-items:center;gap:10px">
      <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:40px;width:auto;">
      <span class="v3-name">V3 Partners</span>
    </div>
    <span class="badge-conf">${t.teaser}</span>
  </div>
  <div class="bar"></div>
  <p class="hero-label">${t.oport}</p>
  <h1 class="hero-title">${deal.sector}</h1>
  <p class="hero-sub">${regiaoBlind} · ${deal.deal_value ? formatBRL(deal.deal_value) : ""}</p>
  <div class="meta-row">
    ${deal.deal_value ? `<div class="meta-item"><p>${t.deal}</p><p>${formatBRL(deal.deal_value)}</p></div>` : ""}
    ${deal.ebitda_multiple ? `<div class="meta-item"><p>${t.multiplo}</p><p>${deal.ebitda_multiple}x</p></div>` : ""}
    <div class="meta-item"><p>${isPt ? "Região" : "Region"}</p><p>${regiaoBlind}</p></div>
  </div>
  ${(Array.isArray(tese) ? tese.length > 0 : !!tese) ? `
  <p class="label" style="margin-bottom:10px">${t.tese}</p>
  <div class="tese">
    ${renderTese(tese, "font-size:11px;color:#C4CDD8;line-height:1.7")}
  </div>` : ""}
  ${desc ? `<p style="font-size:11px;color:#7A8FA8;line-height:1.75;margin-bottom:20px;border-left:2px solid rgba(201,168,76,0.3);padding-left:12px;">${desc.slice(0, 500)}${desc.length > 500 ? "..." : ""}</p>` : ""}
  ${metricas.length > 0 ? `
  <p class="label" style="margin-bottom:12px">${t.metricas}</p>
  <div class="metrics-row">
    ${metricas.map(m => `<div class="metric-box"><p class="label">${m.label}</p><p class="val">${m.value}</p>${m.sub ? `<p class="sub">${m.sub}</p>` : ""}</div>`).join("")}
  </div>` : ""}
  ${diferenciais.length > 0 ? `
  <p class="label" style="margin-bottom:12px">${t.difer}</p>
  <ul class="diff-list">
    ${diferenciais.map(d => `<li><span>${d}</span></li>`).join("")}
  </ul>` : ""}
  ${!desc && !metricas.length && !diferenciais.length && !(Array.isArray(tese) ? tese.length > 0 : !!tese) ? `
  <div style="background:#162744;border:1px solid #243A66;border-radius:8px;padding:20px;margin-bottom:24px;">
    <p style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px">Ativo em Análise</p>
    <p style="font-size:12px;color:#7A8FA8;line-height:1.7">
      ${isPt
        ? `Oportunidade no setor de ${deal.sector ?? "M&A"} com valor de ${deal.deal_value ? formatBRL(deal.deal_value) : "a confirmar"}. Execute o FORJA para gerar a narrativa completa e a tese de investimento.`
        : `${deal.sector ?? "M&A"} sector opportunity valued at ${deal.deal_value ? formatBRL(deal.deal_value) : "TBD"}. Run FORJA analysis to generate the full investment narrative.`
      }
    </p>
  </div>` : ""}
  <div class="nda-box">
    <div>
      <p>${t.nda}</p>
      <p>${t.aviso}</p>
    </div>
    <span class="nda-btn">${t.ndaBtn}</span>
  </div>
  <div class="footer">
    <p>V3 Partners — v3partners.com.br</p>
    <p>${t.aviso}</p>
  </div>
</div>
</body></html>`;
}

// ── LINKEDIN POST 1080×1350 ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildLinkedInPost(deal: any, lang: string): string {
  const ad = deal.asset_data ?? {};
  const isPt = lang === "pt-br";
  const metricas: { label: string; value: string; sub?: string }[] = (ad.metricas ?? []).slice(0, 4);
  const tese = isPt ? (ad.tese_investimento ?? "") : (ad.tese_investimento_en ?? ad.tese_investimento ?? "");

  const t = isPt ? {
    tag: "OPORTUNIDADE M&A",
    cta: "Solicite o CIM completo",
    aviso: "Confidencial · NDA Requerido",
    setor: deal.sector,
    deal: "Valor do Deal",
  } : {
    tag: "M&A OPPORTUNITY",
    cta: "Request the full CIM",
    aviso: "Confidential · NDA Required",
    setor: deal.sector,
    deal: "Deal Value",
  };

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8">
<title>LinkedIn Post — ${deal.target_company}</title>
<link href="${FONT}" rel="stylesheet">
<style>
${CSS_BASE}
/* Canvas social media: 1080×1350px (proporção 4:5 LinkedIn) */
html,body{width:1080px;height:1350px;overflow:hidden;margin:0;padding:0}
body{background:#09081A;display:flex;align-items:stretch}
.wrap{flex:1;background:linear-gradient(160deg,#09081A 40%,#111F35);padding:72px 80px;display:flex;flex-direction:column;position:relative;overflow:hidden}
@page{size:A4 portrait;margin:0}
@media print{
  html,body{width:210mm!important;height:297mm!important;overflow:hidden!important;}
  body{display:flex!important;align-items:stretch!important;}
  .wrap{width:100%!important;height:100%!important;flex:1!important;padding:54px 60px!important;}
}
.wrap::before{content:"";position:absolute;top:-200px;right:-200px;width:600px;height:600px;background:radial-gradient(circle,#C9A84C08 0%,transparent 70%)}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:56px}
.logo{display:flex;align-items:center;gap:12px}
.logo-box{display:inline-block}
.logo-name{font-size:15px;font-weight:700;color:#F0ECE4}
.badge{font-size:10px;font-weight:700;letter-spacing:3px;color:#C9A84C;border:1px solid #C9A84C44;padding:6px 16px;border-radius:5px}
.bar{height:2px;background:linear-gradient(90deg,#C9A84C,#E8C97A,transparent);margin-bottom:44px}
.hero-tag{font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#C9A84C;margin-bottom:14px}
.hero-title{font-size:52px;font-weight:800;color:#F0ECE4;line-height:1.05;margin-bottom:12px}
.hero-sub{font-size:16px;color:#7A8FA8;margin-bottom:40px}
.tese{font-size:15px;color:#7A8FA8;line-height:1.65;margin-bottom:40px;padding-left:16px;border-left:3px solid #C9A84C}
.metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:auto}
.metric{background:#162744;border:1px solid #243A66;border-radius:12px;padding:22px;border-top:3px solid #C9A84C}
.metric .label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px}
.metric .val{font-size:28px;font-weight:800;color:#E8C97A;line-height:1}
.metric .sub{font-size:11px;color:#7A8FA8;margin-top:4px}
.footer{padding-top:28px;border-top:1px solid #243A66;display:flex;align-items:center;justify-content:space-between}
.cta{font-size:12px;font-weight:700;color:#C9A84C}
.url{font-size:11px;color:#7A8FA8}
</style>
</head><body>
<div class="wrap">
  <div class="top">
    <div class="logo">
      <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:48px;width:auto;">
      <span class="logo-name">V3 Partners</span>
    </div>
    <span class="badge">${t.tag}</span>
  </div>
  <div class="bar"></div>
  <p class="hero-tag">${t.setor}</p>
  <h1 class="hero-title">${deal.sector}</h1>
  <p class="hero-sub">${deal.location ?? "Brasil"} · ${deal.deal_value ? formatBRL(deal.deal_value) : ""}</p>
  ${tese ? `<p class="tese">${tese.substring(0, 220)}${tese.length > 220 ? "..." : ""}</p>` : ""}
  ${metricas.length > 0 ? `
  <div class="metrics">
    ${metricas.map(m => `
    <div class="metric">
      <p class="label">${m.label}</p>
      <p class="val">${m.value}</p>
      ${m.sub ? `<p class="sub">${m.sub}</p>` : ""}
    </div>`).join("")}
  </div>` : ""}
  <div class="footer">
    <p class="cta">${t.cta} →</p>
    <p class="url">v3partners.com.br</p>
  </div>
</div>
</body></html>`;
}

// ── LINKEDIN STORY 1080×1920 ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildLinkedInStory(deal: any, lang: string): string {
  const ad = deal.asset_data ?? {};
  const isPt = lang === "pt-br";
  const metricas: { label: string; value: string; sub?: string }[] = (ad.metricas ?? []).slice(0, 4);
  const diferenciais: string[] = (ad.diferenciais ?? []).slice(0, 3);

  const t = isPt ? {
    tag: "OPORTUNIDADE M&A",
    difer: "POR QUE ESTE ATIVO?",
    cta: "Solicite o CIM",
    url: "v3partners.com.br",
    aviso: "Confidencial · NDA Requerido",
    deal: "Valor do Deal",
  } : {
    tag: "M&A OPPORTUNITY",
    difer: "WHY THIS ASSET?",
    cta: "Request the CIM",
    url: "v3partners.com.br",
    aviso: "Confidential · NDA Required",
    deal: "Deal Value",
  };

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8">
<title>LinkedIn Story — ${deal.target_company}</title>
<link href="${FONT}" rel="stylesheet">
<style>
${CSS_BASE}
/* Canvas social media: 1080×1920px (proporção 9:16 LinkedIn Story) */
html,body{width:1080px;height:1920px;overflow:hidden;margin:0;padding:0}
body{background:#09081A}
.wrap{width:1080px;height:1920px;background:linear-gradient(190deg,#09081A 30%,#111F35 70%,#162744);padding:100px 80px;display:flex;flex-direction:column;position:relative;overflow:hidden}
@page{size:A4 portrait;margin:0}
@media print{
  html,body{width:210mm!important;height:297mm!important;overflow:hidden!important;}
  .wrap{width:100%!important;height:100%!important;padding:72px 56px!important;}
  .glow,.glow2{display:none!important;}
}
.glow{position:absolute;top:0;left:50%;transform:translateX(-50%);width:700px;height:700px;background:radial-gradient(circle,#C9A84C0A 0%,transparent 70%);pointer-events:none}
.glow2{position:absolute;bottom:0;right:0;width:500px;height:500px;background:radial-gradient(circle,#C9A84C06 0%,transparent 70%);pointer-events:none}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:80px}
.logo-box{display:inline-block}
.logo-name{font-size:17px;font-weight:700;color:#F0ECE4;margin-left:14px}
.badge{font-size:10px;font-weight:700;letter-spacing:3px;color:#C9A84C;border:1px solid #C9A84C44;padding:8px 18px;border-radius:5px}
.bar{height:3px;background:linear-gradient(90deg,#C9A84C,#E8C97A,transparent);border-radius:2px;margin-bottom:60px}
.hero-tag{font-size:11px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:#C9A84C;margin-bottom:18px}
.hero-title{font-size:68px;font-weight:800;color:#F0ECE4;line-height:1;margin-bottom:18px}
.hero-sub{font-size:20px;color:#7A8FA8;margin-bottom:60px}
.metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-bottom:52px}
.metric{background:#162744cc;border:1px solid #243A66;border-radius:14px;padding:26px;border-top:3px solid #C9A84C}
.metric .label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px}
.metric .val{font-size:32px;font-weight:800;color:#E8C97A;line-height:1}
.metric .sub{font-size:12px;color:#7A8FA8;margin-top:5px}
.difer-label{font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#C9A84C;margin-bottom:20px}
.difer-item{display:flex;align-items:flex-start;gap:14px;padding:16px;background:#162744aa;border:1px solid #243A6680;border-radius:10px;margin-bottom:12px}
.difer-item::before{content:"";width:6px;height:6px;background:#C9A84C;border-radius:50%;margin-top:6px;flex-shrink:0}
.difer-item span{font-size:14px;color:#7A8FA8;line-height:1.5}
.cta-box{margin-top:auto;background:linear-gradient(135deg,#162744,#243A66);border:1px solid #C9A84C44;border-radius:14px;padding:28px;display:flex;align-items:center;justify-content:space-between}
.cta-text p:first-child{font-size:15px;font-weight:700;color:#F0ECE4}
.cta-text p:last-child{font-size:12px;color:#7A8FA8;margin-top:3px}
.cta-btn{background:linear-gradient(135deg,#C9A84C,#E8C97A);color:#09081A;font-size:13px;font-weight:800;padding:14px 24px;border-radius:10px;text-align:center;white-space:nowrap}
</style>
</head><body>
<div class="wrap">
  <div class="glow"></div>
  <div class="glow2"></div>
  <div class="top">
    <div style="display:flex;align-items:center;gap:14px">
      <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:56px;width:auto;">
      <span class="logo-name">V3 Partners</span>
    </div>
    <span class="badge">${t.tag}</span>
  </div>
  <div class="bar"></div>
  <p class="hero-tag">${deal.sector}</p>
  <h1 class="hero-title">${deal.deal_value ? formatBRL(deal.deal_value) : "Deal"}</h1>
  <p class="hero-sub">${deal.location ?? "Brasil"}</p>
  ${metricas.length > 0 ? `
  <div class="metrics">
    ${metricas.map(m => `
    <div class="metric">
      <p class="label">${m.label}</p>
      <p class="val">${m.value}</p>
      ${m.sub ? `<p class="sub">${m.sub}</p>` : ""}
    </div>`).join("")}
  </div>` : ""}
  ${diferenciais.length > 0 ? `
  <p class="difer-label">${t.difer}</p>
  ${diferenciais.map(d => `<div class="difer-item"><span>${d}</span></div>`).join("")}` : ""}
  <div class="cta-box">
    <div class="cta-text">
      <p>${t.cta} completo</p>
      <p>${t.aviso}</p>
    </div>
    <div class="cta-btn">${t.url}</div>
  </div>
</div>
</body></html>`;
}

function injectFormat(html: string, format: string, type: string): string {
  const isLinkedIn = type.startsWith("linkedin");

  if (format === "pdf") {
    // Aguarda 800ms para garantir carregamento das fontes antes de disparar o print
    const script = `<script>window.onload=function(){setTimeout(function(){window.print();},800);}<\/script>`;

    // CRÍTICO: não adicionar padding-top no LinkedIn (overflow:hidden corta o conteúdo)
    const bodyPadding = isLinkedIn ? "" : "body{padding-top:48px!important;}";

    const style = `<style>
      @media screen{
        .fmt-bar{
          display:flex;align-items:center;justify-content:space-between;gap:12px;
          background:#C9A84C;color:#09081A;
          padding:12px 20px;
          font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:700;
          position:fixed;top:0;left:0;right:0;z-index:99999;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
        }
        .fmt-bar .fmt-steps{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .fmt-bar .fmt-step{
          background:rgba(0,0,0,0.15);border-radius:4px;
          padding:3px 8px;font-size:10px;font-weight:700;
        }
        .fmt-bar button{
          background:#09081A;color:#C9A84C;border:none;
          padding:8px 16px;border-radius:6px;font-weight:700;
          cursor:pointer;font-size:11px;white-space:nowrap;flex-shrink:0;
        }
        ${bodyPadding}
      }
      @media print{
        .fmt-bar{display:none!important;}
        html,body{
          -webkit-print-color-adjust:exact!important;
          print-color-adjust:exact!important;
          padding:0!important;margin:0!important;
        }
      }
    <\/style>`;

    // Instrução completa e clara — o passo "Gráficos de fundo" é obrigatório para fundos navy
    const banner = `<div class="fmt-bar">
      <div class="fmt-steps">
        <span>Salvar como PDF:</span>
        <span class="fmt-step">1. Ctrl+P</span>
        <span class="fmt-step">2. Mais configurações</span>
        <span class="fmt-step">3. ✅ Gráficos de fundo</span>
        <span class="fmt-step">4. Margens: Nenhuma</span>
        <span class="fmt-step">5. Salvar como PDF</span>
      </div>
      <button onclick="window.print()">🖨️ Imprimir / PDF</button>
    </div>`;

    return html.replace("</head>", style + script + "</head>").replace("<body>", `<body>${banner}`);
  }

  if (format === "jpg" || format === "jpeg") {
    const bodyPadding = isLinkedIn ? "" : "body{padding-top:48px!important;}";
    const sizeLabel = type === "linkedin_story" ? "1080×1920 px" : type === "linkedin_post" ? "1080×1350 px" : "794×1123 px";

    const style = `<style>
      @media screen{
        .fmt-bar{
          display:flex;align-items:center;gap:10px;
          background:#162744;color:#F0ECE4;
          padding:10px 20px;
          font-family:'DM Sans',Arial,sans-serif;font-size:11px;
          position:fixed;top:0;left:0;right:0;z-index:99999;
          border-bottom:2px solid #C9A84C;
        }
        .fmt-bar strong{color:#C9A84C;}
        .fmt-bar code{background:#09081A;padding:2px 6px;border-radius:4px;font-size:10px;color:#E8C97A;}
        ${bodyPadding}
      }
    <\/style>`;

    const banner = `<div class="fmt-bar">
      🖼️ JPEG <strong>${sizeLabel}</strong> →
      Chrome: <code>F12</code> → <code>Ctrl+Shift+P</code> → digita <strong>"screenshot"</strong> → <code>Capture full size screenshot</code>
    </div>`;

    return html.replace("</head>", style + "</head>").replace("<body>", `<body>${banner}`);
  }

  return html;
}

type InvestorInfo = { name: string; email: string; company: string | null; token: string };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dealId    = searchParams.get("dealId");
  const type      = searchParams.get("type") ?? "cim";
  const lang      = searchParams.get("lang") ?? "pt-br";
  const format    = searchParams.get("format") ?? "";
  const vdrToken  = searchParams.get("vdr_token") ?? "";

  if (!dealId) {
    return NextResponse.json({ error: "dealId obrigatório" }, { status: 400 });
  }

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deal: any = null;

  if (IS_DEMO) {
    deal = DEMO_DEALS.find((d) => d.id === dealId) ?? null;
  } else {
    const { data } = await svc.from("ma_deals").select("*").eq("id", dealId).single();
    deal = data;
  }

  if (!deal) {
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Deal não encontrado</title>
      <style>body{font-family:sans-serif;background:#09081A;color:#F0ECE4;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
      .box{text-align:center}.code{font-size:64px;font-weight:800;color:#C9A84C}.msg{color:#7A8FA8;margin-top:8px}</style></head>
      <body><div class="box"><div class="code">404</div><div class="msg">Deal não encontrado ou ID inválido.</div></div></body></html>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Busca dados do investidor via vdr_token para watermark personalizada
  let investor: InvestorInfo | null = null;
  if (vdrToken && type === "cim") {
    const { data: inv } = await svc
      .from("deal_room_invites")
      .select("investor_name, investor_email, investor_company, token")
      .eq("token", vdrToken)
      .single();
    if (inv) investor = {
      name:    inv.investor_name,
      email:   inv.investor_email,
      company: inv.investor_company ?? null,
      token:   inv.token,
    };
  }

  let html = "";
  switch (type) {
    case "teaser":        html = buildTeaser(deal, lang); break;
    case "linkedin_post": html = buildLinkedInPost(deal, lang); break;
    case "linkedin_story":html = buildLinkedInStory(deal, lang); break;
    default:              html = buildCIM(deal, lang, investor);
  }

  if (format) html = injectFormat(html, format, type);

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
