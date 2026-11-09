import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarNomeBase, nomesDeExibicao, selecionarPendentes, normalizarTipo, normalizarPeriodo, extensaoDe, dataLeituraBR, NOME_MAX,
} from "../../lib/documentos/nome-arquivo";
import { NOMEAR_A_PARTIR_DE } from "../../lib/documentos/nomear-proposta";

const L = (tipo: string | null, periodo: string | null, titular: string | null, confianca = 0.9) => ({ tipo, periodo, titular, confianca });

test("padrão com período e titular", () => {
  assert.equal(montarNomeBase(L("Faturamento", "2026", "Empresa XYZ Ltda"), "fat.pdf"), "Faturamento 2026 - Empresa XYZ Ltda.pdf");
  assert.equal(montarNomeBase(L("DRE", "2025", "Empresa XYZ Ltda"), "x.PDF"), "DRE 2025 - Empresa XYZ Ltda.PDF");
});

test("sem período, sem titular, período de dois anos", () => {
  assert.equal(montarNomeBase(L("CNH", null, "João da Silva"), "cnh.jpg"), "CNH - João da Silva.jpg");
  assert.equal(montarNomeBase(L("Balanço Patrimonial", "2025", null), "b.pdf"), "Balanço Patrimonial 2025.pdf");
  assert.equal(montarNomeBase(L("Faturamento", "2025 / 2026", "ACME"), "f.pdf"), "Faturamento 2025-2026 - ACME.pdf");
});

test("confiança baixa mantém o original; tipo fora da lista vira Outro", () => {
  assert.equal(montarNomeBase(L("DRE", "2025", "X", 0.69), "a.pdf"), null);
  assert.equal(normalizarTipo("Boleto"), "Outro");
  assert.equal(normalizarTipo("dre"), "DRE");
  assert.equal(montarNomeBase(L("Boleto", null, "Fulano"), "a.pdf"), "Documento - Fulano.pdf");
  assert.equal(montarNomeBase(L("Outro", null, null), "a.pdf"), null);
});

test("caracteres proibidos, limite de 120, extensão preservada", () => {
  assert.equal(montarNomeBase(L("Contrato", null, 'A/B:C*D?"E<F>G|H'), "c.docx"), "Contrato - A B C D E F G H.docx");
  const n = montarNomeBase(L("Contrato Social", null, "X".repeat(100)), "c.pdf")!;
  assert.ok(n.length <= NOME_MAX);
  assert.ok(n.endsWith(".pdf"));
  assert.equal(extensaoDe("sem_extensao"), "");
  assert.equal(normalizarPeriodo("24/2025"), null);
});

test("desempate estável pela ordem uploaded_at/storage_path, mesmo embaralhado", () => {
  const docs = [
    { storage_path: "b", file_name: "1.pdf", uploaded_at: "2026-11-10T10:00:00Z" },
    { storage_path: "a", file_name: "2.pdf", uploaded_at: "2026-11-10T10:00:00Z" },
    { storage_path: "c", file_name: "3.pdf", uploaded_at: "2026-11-10T09:00:00Z" },
  ];
  const bases = new Map([["a", "DRE 2025 - X.pdf"], ["b", "DRE 2025 - X.pdf"], ["c", "DRE 2025 - X.pdf"]]);
  const r1 = nomesDeExibicao(docs, bases);
  const r2 = nomesDeExibicao([...docs].reverse(), bases);
  assert.deepEqual([...r1].sort(), [...r2].sort());
  assert.equal(r1.get("c"), "DRE 2025 - X.pdf");
  assert.equal(r1.get("a"), "DRE 2025 - X (2).pdf");
  assert.equal(r1.get("b"), "DRE 2025 - X (3).pdf");
});

test("desempate ignora acento e maiúsculas; sem base usa o original", () => {
  const docs = [
    { storage_path: "a", file_name: "orig.pdf", uploaded_at: "2026-11-10T09:00:00Z" },
    { storage_path: "b", file_name: "outro.pdf", uploaded_at: "2026-11-10T10:00:00Z" },
    { storage_path: "c", file_name: "nao_lido.pdf", uploaded_at: "2026-11-10T11:00:00Z" },
  ];
  const r = nomesDeExibicao(docs, new Map([["a", "Balanço 2025.pdf"], ["b", "BALANCO 2025.pdf"]]));
  assert.equal(r.get("a"), "Balanço 2025.pdf");
  assert.equal(r.get("b"), "BALANCO 2025 (2).pdf");
  assert.equal(r.get("c"), "nao_lido.pdf");
});

test("corte: só arquivos novos; comparação como data, inclusive com outro fuso", () => {
  const corte = "2026-11-09T22:00:00.000Z";
  const docs = [
    { storage_path: "antigo", uploaded_at: "2026-11-09T21:59:59Z" },
    { storage_path: "novo", uploaded_at: "2026-11-09T22:00:00Z" },
    { storage_path: "fuso", uploaded_at: "2026-11-09T19:30:00-03:00" }, // 22:30 UTC: entra
    { storage_path: "fuso_antes", uploaded_at: "2026-11-09T18:59:00-03:00" }, // 21:59 UTC: fora
    { storage_path: "sem_data" },
    { storage_path: "erro2", uploaded_at: "2026-11-10T00:00:00Z" },
    { storage_path: "erro3", uploaded_at: "2026-11-10T00:00:00Z" },
    { storage_path: "ok", uploaded_at: "2026-11-10T00:00:00Z" },
  ];
  const linhas = [
    { storage_path: "erro2", status: "erro", tentativas: 2 },
    { storage_path: "erro3", status: "erro", tentativas: 3 },
    { storage_path: "ok", status: "ok", tentativas: 1 },
  ];
  const r = selecionarPendentes(docs, linhas, corte).map((x) => `${x.doc.storage_path}:${x.nova}`);
  assert.deepEqual(r, ["novo:true", "fuso:true", "erro2:false"]);
});

test("NOMEAR_A_PARTIR_DE não é anterior a 09/11/2026 (os anexos antigos nunca são lidos)", () => {
  const t = Date.parse(NOMEAR_A_PARTIR_DE);
  assert.ok(!Number.isNaN(t));
  assert.ok(t >= Date.parse("2026-11-09T00:00:00Z"));
});

test("data do tooltip em DD/MM/AAAA no fuso de São Paulo", () => {
  assert.equal(dataLeituraBR("2026-11-10T02:00:00Z"), "09/11/2026"); // 23h em SP
  assert.equal(dataLeituraBR(null), null);
});
