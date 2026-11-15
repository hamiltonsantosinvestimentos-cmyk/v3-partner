// Catálogo de nomes externos e motivos (BRIEF 15/11/2026). Dado de teste só inventado: o repositório é público.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MOTIVOS_DEVOLUCAO,
  MOTIVOS_EXCLUSAO,
  fraseMotivo,
  nomeExternoDocumentoCadastro,
  nomeExternoTipoContrato,
} from "@/lib/comunicacao-externa";

const raiz = path.resolve(__dirname, "..", "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

test("documentos de cadastro: os dois kinds têm nome externo; contrato e desconhecido devolvem null", () => {
  assert.equal(nomeExternoDocumentoCadastro("identificacao_foto"), "Documento de identificação com foto");
  assert.equal(nomeExternoDocumentoCadastro("contrato_social"), "Contrato social");
  assert.equal(nomeExternoDocumentoCadastro("ncnda_ma"), null);
  assert.equal(nomeExternoDocumentoCadastro("qualquer_coisa"), null);
  assert.equal(nomeExternoDocumentoCadastro("constructor"), null);
  assert.equal(nomeExternoDocumentoCadastro(undefined), null);
});

test("tipos de contrato: nomes aprovados; contrato_parceria e kind de cadastro devolvem null", () => {
  assert.equal(nomeExternoTipoContrato("nda_quadripartite"), "Acordo de Confidencialidade");
  assert.equal(nomeExternoTipoContrato("ncnda_ma"), "Acordo de Confidencialidade");
  assert.equal(nomeExternoTipoContrato("fpa_compra"), "Acordo de Participação na Operação (lado comprador)");
  assert.equal(nomeExternoTipoContrato("fpa_venda"), "Acordo de Participação na Operação (lado vendedor)");
  assert.equal(nomeExternoTipoContrato("mandato"), "Instrumento de Representação");
  assert.equal(nomeExternoTipoContrato("contrato_final"), "Contrato da Operação");
  assert.equal(nomeExternoTipoContrato("contrato_parceria"), null);
  assert.equal(nomeExternoTipoContrato("identificacao_foto"), null);
});

test("motivos: código válido devolve a frase; ausente, inválido e de outra lista devolvem ok:false", () => {
  assert.deepEqual(fraseMotivo(MOTIVOS_EXCLUSAO, "documento_ilegivel"), { ok: true, frase: "O documento está ilegível ou sem nitidez." });
  assert.deepEqual(fraseMotivo(MOTIVOS_DEVOLUCAO, "endereco_incompleto"), { ok: true, frase: "O endereço está incompleto ou diferente do comprovante." });
  assert.deepEqual(fraseMotivo(MOTIVOS_EXCLUSAO, "outro"), { ok: true, frase: null });
  assert.deepEqual(fraseMotivo(MOTIVOS_DEVOLUCAO, "outro"), { ok: true, frase: null });
  assert.deepEqual(fraseMotivo(MOTIVOS_EXCLUSAO, undefined), { ok: false });
  assert.deepEqual(fraseMotivo(MOTIVOS_EXCLUSAO, ""), { ok: false });
  assert.deepEqual(fraseMotivo(MOTIVOS_EXCLUSAO, "inventado"), { ok: false });
  assert.deepEqual(fraseMotivo(MOTIVOS_EXCLUSAO, "dados_divergentes"), { ok: false }, "código da devolução não vale na exclusão");
  assert.deepEqual(fraseMotivo(MOTIVOS_DEVOLUCAO, "documento_ilegivel"), { ok: false }, "código da exclusão não vale na devolução");
  assert.deepEqual(fraseMotivo(MOTIVOS_EXCLUSAO, 123), { ok: false });
});

test("listas em ordem alfabética pt-BR com 'Outro motivo' por último, sem código repetido", () => {
  for (const lista of [MOTIVOS_EXCLUSAO, MOTIVOS_DEVOLUCAO]) {
    const sem = lista.filter((o) => o.codigo !== "outro").map((o) => o.rotulo);
    assert.deepEqual([...sem].sort((a, b) => a.localeCompare(b, "pt-BR")), sem);
    assert.equal(lista[lista.length - 1].codigo, "outro");
    assert.equal(new Set(lista.map((o) => o.codigo)).size, lista.length);
  }
});

test("frases e nomes: sem travessão, sem emoji, sem dígitos, sem código de contrato, sem nome de parceiro tecnológico", () => {
  const src = ler("lib/comunicacao-externa.ts");
  const textos = [
    ...MOTIVOS_EXCLUSAO.flatMap((o) => [o.rotulo, o.frase ?? ""]),
    ...MOTIVOS_DEVOLUCAO.flatMap((o) => [o.rotulo, o.frase ?? ""]),
    nomeExternoDocumentoCadastro("identificacao_foto")!, nomeExternoDocumentoCadastro("contrato_social")!,
    ...["nda_quadripartite", "ncnda_ma", "fpa_compra", "fpa_venda", "mandato", "contrato_final"].map((t) => nomeExternoTipoContrato(t)!),
  ];
  for (const t of textos) {
    assert.ok(!/[—–]/.test(t), `travessão em: ${t}`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(t), `emoji em: ${t}`);
    assert.ok(!/\d/.test(t), `dígito em: ${t}`);
    assert.ok(!/V3C-|V3-MA|V3-CR/.test(t), `código em: ${t}`);
    assert.ok(!/bloxs/i.test(t), `parceiro em: ${t}`);
    assert.ok(!/\bFPA\b|\bNCNDA\b/.test(t), `sigla interna em: ${t}`);
  }
  assert.ok(!/DOCUMENT_TYPE_LABELS|template_name/.test(src.replace(/\/\/.*$/gm, "")), "o catálogo não pode depender dos rótulos internos");
});

test("o código de comunicação externa não importa rótulo interno de documento nem nome de modelo", () => {
  // Lista de exceções temporária (BRIEF, seção 10): o convite inicial ainda usa DOCUMENT_TYPE_LABELS; sai da lista
  // quando migrar para o catálogo (prazo no Roadmap: 30/11/2026). Nenhum arquivo novo entra aqui.
  const arquivos = ["lib/comunicacao-externa.ts", "lib/qualificacao/aviso-titular.ts"];
  for (const rel of arquivos) {
    const src = ler(rel).replace(/\/\/.*$/gm, "");
    assert.ok(!/DOCUMENT_TYPE_LABELS|template_name|seller_name|partner_name/.test(src), `${rel} usa rótulo interno`);
  }
});
