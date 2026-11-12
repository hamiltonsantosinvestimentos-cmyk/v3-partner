// Conferência da qualificação do contrato: regras Q-01 a Q-07 (BRIEF 11/11/2026).
// Lógica pura: sem banco, sem rede. Rodar com `npm run test:unit`.
// Todos os nomes, números e e-mails abaixo são inventados. Nunca colocar aqui dado real de cliente,
// parte de contrato ou deal: o repositório é público.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Q_OVERRIDE_PERMITIDO,
  bloqueiosSemOverride,
  checarCaractereEstranho,
  checarDicionarios,
  checarDocumentoDuplicado,
  checarDocumentosValidos,
  checarNumeracaoDasPartes,
  checarRazaoSocial,
  checarRgIgualCpf,
  conferirQualificacao,
  partyListMarker,
  temBloqueio,
  type QParty,
} from "../../lib/contract-qualification-check";

// CPF de teste com dígito verificador válido (número público de exemplo).
const CPF_OK = "529.982.247-25";
const CPF_OUTRO_OK = "111.444.777-35";
const CNPJ_LEGADO_OK = "11.222.333/0001-81";
const CNPJ_ALFA_OK = "12.ABC.345/01DE-35";

const parte = (p: Partial<QParty>): QParty => ({ role: "partner", nature: "PF", ...p });

// ---------------------------------------------------------------------------
// Q-01
// ---------------------------------------------------------------------------

test("partyListMarker: a) até z), e falha clara a partir da 27ª parte", () => {
  assert.equal(partyListMarker(0), "a)");
  assert.equal(partyListMarker(1), "b)");
  assert.equal(partyListMarker(25), "z)");
  assert.throws(() => partyListMarker(26), /26 partes/);
  assert.throws(() => partyListMarker(-1));
});

const HTML_N_PARENTESES =
  '<p><span class="clause-num">1)</span>&nbsp;PARTNER: BETA EMPREENDIMENTOS LTDA, CNPJ 00.000.000/0001-00, e-mail x@y.com</p>' +
  '<p><span class="clause-num">2)</span>&nbsp;MANDATÁRIO: GAMA TECH LTDA, CNPJ 00.000.000/0001-00</p>';
const HTML_ALINEAS = HTML_N_PARENTESES.replace(">1)<", ">a)<").replace(">2)<", ">b)<");

test("Q-01: só se aplica depois da data de corte; sem corte configurado, não barra nada", () => {
  assert.deepEqual(checarNumeracaoDasPartes(HTML_N_PARENTESES, {}), []);
  assert.deepEqual(checarNumeracaoDasPartes(HTML_N_PARENTESES, { cutoffIso: null }), []);
});

test("Q-01: contrato gerado antes do corte (histórico congelado) fica isento", () => {
  const r = checarNumeracaoDasPartes(HTML_N_PARENTESES, {
    cutoffIso: "2026-12-01T00:00:00-03:00",
    createdAt: "2026-11-09T10:00:00-03:00",
  });
  assert.deepEqual(r, []);
});

test("Q-01: depois do corte, 1) 2) 3) na lista de partes bloqueia; alíneas passam", () => {
  const opts = { cutoffIso: "2026-12-01T00:00:00-03:00", createdAt: "2026-12-05T10:00:00-03:00" };
  const ruim = checarNumeracaoDasPartes(HTML_N_PARENTESES, opts);
  assert.equal(ruim.length, 1);
  assert.equal(ruim[0].id, "Q-01");
  assert.equal(ruim[0].severity, "bloqueia");
  assert.deepEqual(checarNumeracaoDasPartes(HTML_ALINEAS, opts), []);
});

test("Q-01: item numerado 1) de outro assunto, sem documento, não é confundido com parte", () => {
  const html = '<p><span class="clause-num">1)</span>&nbsp;as partes se comprometem a manter sigilo.</p>';
  assert.deepEqual(checarNumeracaoDasPartes(html, { cutoffIso: "2026-12-01T00:00:00-03:00", createdAt: "2026-12-05T00:00:00-03:00" }), []);
});

// ---------------------------------------------------------------------------
// Q-02: o caso real do 0063 (identidade com os mesmos dígitos do CPF)
// ---------------------------------------------------------------------------

test("Q-02: identidade com os mesmos dígitos do CPF bloqueia, e a mensagem não traz número", () => {
  const r = checarRgIgualCpf(parte({ role: "intermediario_1", cpfCnpj: CPF_OK, rg: "52998224725" }));
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "Q-02");
  assert.equal(r[0].severity, "bloqueia");
  assert.ok(!/\d{5}/.test(r[0].message), "mensagem não pode carregar número de documento");
});

test("Q-02: vale também para o representante da cadeia de uma PJ", () => {
  const r = checarRgIgualCpf(parte({
    role: "intermediario_1", nature: "PJ", cpfCnpj: null,
    representatives: [{ cpfCnpj: CPF_OK, idType: "rg", idNumber: "529.982.247-25" }],
  }));
  assert.equal(r.length, 1);
});

test("Q-02: identidades diferentes ou campo vazio não acusam", () => {
  assert.deepEqual(checarRgIgualCpf(parte({ cpfCnpj: CPF_OK, rg: "12.345.678-9" })), []);
  assert.deepEqual(checarRgIgualCpf(parte({ cpfCnpj: CPF_OK, rg: null })), []);
  assert.deepEqual(checarRgIgualCpf(parte({ cpfCnpj: null, rg: "52998224725" })), []);
});

// ---------------------------------------------------------------------------
// Q-03 e Q-06 (alertas)
// ---------------------------------------------------------------------------

test("Q-03: razão social com apóstrofo igual à da Receita (sem acento) não acusa", () => {
  const r = checarRazaoSocial(parte({
    role: "intermediario_1", nature: "PJ",
    companyName: "ALFA'LO GESTÃO PARTICIPAÇÃO E PESQUISAS LTDA",
    cnpjRazaoSocial: "ALFA'LO GESTAO PARTICIPACAO E PESQUISAS LTDA",
  }));
  assert.deepEqual(r, []);
});

test("Q-03: razão social diferente da Receita gera alerta, que não bloqueia", () => {
  const r = checarRazaoSocial(parte({
    nature: "PJ", companyName: "ALFALO GESTÃO PARTICIPAÇÃO E PESQUISAS LTDA",
    cnpjRazaoSocial: "ALFA'LO GESTAO PARTICIPACAO E PESQUISAS LTDA",
  }));
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "Q-03");
  assert.equal(r[0].severity, "alerta");
  assert.equal(temBloqueio(r), false);
});

test("Q-06: apóstrofo legítimo da razão social não acusa; símbolo estranho acusa", () => {
  assert.deepEqual(checarCaractereEstranho(parte({
    nature: "PJ", companyName: "ALFA'LO GESTÃO LTDA", cnpjRazaoSocial: "ALFA'LO GESTAO LTDA",
  })), []);
  const r = checarCaractereEstranho(parte({ fullName: "Fulano #Silva" }));
  assert.equal(r.length, 1);
  assert.equal(r[0].severity, "alerta");
  assert.equal(checarCaractereEstranho(parte({ fullName: "Fulano  Silva" })).length, 1);
});

// ---------------------------------------------------------------------------
// Q-04
// ---------------------------------------------------------------------------

test("Q-04: CPF válido passa; CPF inválido e sequência repetida bloqueiam", () => {
  assert.deepEqual(checarDocumentosValidos(parte({ cpfCnpj: CPF_OK })), []);
  assert.equal(checarDocumentosValidos(parte({ cpfCnpj: "529.982.247-26" })).length, 1);
  assert.equal(checarDocumentosValidos(parte({ cpfCnpj: "111.111.111-11" })).length, 1);
});

test("Q-04: CNPJ legado e alfanumérico válidos passam; dígito errado bloqueia", () => {
  assert.deepEqual(checarDocumentosValidos(parte({ nature: "PJ", companyCnpj: CNPJ_LEGADO_OK })), []);
  assert.deepEqual(checarDocumentosValidos(parte({ nature: "PJ", companyCnpj: CNPJ_ALFA_OK })), []);
  assert.equal(checarDocumentosValidos(parte({ nature: "PJ", companyCnpj: "11.222.333/0001-82" })).length, 1);
});

test("Q-04: documento com tamanho que não é de CPF nem de CNPJ bloqueia", () => {
  assert.equal(checarDocumentosValidos(parte({ cpfCnpj: "12345" })).length, 1);
});

test("Q-04: passaporte exige número válido e país ISO; não exige CPF", () => {
  assert.deepEqual(checarDocumentosValidos(parte({ cpfCnpj: null, idType: "passaporte", idNumber: "X1234567", idCountry: "US" })), []);
  assert.equal(checarDocumentosValidos(parte({ cpfCnpj: null, idType: "passaporte", idNumber: "X1234567", idCountry: null })).length, 1);
  assert.equal(checarDocumentosValidos(parte({ cpfCnpj: null, idType: "passaporte", idNumber: "00000", idCountry: "US" })).length, 1);
});

// ---------------------------------------------------------------------------
// Q-05
// ---------------------------------------------------------------------------

test("Q-05: estado civil e nacionalidade dentro do dicionário passam", () => {
  assert.deepEqual(checarDicionarios(parte({ maritalCode: "casado", nationalityCode: "br" })), []);
  assert.deepEqual(checarDicionarios(parte({ maritalText: "casado(a)", nationalityText: "brasileiro(a)" })), []);
});

test("Q-05: sigla de estado no estado civil e 'brasil' na nacionalidade bloqueiam (caso do 0051)", () => {
  assert.equal(checarDicionarios(parte({ maritalText: "mg" })).length, 1);
  assert.equal(checarDicionarios(parte({ nationalityText: "brasil" })).length, 1);
  assert.equal(checarDicionarios(parte({ nationalityCode: "outra", nationalityText: "Portugal" })).length, 1);
});

test("Q-05: estrangeiro com gentílico em 'outra' passa; 'outra' sem texto bloqueia", () => {
  assert.deepEqual(checarDicionarios(parte({ nationalityCode: "outra", nationalityText: "portuguesa" })), []);
  assert.equal(checarDicionarios(parte({ nationalityCode: "outra", nationalityText: "" })).length, 1);
});

test("Q-05: PJ não é conferida em estado civil nem nacionalidade", () => {
  assert.deepEqual(checarDicionarios(parte({ nature: "PJ", maritalText: "mg", nationalityText: "brasil" })), []);
});

// ---------------------------------------------------------------------------
// Q-07
// ---------------------------------------------------------------------------

test("Q-07: o mesmo CPF em duas partes diferentes bloqueia; formatos diferentes do mesmo número contam como igual", () => {
  const r = checarDocumentoDuplicado([
    parte({ role: "head_mesa", cpfCnpj: CPF_OK }),
    parte({ role: "partner", cpfCnpj: "52998224725" }),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "Q-07");
});

test("Q-07: documento vazio nunca conta como igual", () => {
  assert.deepEqual(checarDocumentoDuplicado([
    parte({ role: "a", cpfCnpj: null }),
    parte({ role: "b", cpfCnpj: "" }),
  ]), []);
});

test("Q-07: passaporte compara tipo, número e país; mesmo número em países diferentes não colide", () => {
  const mesmoPais = checarDocumentoDuplicado([
    parte({ role: "a", cpfCnpj: null, idType: "passaporte", idNumber: "X1234567", idCountry: "US" }),
    parte({ role: "b", cpfCnpj: null, idType: "passaporte", idNumber: "x-1234567", idCountry: "US" }),
  ]);
  assert.equal(mesmoPais.length, 1);
  const paisesDiferentes = checarDocumentoDuplicado([
    parte({ role: "a", cpfCnpj: null, idType: "passaporte", idNumber: "X1234567", idCountry: "US" }),
    parte({ role: "b", cpfCnpj: null, idType: "passaporte", idNumber: "X1234567", idCountry: "PT" }),
  ]);
  assert.deepEqual(paisesDiferentes, []);
});

test("Q-07: chave permitida (ex: o Head que também representa uma parte) não acusa", () => {
  const r = checarDocumentoDuplicado([
    parte({ role: "head_mesa", cpfCnpj: CPF_OK }),
    parte({ role: "partner", nature: "PJ", cpfCnpj: null, representatives: [{ cpfCnpj: CPF_OK }] }),
  ], ["52998224725"]);
  assert.deepEqual(r, []);
});

test("Q-07: documento do representante de uma parte repetido em outra parte bloqueia", () => {
  const r = checarDocumentoDuplicado([
    parte({ role: "partner", nature: "PJ", representatives: [{ cpfCnpj: CPF_OK }] }),
    parte({ role: "mandatario", cpfCnpj: CPF_OK }),
  ]);
  assert.equal(r.length, 1);
});

// ---------------------------------------------------------------------------
// Conjunto e override
// ---------------------------------------------------------------------------

test("conferirQualificacao: contrato limpo não devolve nada", () => {
  const r = conferirQualificacao([
    parte({ role: "head_mesa", cpfCnpj: CPF_OK, rg: "12.345.678-9", maritalCode: "divorciado", nationalityCode: "br", fullName: "JOÃO DA SILVA" }),
    parte({ role: "partner", cpfCnpj: CPF_OUTRO_OK, rg: "98.765.432-1", maritalCode: "solteiro", nationalityCode: "br", fullName: "MARIA SOUZA" }),
  ]);
  assert.deepEqual(r, []);
});

test("conferirQualificacao: reproduz o 0063 (identidade igual ao CPF) e bloqueia", () => {
  const r = conferirQualificacao([
    parte({
      role: "intermediario_1", nature: "PJ", companyName: "ALFA'LO GESTÃO LTDA", cnpjRazaoSocial: "ALFA'LO GESTAO LTDA",
      companyCnpj: CNPJ_LEGADO_OK,
      representatives: [{ cpfCnpj: CPF_OK, idType: "rg", rg: "52998224725" }],
    }),
  ]);
  assert.equal(temBloqueio(r), true);
  assert.deepEqual(r.map((f) => f.id), ["Q-02"]);
});

test("override: só o Q-02 admite; Q-01, Q-04, Q-05 e Q-07 não", () => {
  assert.deepEqual([...Q_OVERRIDE_PERMITIDO], ["Q-02"]);
  const achados = [
    { id: "Q-02" as const, severity: "bloqueia" as const, role: "a", message: "" },
    { id: "Q-04" as const, severity: "bloqueia" as const, role: "a", message: "" },
    { id: "Q-07" as const, severity: "bloqueia" as const, role: "a", message: "" },
    { id: "Q-03" as const, severity: "alerta" as const, role: "a", message: "" },
  ];
  assert.deepEqual(bloqueiosSemOverride(achados).map((a) => a.id), ["Q-04", "Q-07"]);
});
