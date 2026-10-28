// Aba "Originação" da Mesa M&A, Etapa 1 (BRIEF 2026-10-17). Lógica pura, sem banco e sem rede.
// Casos vindos do caso real que gerou o BRIEF e da bateria de testes do anexo (páginas 21 a 29).
// Rodar com: npx tsx --tsconfig tsconfig.json --test tests/unit/originacao.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarFato, parseDataBR, fmtDataBR, gateEtapa1, parseSaidaE1, normalizeUnit, UNIDADES, promptE1, type FatoInput,
} from "../../lib/ma/originacao";

const base: FatoInput = { tema: "Receita", afirmacao: "100 milhões de euros por ano", rotulo: "DECLARADO_REUNIAO" };

test("fatos reais do caso são aceitos", () => {
  const casos: FatoInput[] = [
    { ...base, valor_min: 100e6, valor_max: 100e6, unidade: "moeda", moeda: "EUR" },
    { ...base, tema: "Área", valor_min: 1000, valor_max: 1000, unidade: "ha" },
    { ...base, tema: "Embarques", valor_min: 1500, valor_max: 2500, unidade: "conteiner" },
    { ...base, tema: "Equipe", valor_min: 1800, valor_max: 1800, unidade: "pessoa" },
    { ...base, tema: "Dívida", valor_min: 0, valor_max: 0, unidade: "moeda", moeda: "BRL", ausencia: true },
    { ...base, tema: "Rodas entregues", valor_min: 12, valor_max: 15, unidade: "unidade" },
    { ...base, tema: "Sem número" },
  ];
  for (const f of casos) assert.deepEqual(validarFato(f), [], f.tema);
});

test("rejeições espelham as travas do banco", () => {
  const erro = (f: FatoInput) => validarFato(f).join("; ");
  assert.match(erro({ ...base, valor_min: 2500, valor_max: 1500, unidade: "conteiner" }), /valor_min > valor_max/);
  assert.match(erro({ ...base, valor_min: -1, valor_max: -1, unidade: "ha" }), /piso 0/);
  assert.match(erro({ ...base, valor_min: 0, valor_max: 0, unidade: "moeda", moeda: "BRL" }), /só em declaração de ausência/);
  assert.match(erro({ ...base, valor_min: 1, valor_max: 1, unidade: "moeda" }), /moeda obrigatória/);
  assert.match(erro({ ...base, valor_min: 1, valor_max: 1, unidade: "ha", moeda: "BRL" }), /unidade não monetária/);
  assert.match(erro({ ...base, valor_min: 5e6, valor_max: 5e6, unidade: "ha" }), /teto/);
  assert.match(erro({ ...base, valor_min: 1, valor_max: 1 }), /incompleto/);
  assert.match(erro({ ...base, rotulo: "VERIFICADO" }), /fonte e data/);
  assert.match(erro({ ...base, valor_min: 1, valor_max: 1, unidade: "parsec" }), /fora do catálogo/);
});

test("datas sem deslocamento de fuso", () => {
  assert.equal(parseDataBR("07/10/2026"), "2026-10-07");
  assert.equal(fmtDataBR("2026-10-07"), "07/10/2026");
  assert.equal(parseDataBR("31/02/2026"), null);
  assert.equal(parseDataBR("2026-10-07"), null);
});

test("gate da Etapa 1", () => {
  assert.equal(gateEtapa1([{ status: "A_CONFIRMAR" }], [{ rotulo: "DECLARADO_REUNIAO" }]).ok, false);
  assert.equal(gateEtapa1([{ status: "CONFIRMADO" }], []).ok, false);
  assert.equal(gateEtapa1([{ status: "CONFIRMADO" }], [{ rotulo: "DECLARADO_REUNIAO" }]).ok, true);
});

test("unidades: aliases e ordem alfabética pt-BR", () => {
  assert.equal(normalizeUnit("contêiner"), "conteiner");
  assert.equal(normalizeUnit("Funcionários"), "pessoa");
  assert.equal(normalizeUnit("parsec"), null);
  const labels = UNIDADES.map(u => u.label);
  assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, "pt-BR")));
});

test("parse da saída do E1: rótulo forçado, ausência = 0, faixa preservada, inválido vai para rejeitados", () => {
  const texto = `Segue o JSON:\n${JSON.stringify({
    nomes: [{ tipo: "pessoa", grafias: ["Hernani", "Ernani"], grafia_provavel: "Ernani" }, { tipo: "empresa", grafias: ["V3 Partners"] }],
    fatos: [
      { tema: "Dívida", afirmacao: "não existe dívida bancária", valor_min: 0, valor_max: 0, unidade: "moeda", moeda: "BRL", ausencia: true, rotulo: "VERIFICADO" },
      { tema: "Embarques", afirmacao: "1.500, vai pra 2.500", valor_min: 1500, valor_max: 2500, unidade: "contêiner" },
      { tema: "Área", afirmacao: "mil hectares", valor_min: 1000, unidade: "hectares", moeda: "BRL" },
      { tema: "Ruim", afirmacao: "x", valor_min: 10, valor_max: 5, unidade: "t" },
    ],
    decisao: "talvez",
  })}`;
  const s = parseSaidaE1(texto, ["V3 Partners"]);
  assert.equal(s.fatos.length, 3);
  assert.ok(s.fatos.every(f => f.rotulo === "DECLARADO_REUNIAO"));
  assert.equal(s.fatos[1].valor_min, 1500);
  assert.equal(s.fatos[1].valor_max, 2500);
  assert.equal(s.fatos[2].valor_max, 1000);   // valor único: máximo = mínimo
  assert.equal(s.fatos[2].moeda, null);        // moeda descartada em unidade não monetária
  assert.equal(s.rejeitados.length, 1);
  assert.equal(s.decisao, "em_conversa");
  assert.equal(s.nomes[0].status, "A_CONFIRMAR");
  assert.equal(s.nomes[1].status, "CONFIRMADO_GLOSSARIO");
  assert.throws(() => parseSaidaE1("sem json"), /sem JSON/);
});

test("fato numérico sem unidade do catálogo vira texto, não some (achado do teste em produção)", () => {
  const s = parseSaidaE1(JSON.stringify({ nomes: [], fatos: [{ tema: "Idade do fundador", afirmacao: "Tenho 64 anos.", valor_min: 64, valor_max: 64, unidade: null }] }));
  assert.equal(s.fatos.length, 1);
  assert.equal(s.fatos[0].valor_min, null);
  assert.equal(s.fatos[0].afirmacao, "Tenho 64 anos.");
  assert.match(s.rejeitados[0].erros.join(" "), /guardado como texto/);
});

test("prompt E1 sem travessão e com as regras do BRIEF", () => {
  const p = promptE1();
  assert.ok(!/[—–]/.test(p));
  for (const trecho of ["Nunca promova um fato a VERIFICADO", "nunca um valor médio", "ausencia = true", "Use só as entradas", "A CONFIRMAR"]) {
    assert.ok(p.includes(trecho), trecho);
  }
});
