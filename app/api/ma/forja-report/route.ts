import { resolveBucket } from "@/lib/storage-bucket";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

export const maxDuration = 300;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ValidatedField = { field: string; value: string; note?: string; doc_confirmed?: boolean };
type CorrectedField = { field: string; original: string; corrected: string; reason: string; doc_source?: string };
type MissingField   = { field: string; impact: string; priority: "ALTA" | "MEDIA" | "BAIXA" };
type DocInsight     = { doc: string; finding: string };

type ForjaResult = {
  score: number;
  validated: ValidatedField[];
  corrected: CorrectedField[];
  missing:   MissingField[];
  doc_insights?: DocInsight[];
  narrative_pt: string;
  narrative_en: string;
  recommendation: "APROVADO" | "APROVADO_COM_RESSALVAS" | "PENDENTE" | "BLOQUEADO";
  recommendation_note: string;
  docs_analyzed?: number;
};

type DealInfo = {
  id: string;
  code: string;
  company: string;
  sector: string;
  value: number;
  location?: string;
  responsible?: string;
};

// ─── HTML Report Builder ──────────────────────────────────────────────────────

function buildReportHtml(deal: DealInfo, result: ForjaResult, partnerName: string, generatedAt: string): string {
  const REC: Record<string, { label: string; color: string; bg: string }> = {
    APROVADO:               { label: "Aprovado",               color: "#10B981", bg: "rgba(16,185,129,0.12)" },
    APROVADO_COM_RESSALVAS: { label: "Aprovado c/ Ressalvas",  color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
    PENDENTE:               { label: "Pendente",               color: "#F97316", bg: "rgba(249,115,22,0.12)" },
    BLOQUEADO:              { label: "Bloqueado",              color: "#EF4444", bg: "rgba(239,68,68,0.12)"  },
  };
  const rec    = REC[result.recommendation];
  const scoreC = result.score >= 80 ? "#10B981" : result.score >= 60 ? "#F59E0B" : "#EF4444";

  function formatM(v: number | undefined | null) {
    if (!v || isNaN(Number(v))) return "—";
    if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
    return `R$ ${v}`;
  }

  const priorityColor: Record<string, string> = {
    ALTA:  "#EF4444",
    MEDIA: "#F59E0B",
    BAIXA: "#60A5FA",
  };

  const rows = (arr: { label: string; value: string }[]) =>
    arr.map(({ label, value }) => `
      <tr>
        <td style="padding:6px 10px;font-size:10px;color:#7A8FA8;text-transform:uppercase;letter-spacing:1px;font-weight:700;width:35%;border-bottom:1px solid #162744;">${label}</td>
        <td style="padding:6px 10px;font-size:11px;color:#F0ECE4;font-weight:500;border-bottom:1px solid #162744;">${value}</td>
      </tr>`
    ).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Relatório FORJA — ${deal.code}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    @page { size: A4 portrait; margin: 0; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', Arial, sans-serif; background: #09081A; color: #F0ECE4; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 32px 0; }
    /* A4 em tela: 794px × 1123px a 96 DPI */
    .page { width: 794px; min-height: 1123px; background: #111F35; margin: 0 auto 24px; position: relative; box-shadow: 0 4px 40px rgba(0,0,0,0.7); }
    .stripe { height: 4px; background: linear-gradient(to right, #09081A, #C9A84C, #E8C97A, #C9A84C, #09081A); }
    .header { background: #09081A; padding: 18px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(201,168,76,0.2); }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-info { display: flex; flex-direction: column; gap: 2px; }
    .header-tag { font-size: 7px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #C9A84C; }
    .header-title { font-size: 14px; font-weight: 700; color: #F0ECE4; }
    .header-sub { font-size: 9px; color: #7A8FA8; }
    .body { padding: 20px 28px 28px; }
    .section-label { font-size: 7px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #C9A84C; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .section-label::after { content: ''; flex: 1; height: 1px; background: rgba(201,168,76,0.2); }
    .card { background: #162744; border: 1px solid #243A66; border-radius: 6px; margin-bottom: 14px; overflow: hidden; }
    .card-header { padding: 10px 14px; background: rgba(9,8,26,0.5); border-bottom: 1px solid #243A66; font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #C9A84C; }
    .score-row { display: flex; align-items: center; gap: 16px; padding: 16px 14px; }
    .score-num { font-size: 42px; font-weight: 800; line-height: 1; }
    .score-bar-wrap { flex: 1; }
    .score-bar-bg { height: 8px; background: #09081A; border-radius: 999px; overflow: hidden; }
    .score-bar-fill { height: 100%; border-radius: 999px; }
    .score-label { font-size: 9px; color: #7A8FA8; margin-top: 4px; }
    .rec-badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 4px; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; border: 1px solid; margin-top: 6px; }
    table.data { width: 100%; border-collapse: collapse; }
    .tag-priority { display: inline-flex; align-items: center; padding: 1px 6px; border-radius: 3px; font-size: 7px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.1); }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .narrative-box { padding: 12px 14px; }
    .narrative-lang { font-size: 7px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #7A8FA8; margin-bottom: 5px; }
    .narrative-text { font-size: 9px; color: #7A8FA8; line-height: 1.7; border-left: 2px solid rgba(201,168,76,0.3); padding-left: 10px; }
    .footer { background: #09081A; border-top: 1px solid rgba(201,168,76,0.15); padding: 10px 28px; display: flex; justify-content: space-between; align-items: center; }
    .footer-left { font-size: 7px; color: #7A8FA8; line-height: 1.6; }
    .footer-right { font-size: 7px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: rgba(201,168,76,0.4); }
    .insight-row { display: flex; gap: 8px; padding: 8px 14px; border-bottom: 1px solid #162744; }
    .insight-row:last-child { border-bottom: none; }
    .no-print-hint { display: block; text-align: center; padding: 8px; font-size: 10px; color: #7A8FA8; background: #162744; }
    @media print {
      .no-print-hint { display: none !important; }
      html, body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        background: #09081A !important;
        padding: 0 !important; margin: 0 !important;
      }
      .page {
        width: 210mm !important; min-height: 297mm !important;
        margin: 0 !important; box-shadow: none !important;
        page-break-after: always; page-break-inside: avoid;
      }
      .body { padding: 14px 22px 22px !important; }
      .two-col { gap: 10px !important; }
    }
  </style>
</head>
<body>

<div class="no-print-hint">Para salvar como PDF: Ctrl+P (ou ⌘P) → Salvar como PDF → Sem margens</div>

<div class="page">
  <div class="stripe"></div>

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:36px;width:auto;flex-shrink:0;">
      <div class="header-info">
        <span class="header-tag">Relatório FORJA · Validação M&amp;A</span>
        <span class="header-title">${deal.code} — ${deal.company}</span>
        <span class="header-sub">${deal.sector}${deal.location ? ` · ${deal.location}` : ""} · ${formatM(deal.value)}</span>
      </div>
    </div>
    <div style="text-align:right;">
      <span class="header-tag">Gerado em</span>
      <div style="font-size:10px;font-weight:600;color:#F0ECE4;margin-top:2px;">${generatedAt}</div>
      ${result.docs_analyzed ? `<div style="font-size:8px;color:#C9A84C;margin-top:2px;">${result.docs_analyzed} documento${result.docs_analyzed > 1 ? "s" : ""} analisado${result.docs_analyzed > 1 ? "s" : ""}</div>` : ""}
    </div>
  </div>

  <div class="body">

    <!-- Score e Recomendação -->
    <div class="section-label">Score e Recomendação</div>
    <div class="card">
      <div class="score-row">
        <div>
          <div class="score-num" style="color:${scoreC};">${result.score}</div>
          <div style="font-size:8px;color:#7A8FA8;margin-top:2px;">de 100 pontos</div>
        </div>
        <div class="score-bar-wrap">
          <div class="score-bar-bg">
            <div class="score-bar-fill" style="width:${result.score}%;background:${scoreC};"></div>
          </div>
          <div class="score-label">${result.recommendation_note}</div>
          <div class="rec-badge" style="color:${rec.color};background:${rec.bg};border-color:${rec.color}33;margin-top:6px;">
            ${rec.label}
          </div>
        </div>
        <table style="min-width:140px;">
          ${rows([
            { label: "Partner",  value: partnerName },
            { label: "Responsável", value: deal.responsible || "—" },
            { label: "Validados",   value: `${result.validated.length} campos` },
            { label: "Corrigidos",  value: `${result.corrected.length} campos` },
            { label: "Ausentes",    value: `${result.missing.length} campos` },
          ])}
        </table>
      </div>
    </div>

    <div class="two-col">

      <!-- Campos Validados -->
      <div>
        <div class="section-label">Campos Validados (${result.validated.length})</div>
        <div class="card">
          <table class="data">
            ${result.validated.map(v => `
              <tr>
                <td style="padding:5px 10px;font-size:9px;color:#7A8FA8;border-bottom:1px solid #162744;width:40%;">${v.field}</td>
                <td style="padding:5px 10px;font-size:9px;color:#F0ECE4;border-bottom:1px solid #162744;">
                  ${v.value}
                  ${v.doc_confirmed ? `<span style="font-size:7px;color:#C9A84C;margin-left:4px;">✓ doc</span>` : ""}
                </td>
              </tr>`).join("")}
          </table>
        </div>
      </div>

      <!-- Campos Ausentes -->
      <div>
        <div class="section-label">Campos Ausentes (${result.missing.length})</div>
        <div class="card">
          <table class="data">
            ${result.missing.length === 0
              ? `<tr><td style="padding:10px;font-size:9px;color:#7A8FA8;">Nenhum campo crítico ausente</td></tr>`
              : result.missing.map(m => `
              <tr>
                <td style="padding:5px 10px;font-size:9px;color:#F0ECE4;border-bottom:1px solid #162744;width:40%;">${m.field}</td>
                <td style="padding:5px 10px;border-bottom:1px solid #162744;">
                  <span class="tag-priority" style="color:${priorityColor[m.priority]};background:${priorityColor[m.priority]}18;">${m.priority}</span>
                  <div style="font-size:8px;color:#7A8FA8;margin-top:3px;">${m.impact}</div>
                </td>
              </tr>`).join("")}
          </table>
        </div>
      </div>
    </div>

    <!-- Correções -->
    ${result.corrected.length > 0 ? `
    <div class="section-label">Correções Identificadas (${result.corrected.length})</div>
    <div class="card">
      <table class="data">
        ${result.corrected.map(c => `
          <tr>
            <td style="padding:6px 10px;font-size:9px;color:#7A8FA8;border-bottom:1px solid #162744;width:20%;">${c.field}</td>
            <td style="padding:6px 10px;font-size:9px;border-bottom:1px solid #162744;width:25%;">
              <span style="text-decoration:line-through;color:#7A8FA8;">${c.original}</span><br/>
              <span style="color:#F0ECE4;font-weight:600;">${c.corrected}</span>
            </td>
            <td style="padding:6px 10px;font-size:8px;color:#7A8FA8;border-bottom:1px solid #162744;">
              ${c.reason}
              ${c.doc_source ? `<div style="color:#C9A84C;font-size:7px;margin-top:2px;">Fonte: ${c.doc_source}</div>` : ""}
            </td>
          </tr>`).join("")}
      </table>
    </div>` : ""}

    <!-- Doc Insights -->
    ${result.doc_insights?.length ? `
    <div class="section-label">Dados Extraídos dos Documentos (${result.doc_insights.length})</div>
    <div class="card">
      ${result.doc_insights.map(ins => `
        <div class="insight-row">
          <div style="font-size:8px;color:#C9A84C;font-weight:700;min-width:120px;flex-shrink:0;">${ins.doc}</div>
          <div style="font-size:9px;color:#F0ECE4;">${ins.finding}</div>
        </div>`).join("")}
    </div>` : ""}

    <!-- Narrativa -->
    <div class="section-label">Narrativa de Investimento</div>
    <div class="card">
      <div class="narrative-box">
        <div class="narrative-lang">PT-BR</div>
        <div class="narrative-text">${result.narrative_pt}</div>
      </div>
      <div style="border-top:1px solid #243A66;" class="narrative-box">
        <div class="narrative-lang">EN</div>
        <div class="narrative-text">${result.narrative_en}</div>
      </div>
    </div>

    <!-- Disclaimer -->
    <div style="padding:10px 14px;border:1px dashed rgba(201,168,76,0.2);border-radius:6px;font-size:8px;color:#7A8FA8;line-height:1.6;">
      Este relatório foi gerado automaticamente pelo FORJA — sistema de validação inteligente da V3 Partners.
      Os dados refletem as informações disponíveis no momento da análise.
      Validação final sujeita à revisão da Mesa M&amp;A.
      <strong style="color:#F0ECE4;">CONFIDENCIAL — uso restrito V3 Partners.</strong>
    </div>

  </div>

  <div class="footer">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:24px;width:auto;opacity:0.85;">
      <div class="footer-left">
        V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, RJ<br/>
        Plataforma v3-partner · Relatório FORJA · ${deal.code}
      </div>
    </div>
    <div class="footer-right">${result.recommendation}</div>
  </div>
</div>

</body>
</html>`;
}

// ─── Email Builder ────────────────────────────────────────────────────────────

function buildMesaEmail(deal: DealInfo, result: ForjaResult, partnerName: string, reportUrl: string, generatedAt: string) {
  const recLabels: Record<string, string> = {
    APROVADO: "✅ APROVADO",
    APROVADO_COM_RESSALVAS: "⚠️ APROVADO COM RESSALVAS",
    PENDENTE: "🕐 PENDENTE",
    BLOQUEADO: "🚫 BLOQUEADO",
  };
  const recColors: Record<string, string> = {
    APROVADO: "#10B981", APROVADO_COM_RESSALVAS: "#F59E0B",
    PENDENTE: "#F97316", BLOQUEADO: "#EF4444",
  };
  const scoreColor = result.score >= 80 ? "#10B981" : result.score >= 60 ? "#F59E0B" : "#EF4444";
  function formatM(v: number | undefined | null) { if (!v || isNaN(Number(v))) return "—"; return v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : `R$ ${Number(v).toLocaleString("pt-BR")}`; }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
</head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#09081A;color:#F0ECE4;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A;padding:32px 0;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="background:#111F35;border:1px solid #243A66;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#162744;padding:24px 28px;border-bottom:1px solid #243A66;">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;">Mesa M&A · Relatório FORJA</p>
        <h1 style="margin:0;font-size:20px;font-weight:700;color:#F0ECE4;">${deal.code} — ${deal.company}</h1>
        <p style="margin:4px 0 0;font-size:11px;color:#7A8FA8;">${deal.sector}${deal.location ? ` · ${deal.location}` : ""} · ${formatM(deal.value)}</p>
      </td></tr>
      <tr><td style="padding:24px 28px;">

        <!-- Score block -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744;border:1px solid #243A66;border-radius:8px;margin-bottom:20px;">
          <tr>
            <td style="padding:16px 20px;width:90px;">
              <div style="font-size:38px;font-weight:800;color:${scoreColor};line-height:1;">${result.score}</div>
              <div style="font-size:8px;color:#7A8FA8;">/ 100</div>
            </td>
            <td style="padding:16px 20px;border-left:1px solid #243A66;">
              <div style="font-size:12px;font-weight:700;color:${recColors[result.recommendation]};">${recLabels[result.recommendation]}</div>
              <div style="font-size:10px;color:#7A8FA8;margin-top:4px;line-height:1.5;">${result.recommendation_note}</div>
            </td>
            <td style="padding:16px 20px;border-left:1px solid #243A66;text-align:right;vertical-align:top;">
              <div style="font-size:9px;color:#7A8FA8;">Partner</div>
              <div style="font-size:11px;font-weight:600;color:#F0ECE4;">${partnerName}</div>
              <div style="font-size:9px;color:#7A8FA8;margin-top:8px;">Gerado</div>
              <div style="font-size:10px;color:#F0ECE4;">${generatedAt}</div>
            </td>
          </tr>
        </table>

        <!-- Stats row -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            ${[
              { label: "Validados",  val: result.validated.length, color: "#10B981" },
              { label: "Corrigidos", val: result.corrected.length, color: "#F59E0B" },
              { label: "Ausentes",   val: result.missing.length,   color: "#EF4444" },
              { label: "Docs analisados", val: result.docs_analyzed ?? 0, color: "#C9A84C" },
            ].map(s => `
              <td style="padding:0 4px 0 0;">
                <div style="background:#162744;border:1px solid #243A66;border-radius:6px;padding:10px 14px;text-align:center;">
                  <div style="font-size:18px;font-weight:800;color:${s.color};">${s.val}</div>
                  <div style="font-size:8px;color:#7A8FA8;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">${s.label}</div>
                </div>
              </td>`).join("")}
          </tr>
        </table>

        <!-- Missing ALTA -->
        ${result.missing.filter(m => m.priority === "ALTA").length > 0 ? `
        <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:6px;padding:12px 16px;margin-bottom:16px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#EF4444;margin-bottom:8px;">Campos Críticos Ausentes</div>
          ${result.missing.filter(m => m.priority === "ALTA").map(m =>
            `<div style="font-size:10px;color:#F0ECE4;margin-bottom:4px;">• <strong>${m.field}</strong> — ${m.impact}</div>`
          ).join("")}
        </div>` : ""}

        <!-- CTA buttons -->
        <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            <td style="padding-right:8px;">
              <a href="https://app.v3partners.com.br/mesa-ma" style="display:inline-block;background:#C9A84C;color:#09081A;font-weight:700;font-size:12px;padding:10px 20px;border-radius:6px;text-decoration:none;">
                Abrir Mesa M&A
              </a>
            </td>
            ${reportUrl ? `<td>
              <a href="${reportUrl}" style="display:inline-block;background:transparent;border:1px solid #C9A84C;color:#C9A84C;font-weight:700;font-size:12px;padding:10px 20px;border-radius:6px;text-decoration:none;">
                Baixar Relatório HTML
              </a>
            </td>` : ""}
          </tr>
        </table>

        <hr style="border:none;border-top:1px solid #243A66;margin:0 0 14px;"/>
        <p style="margin:0;font-size:10px;color:#7A8FA8;line-height:1.6;">
          V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br/>
          <a href="https://v3partners.com.br" style="color:#C9A84C;text-decoration:none;">v3partners.com.br</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildPartnerEmail(deal: DealInfo, result: ForjaResult, partnerName: string, generatedAt: string) {
  const recMsg: Record<string, { title: string; body: string; color: string }> = {
    APROVADO:               { title: "Deal Aprovado pela Análise FORJA",        body: "Os dados do deal estão completos e aprovados. A equipe dará seguimento ao processo.", color: "#10B981" },
    APROVADO_COM_RESSALVAS: { title: "Deal Aprovado com Ressalvas",             body: "O deal está em análise. Alguns dados complementares podem ser solicitados.", color: "#F59E0B" },
    PENDENTE:               { title: "Deal Pendente — Dados Complementares",    body: "Precisamos de informações adicionais para avançar. Verifique os campos ausentes.", color: "#F97316" },
    BLOQUEADO:              { title: "Deal Bloqueado — Revisão Necessária",     body: "O deal precisa de revisão antes de prosseguir. Nossa equipe entrará em contato.", color: "#EF4444" },
  };
  const msg = recMsg[result.recommendation];
  function formatM(v: number | undefined | null) { if (!v || isNaN(Number(v))) return "—"; return v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : `R$ ${Number(v).toLocaleString("pt-BR")}`; }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
</head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#09081A;color:#F0ECE4;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#111F35;border:1px solid #243A66;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#162744;padding:24px 28px;border-bottom:1px solid #243A66;">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;">V3 Partners · Mesa M&A</p>
        <h1 style="margin:0;font-size:18px;font-weight:700;color:#F0ECE4;">${msg.title}</h1>
      </td></tr>
      <tr><td style="padding:24px 28px;">
        <p style="margin:0 0 20px;font-size:13px;color:#7A8FA8;line-height:1.6;">
          Olá, <strong style="color:#F0ECE4;">${partnerName}</strong>.<br/>${msg.body}
        </p>

        <!-- Deal card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744;border:1px solid #243A66;border-radius:8px;margin-bottom:20px;">
          <tr><td style="padding:16px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-bottom:10px;">
                  <div style="font-size:9px;color:#7A8FA8;text-transform:uppercase;letter-spacing:1px;">Código</div>
                  <div style="font-size:16px;font-weight:800;color:#C9A84C;font-family:monospace;">${deal.code}</div>
                </td>
                <td style="padding-bottom:10px;text-align:right;">
                  <div style="font-size:9px;color:#7A8FA8;text-transform:uppercase;letter-spacing:1px;">Score FORJA</div>
                  <div style="font-size:22px;font-weight:800;color:${msg.color};">${result.score}<span style="font-size:12px;font-weight:400;color:#7A8FA8;">/100</span></div>
                </td>
              </tr>
              <tr>
                <td><div style="font-size:9px;color:#7A8FA8;">Empresa</div><div style="font-size:12px;font-weight:600;color:#F0ECE4;">${deal.company}</div></td>
                <td><div style="font-size:9px;color:#7A8FA8;">Valor</div><div style="font-size:12px;font-weight:600;color:#C9A84C;">${formatM(deal.value)}</div></td>
              </tr>
            </table>
          </td></tr>
        </table>

        ${result.missing.filter(m => m.priority === "ALTA").length > 0 ? `
        <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:6px;padding:12px 16px;margin-bottom:16px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#F97316;margin-bottom:8px;">Pendências para Avançar</div>
          ${result.missing.filter(m => m.priority === "ALTA").map(m =>
            `<div style="font-size:10px;color:#F0ECE4;margin-bottom:4px;">• <strong>${m.field}</strong></div>`
          ).join("")}
        </div>` : ""}

        <a href="https://app.v3partners.com.br/ma" style="display:inline-block;background:#C9A84C;color:#09081A;font-weight:700;font-size:12px;padding:10px 24px;border-radius:6px;text-decoration:none;margin-bottom:20px;">
          Ver meu Deal na Plataforma
        </a>

        <hr style="border:none;border-top:1px solid #243A66;margin:0 0 14px;"/>
        <p style="margin:0;font-size:10px;color:#7A8FA8;line-height:1.6;">
          V3 Partners · <a href="https://v3partners.com.br" style="color:#C9A84C;text-decoration:none;">v3partners.com.br</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();
    const { deal_id, forja_result } = body as {
      deal_id: string;
      forja_result: ForjaResult;
    };
    // Normaliza campos — o frontend envia target_company/deal_value (nomes do banco)
    // mas o tipo DealInfo usa company/value. Aceita ambos.
    const raw = body.deal as Record<string, unknown>;
    const deal: DealInfo = {
      id:          (raw.id          as string)  ?? deal_id,
      code:        (raw.code        as string)  ?? "",
      company:     (raw.target_company as string) ?? (raw.company as string) ?? "",
      sector:      (raw.sector      as string)  ?? "",
      value:       Number((raw.deal_value ?? raw.value) ?? 0),
      location:    (raw.location    as string)  ?? "",
      responsible: (raw.responsible as string)  ?? "",
    };

    if (!deal_id || !raw || !forja_result) {
      return NextResponse.json({ error: "deal_id, deal e forja_result são obrigatórios" }, { status: 400 });
    }

    const svc = serviceClient();
    const generatedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // Busca dados do deal no banco (created_by, assigned_to)
    const { data: dealRow } = await svc
      .from("ma_deals")
      .select("created_by, assigned_to")
      .eq("id", deal_id)
      .single();

    // Busca perfil do partner que trouxe o deal
    const partnerUserId = dealRow?.created_by ?? dealRow?.assigned_to;
    let partnerProfile: { full_name: string; email: string } | null = null;
    if (partnerUserId) {
      const { data } = await svc
        .from("profiles")
        .select("full_name, email")
        .eq("id", partnerUserId)
        .single();
      partnerProfile = data;
    }
    const partnerName = partnerProfile?.full_name ?? deal.responsible ?? "Partner";

    // Busca usuários da mesa (ADMIN + GESTAO) para notificações in-app
    const { data: mesaUsers } = await svc
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["ADMIN", "GESTAO"]);

    // ── Gera HTML do relatório ────────────────────────────────────────────────
    const rawReportHtml = buildReportHtml(deal, forja_result, partnerName, generatedAt);

    // Gate Brand & Grammar Guardian — corrige cores legadas/travessão/Bloxs/emoji
    // antes de subir ao Storage e enviar por e-mail.
    const reportGate = auditHtml(rawReportHtml);
    if (reportGate.blocking.length > 0) {
      console.error("[forja-report] Brand Guardian bloqueou o relatório:", reportGate.blocking);
    }
    const reportHtml = reportGate.corrected;

    // ── Upload para Supabase Storage ──────────────────────────────────────────
    const timestamp   = Date.now();
    const storagePath = `${deal_id}/forja-report-${timestamp}.html`;
    // UTF-8 BOM garante que browsers interpretem como UTF-8 ao baixar via signed URL
    const BOM       = Buffer.from([0xEF, 0xBB, 0xBF]);
    const htmlBytes = Buffer.concat([BOM, Buffer.from(reportHtml, "utf-8")]);

    const { error: uploadErr } = await svc.storage
      .from(resolveBucket(storagePath ?? ""))
      .upload(storagePath, htmlBytes, { contentType: "text/html; charset=utf-8", upsert: false });

    let reportUrl = "";
    if (!uploadErr) {
      const { data: signedData } = await svc.storage
        .from(resolveBucket(storagePath ?? ""))
        .createSignedUrl(storagePath, 7 * 24 * 60 * 60); // 7 dias
      reportUrl = signedData?.signedUrl ?? "";
    }

    // ── Salva referência do relatório no asset_data ───────────────────────────
    const { data: currentDeal } = await svc
      .from("ma_deals")
      .select("asset_data")
      .eq("id", deal_id)
      .single();
    const assetData = (currentDeal?.asset_data ?? {}) as Record<string, unknown>;
    const reports = (assetData.forja_reports ?? []) as unknown[];
    reports.unshift({ path: storagePath, url: reportUrl, generated_at: new Date().toISOString() });

    await svc
      .from("ma_deals")
      .update({ asset_data: { ...assetData, forja_reports: reports.slice(0, 10) }, updated_at: new Date().toISOString() })
      .eq("id", deal_id);

    // ── Notificações in-app ───────────────────────────────────────────────────
    const notifTargets = new Map<string, { full_name: string; email: string }>();
    (mesaUsers ?? []).forEach(u => notifTargets.set(u.id, u));
    if (partnerUserId && partnerProfile) notifTargets.set(partnerUserId, partnerProfile);

    const recLabel: Record<string, string> = {
      APROVADO: "Aprovado", APROVADO_COM_RESSALVAS: "Aprovado c/ Ressalvas",
      PENDENTE: "Pendente", BLOQUEADO: "Bloqueado",
    };

    const notifications = Array.from(notifTargets.entries()).map(([userId]) => ({
      user_id:    userId,
      title:      `FORJA: ${deal.code} — Score ${forja_result.score}/100`,
      message:    `${recLabel[forja_result.recommendation]} · ${forja_result.recommendation_note?.slice(0, 100)}`,
      type:       "forja_report",
      read:       false,
      action_url: `/mesa-ma`,
      created_at: new Date().toISOString(),
    }));

    if (notifications.length > 0) {
      await svc.from("notifications").insert(notifications);
    }

    // ── Emails via Resend ─────────────────────────────────────────────────────
    let emailsSent = 0;
    const resendKey = process.env.RESEND_API_KEY;

    if (resendKey) {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);

      const mesaEmails = (mesaUsers ?? [])
        .map(u => u.email)
        .filter(Boolean)
        .filter(e => e !== partnerProfile?.email);

      const sends: Promise<unknown>[] = [];

      // Gate Brand & Grammar Guardian — corrige travessão/acentuação/Bloxs/emoji
      // e bloqueia (loga, não impede o envio) se logo/DM Sans/navy faltarem.
      const mesaSubjectGate = auditText(`[FORJA] ${deal.code} Score ${forja_result.score} · ${recLabel[forja_result.recommendation]}`);
      const mesaHtmlGate = auditHtml(buildMesaEmail(deal, forja_result, partnerName, reportUrl, generatedAt));
      if (mesaHtmlGate.blocking.length > 0) console.error("[forja-report] Brand Guardian (email mesa):", mesaHtmlGate.blocking);

      const partnerSubjectGate = auditText(`${deal.code} Relatório FORJA recebido`);
      const partnerHtmlGate = auditHtml(buildPartnerEmail(deal, forja_result, partnerName, generatedAt));
      if (partnerHtmlGate.blocking.length > 0) console.error("[forja-report] Brand Guardian (email partner):", partnerHtmlGate.blocking);

      // Email para a mesa
      if (mesaEmails.length > 0) {
        sends.push(
          resend.emails.send({
            from:    "V3 Partners Plataforma <noreply@v3partners.com.br>",
            to:      mesaEmails,
            subject: mesaSubjectGate.corrected,
            html:    mesaHtmlGate.corrected,
          }).then(() => { emailsSent += mesaEmails.length; })
            .catch(e => console.error("[forja-report] email mesa:", e))
        );
      }

      // Email para o partner
      if (partnerProfile?.email) {
        sends.push(
          resend.emails.send({
            from:    "V3 Partners <noreply@v3partners.com.br>",
            to:      partnerProfile.email,
            subject: partnerSubjectGate.corrected,
            html:    partnerHtmlGate.corrected,
          }).then(() => { emailsSent += 1; })
            .catch(e => console.error("[forja-report] email partner:", e))
        );
      }

      await Promise.allSettled(sends);
    }

    return NextResponse.json({
      ok:                    true,
      report_url:            reportUrl,
      // HTML retornado diretamente para o browser abrir via Blob URL (charset garantido)
      report_html:           reportHtml,
      emails_sent:           emailsSent,
      notifications_created: notifications.length,
      partner_name:          partnerName,
    });
  } catch (error) {
    console.error("[forja-report] ERRO:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Erro ao gerar relatório: ${msg}` }, { status: 500 });
  }
}
