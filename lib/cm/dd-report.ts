// Relatorio de Due Diligence da parte (Entrega 3, 08/10/2026), guardado na pasta Compliance/DueDiligence.
// BRIEF: scratchpad brief-e3-dd.md (REVISAO v2). Funcoes PURAS aqui; o PDF e gerado na rota.
// Regras: datas SEMPRE em America/Sao_Paulo (nunca o fuso do servidor); nenhum CPF, CNPJ ou nome em nome de
// pasta ou de arquivo; o resultado bruto (raw_data) NAO entra no relatorio.

import { formatDocumentNumber } from "@/lib/legal-qualification";
import { formatDateTimeBr, spDateKey } from "@/lib/cm-indicators";
import { DD_REPORT_TOOL_ORDER, DD_STATUS_TITLES, DD_TOOL_TITLES, ddSummaryLines, type DdSummaryStatus, type DdSummaryTool } from "@/lib/cm/dd-summary";

export const DD_FOLDER_ROOT = "Compliance/DueDiligence";
export const DD_RETENTION_MONTHS = 12;

// Mesma expressao da funcao validate_folder_path (migration 20261008c) e da regra aprovada.
export const DD_FOLDER_REGEX = /^Compliance\/DueDiligence(\/V3C-NDA-\d{4}-\d{4}(\/P-[0-9a-f]{8}_(PJ|PF))?)?$/;
const NCNDA_REGEX = /^V3C-NDA-\d{4}-\d{4}$/;

export function isNcndaCode(code: string | null | undefined): boolean {
  return !!code && NCNDA_REGEX.test(code);
}

export interface DdFolderPaths {
  root: string;
  ncnda: string;
  party: string;
  partyShort: string;
}

/** Caminhos da pasta da parte. Devolve null se o NCNDA ou o identificador da parte nao forem validos. */
export function ddFolderPaths(contractCode: string, partyId: string, kind: "cpf" | "cnpj"): DdFolderPaths | null {
  if (!isNcndaCode(contractCode)) return null;
  const partyShort = partyId.replace(/-/g, "").slice(0, 8).toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(partyShort)) return null;
  const ncnda = `${DD_FOLDER_ROOT}/${contractCode}`;
  const party = `${ncnda}/P-${partyShort}_${kind === "cnpj" ? "PJ" : "PF"}`;
  if (!DD_FOLDER_REGEX.test(party)) return null;
  return { root: DD_FOLDER_ROOT, ncnda, party, partyShort };
}

/** AAAA-MM-DD_dossie_<NCNDA>.pdf, com a data do dia de Sao Paulo; a segunda geracao do dia ganha _v2, _v3. */
export function ddReportFileName(now: Date, contractCode: string, existingNames: string[]): string {
  const base = `${spDateKey(now)}_dossie_${contractCode}`;
  const taken = new Set(existingNames.map((n) => n.replace(/\.pdf$/i, "")));
  if (!taken.has(base)) return `${base}.pdf`;
  let v = 2;
  while (taken.has(`${base}_v${v}`)) v++;
  return `${base}_v${v}.pdf`;
}

export interface DdReportRun {
  tool: DdSummaryTool;
  status: DdSummaryStatus;
  result_summary: Record<string, unknown>;
  created_at: string;
  requested_by_name: string;
}

/** Uma entrada por ferramenta (a mais recente), na ordem fixa de consulta. */
export function latestRunPerTool(runs: DdReportRun[]): DdReportRun[] {
  const latest = new Map<DdSummaryTool, DdReportRun>();
  for (const r of runs) {
    const cur = latest.get(r.tool);
    if (!cur || new Date(r.created_at).getTime() > new Date(cur.created_at).getTime()) latest.set(r.tool, r);
  }
  return DD_REPORT_TOOL_ORDER.filter((t) => latest.has(t)).map((t) => latest.get(t)!);
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface DdReportInput {
  contractCode: string;
  partyName: string;
  partyKind: "cpf" | "cnpj";
  partyDocument: string;
  roleLabel: string;
  folderPath: string;
  generatedAt: Date;
  generatedByName: string;
  runs: DdReportRun[];
}

/** HTML do relatorio, identidade V3 (navy, ouro, DM Sans), A4 sem moldura branca (espacadores table.pg). */
export function buildDdReportHtml(input: DdReportInput): string {
  const runs = latestRunPerTool(input.runs);
  const doc = formatDocumentNumber(input.partyDocument) ?? input.partyDocument;
  const rows = runs
    .map((r) => {
      const lines = ddSummaryLines(r.tool, r.status, r.result_summary as Record<string, any>).map((l) => `<div>${esc(l)}</div>`).join("");
      return `<tr><td class="tool">${esc(DD_TOOL_TITLES[r.tool])}</td><td><span class="st st-${r.status}">${DD_STATUS_TITLES[r.status]}</span></td><td>${lines}</td><td class="meta">${esc(formatDateTimeBr(new Date(r.created_at)))}<br>${esc(r.requested_by_name)}</td></tr>`;
    })
    .join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Due Diligence ${esc(input.contractCode)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap">
<style>
@page{size:A4;margin:0}
html,body{background:#09081A!important;margin:0!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
body{font-family:'DM Sans',sans-serif;color:#F5F1E8;padding:0 15mm!important;font-size:12px;line-height:1.5}
table.pg{width:100%;border-collapse:collapse}
table.pg>thead>tr>td,table.pg>tfoot>tr>td{height:13mm;padding:0;border:0}
table.pg>tbody>tr>td{padding:0;border:0}
img.logo{height:44px;margin-bottom:10px}
h1{font-size:22px;margin:6px 0 4px;color:#F5F1E8}
.lead{color:#9BAFC5;margin:0 0 14px}
.box{background:#13223A;border-left:3px solid #C9A84C;border-radius:6px;padding:10px 14px;margin:10px 0}
.box b{color:#E8C97A}
table.res{width:100%;border-collapse:collapse;margin-top:10px}
table.res th{background:#13223A;color:#E8C97A;text-align:left;padding:7px 8px;font-size:11px;text-transform:uppercase}
table.res td{border-bottom:1px solid #243A66;padding:7px 8px;vertical-align:top;color:#9BAFC5}
table.res td.tool{color:#F5F1E8;font-weight:700}
table.res tr{break-inside:avoid}
.meta{font-size:11px}
.st{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid #243A66}
.st-ok{color:#4ADE80}.st-sem_dados{color:#F5B942}.st-nao_consultado{color:#F26D6D}
.foot{margin-top:18px;font-size:10px;color:#9BAFC5}
</style></head><body><table class="pg"><thead><tr><td></td></tr></thead><tbody><tr><td>
<img class="logo" src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners">
<h1>Relatório de Due Diligence</h1>
<p class="lead">NCNDA de origem: <b style="color:#F5F1E8">${esc(input.contractCode)}</b></p>
<div class="box"><b>Parte</b><br>${esc(input.partyName)}<br>${esc(input.partyKind === "cnpj" ? "CNPJ" : "CPF")} ${esc(doc)} · ${esc(input.roleLabel)}</div>
<div class="box"><b>Pasta</b><br>${esc(input.folderPath)}<br>Gerado em ${esc(formatDateTimeBr(input.generatedAt))} por ${esc(input.generatedByName)} · guardado por ${DD_RETENTION_MONTHS} meses</div>
<table class="res"><thead><tr><th>Consulta</th><th>Situação</th><th>Resultado</th><th>Quando e quem</th></tr></thead><tbody>${rows || `<tr><td colspan="4">Nenhuma consulta nos últimos ${DD_RETENTION_MONTHS} meses.</td></tr>`}</tbody></table>
<p class="foot">Documento confidencial. Cada abertura deste relatório fica registrada. V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · Ipanema, Rio de Janeiro.</p>
</td></tr></tbody><tfoot><tr><td></td></tr></tfoot></table></body></html>`;
}

/** Prazo de descarte: data de geracao mais 12 meses, em DD/MM/AAAA no fuso de Sao Paulo. */
export function ddReportExpiryBr(createdAt: Date): string {
  const d = new Date(createdAt.getTime());
  d.setUTCMonth(d.getUTCMonth() + DD_RETENTION_MONTHS);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** IP para tela de monitoramento: IPv4 sem o ultimo octeto, IPv6 so os 2 primeiros blocos. */
export function maskIp(ip: string | null | undefined): string {
  const v = (ip ?? "").trim();
  if (!v) return "-";
  if (v.includes(":")) return `${v.split(":").slice(0, 2).join(":")}:*`;
  const parts = v.split(".");
  return parts.length === 4 ? `${parts.slice(0, 3).join(".")}.*` : "-";
}
