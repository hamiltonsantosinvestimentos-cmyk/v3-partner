// Due Diligence, Entrega 3: pasta, nome do arquivo, relatorio e mascara de IP (funcoes puras).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DD_FOLDER_REGEX, buildDdReportHtml, ddFolderPaths, ddReportExpiryBr, ddReportFileName, isNcndaCode, latestRunPerTool, maskIp,
  type DdReportRun,
} from "../../lib/cm/dd-report";

const PARTY = "8c6070ef-6729-4d22-be3d-143799554ad7";

test("pasta: NCNDA e identificador curto, sufixo PJ ou PF, nunca CPF ou CNPJ", () => {
  const pj = ddFolderPaths("V3C-NDA-2026-0052", PARTY, "cnpj")!;
  assert.equal(pj.party, "Compliance/DueDiligence/V3C-NDA-2026-0052/P-8c6070ef_PJ");
  assert.equal(pj.ncnda, "Compliance/DueDiligence/V3C-NDA-2026-0052");
  assert.equal(pj.partyShort, "8c6070ef");
  assert.equal(ddFolderPaths("V3C-NDA-2026-0052", PARTY, "cpf")!.party, "Compliance/DueDiligence/V3C-NDA-2026-0052/P-8c6070ef_PF");
  assert.equal(ddFolderPaths("V3C-LOI-2026-0052", PARTY, "cnpj"), null, "so serie V3C-NDA");
  assert.equal(ddFolderPaths("V3C-NDA-2026-52", PARTY, "cnpj"), null, "numero fora do padrao");
  assert.equal(ddFolderPaths("V3C-NDA-2026-0052", "nao-e-uuid", "cnpj"), null);
  assert.equal(isNcndaCode("V3C-NDA-2026-0052"), true);
  assert.equal(isNcndaCode(null), false);
});

test("regex da pasta: mesmos casos aprovados em 08/10/2026", () => {
  const ok = ["Compliance/DueDiligence", "Compliance/DueDiligence/V3C-NDA-2026-0052", "Compliance/DueDiligence/V3C-NDA-2026-0052/P-8c6070ef_PJ", "Compliance/DueDiligence/V3C-NDA-2026-0052/P-344c7495_PF"];
  const bad = [
    "Compliance/DueDiligence/V3C-NDA-2026-0052/12345678901",
    "Compliance/DueDiligence/V3C-NDA-2026-0052/57764646000162",
    "Compliance/DueDiligence/V3C-NDA-2026-0052/P-8c6070ef_PJ/extra",
    "Compliance/DueDiligence/V3C-NDA-2026-52/P-8c6070ef_PJ",
    "Compliance/DueDiligence/V3C-LOI-2026-0052",
    "Compliance/Outro",
    "MA/V3-2026-04-REA-001_Sitio",
  ];
  for (const p of ok) assert.ok(DD_FOLDER_REGEX.test(p), p);
  for (const p of bad) assert.ok(!DD_FOLDER_REGEX.test(p), p);
});

test("nome do arquivo: data de Sao Paulo (nao UTC) e sufixo no mesmo dia", () => {
  // 23:30 em Sao Paulo de 08/10 = 02:30Z de 09/10
  const noite = new Date("2026-10-09T02:30:00Z");
  assert.equal(ddReportFileName(noite, "V3C-NDA-2026-0052", []), "2026-10-08_dossie_V3C-NDA-2026-0052.pdf");
  assert.equal(ddReportFileName(noite, "V3C-NDA-2026-0052", ["2026-10-08_dossie_V3C-NDA-2026-0052.pdf"]), "2026-10-08_dossie_V3C-NDA-2026-0052_v2.pdf");
  assert.equal(
    ddReportFileName(noite, "V3C-NDA-2026-0052", ["2026-10-08_dossie_V3C-NDA-2026-0052.pdf", "2026-10-08_dossie_V3C-NDA-2026-0052_v2.pdf"]),
    "2026-10-08_dossie_V3C-NDA-2026-0052_v3.pdf",
  );
  // outro NCNDA no mesmo dia nao conta como colisao
  assert.equal(ddReportFileName(noite, "V3C-NDA-2026-0053", ["2026-10-08_dossie_V3C-NDA-2026-0052.pdf"]), "2026-10-08_dossie_V3C-NDA-2026-0053.pdf");
});

const run = (tool: DdReportRun["tool"], status: DdReportRun["status"], at: string, summary: Record<string, unknown> = {}): DdReportRun => ({
  tool, status, result_summary: summary, created_at: at, requested_by_name: "JOAO LEMOS",
});

test("resumo: uma entrada por ferramenta (a mais recente), na ordem fixa de consulta", () => {
  const list = latestRunPerTool([
    run("scr_cnpj", "ok", "2026-10-08T10:00:00Z"),
    run("blacklist", "ok", "2026-10-01T10:00:00Z", { encontrado: false, ocorrencias: 0 }),
    run("blacklist", "ok", "2026-10-07T10:00:00Z", { encontrado: true, ocorrencias: 1 }),
    run("receita", "ok", "2026-10-02T10:00:00Z"),
  ]);
  assert.deepEqual(list.map((r) => r.tool), ["receita", "blacklist", "scr_cnpj"]);
  assert.equal((list[1].result_summary as { encontrado: boolean }).encontrado, true, "a mais recente vence");
});

test("html: NCNDA no cabecalho, documento formatado (CNPJ alfanumerico incluido), sem bruto e sem travessao", () => {
  const html = buildDdReportHtml({
    contractCode: "V3C-NDA-2026-0052", partyName: "XF ARTIGOS DE CONCRETO", partyKind: "cnpj", partyDocument: "AB12CD34000184",
    roleLabel: "Partner", folderPath: "Compliance/DueDiligence/V3C-NDA-2026-0052/P-8c6070ef_PJ",
    generatedAt: new Date("2026-10-09T02:30:00Z"), generatedByName: "JOAO LEMOS",
    runs: [run("receita", "ok", "2026-10-08T10:00:00Z", { situacao_cadastral: "ATIVA", razao_social: "XF LTDA", socios_qtd: 1 }), run("scr_cnpj", "sem_dados", "2026-10-08T11:00:00Z")],
  });
  assert.match(html, /V3C-NDA-2026-0052/);
  assert.match(html, /AB\.12C\.D34\/0001-84/, "CNPJ alfanumerico formatado, todos os caracteres visiveis");
  assert.match(html, /08\/10\/2026, 23:30/, "gerado em 23:30 de Sao Paulo");
  assert.match(html, /SEM DADOS/);
  assert.ok(!html.includes("raw_data"));
  assert.ok(!html.includes("—"));
  assert.ok(!/bloxs/i.test(html));
  assert.match(html, /#09081A/);
});

test("prazo de descarte: data de geracao mais 12 meses em DD/MM/AAAA de Sao Paulo", () => {
  assert.equal(ddReportExpiryBr(new Date("2026-10-08T15:00:00Z")), "08/10/2027");
});

test("ip mascarado: IPv4 sem o ultimo octeto, IPv6 so os 2 primeiros blocos", () => {
  assert.equal(maskIp("200.150.10.77"), "200.150.10.*");
  assert.equal(maskIp("2804:14d:abcd:1::1"), "2804:14d:*");
  assert.equal(maskIp(""), "-");
  assert.equal(maskIp(null), "-");
  assert.equal(maskIp("lixo"), "-");
});
