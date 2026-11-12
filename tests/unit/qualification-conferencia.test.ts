import test from "node:test";
import assert from "node:assert/strict";
import {
  camposExigidos,
  declaracoesCompletas,
  declaracoesExigidas,
  montarConferencia,
} from "../../lib/qualification-conferencia";

// Dados inventados (repositório público: nunca dado real em teste).

test("PF com identidade: exige cpf_cnpj e id_number", () => {
  assert.deepEqual(camposExigidos({ cpf_cnpj: "111.111.111-11", id_number: "A1", rg: "B2" }), ["cpf_cnpj", "id_number"]);
});

test("PF só com rg: exige rg", () => {
  assert.deepEqual(camposExigidos({ cpf_cnpj: "111.111.111-11", rg: "B2" }), ["cpf_cnpj", "rg"]);
});

test("cadeia de representantes: um conjunto de campos por nó, com posição e id", () => {
  const ficha = {
    cpf_cnpj: "00.000.000/0001-00",
    representation: {
      v3_client_id: "AAA-1",
      cpf_cnpj: "222.222.222-22",
      rg: "R1",
      representation: { cpf_cnpj: "333.333.333-33" },
    },
  };
  assert.deepEqual(camposExigidos(ficha), [
    "cpf_cnpj",
    "representacao[1:aaa-1].cpf_cnpj",
    "representacao[1:aaa-1].rg",
    "representacao[2:sem-id].cpf_cnpj",
  ]);
});

test("declarações exigidas por tipo de parte", () => {
  assert.deepEqual(declaracoesExigidas("PJ"), ["cnpj"]);
  assert.deepEqual(declaracoesExigidas("PF"), ["nome", "data_nascimento"]);
  assert.deepEqual(declaracoesExigidas(null), ["nome", "data_nascimento"]);
});

test("declarações incompletas ou inválidas são recusadas", () => {
  assert.equal(declaracoesCompletas(["nome"], ["nome", "data_nascimento"]), false);
  assert.equal(declaracoesCompletas("nome", ["nome"]), false);
  assert.equal(declaracoesCompletas(["nome", "data_nascimento"], ["nome", "data_nascimento"]), true);
});

test("o resumo guarda só ids e nomes de campo", () => {
  const c = montarConferencia(["d1"], ["cpf_cnpj"], ["nome"]);
  assert.deepEqual(Object.keys(c).sort(), ["campos", "declaracoes", "documentos", "versao_texto"]);
});
