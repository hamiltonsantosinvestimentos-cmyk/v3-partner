// Política de sigilo (31/10/2026): recortes do deal e do cliente para o originador.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ehPapelInternoDeal, ehOriginadorDoDeal, recorteDealParaOriginador, recorteListaParaOriginador,
  clientesDoLadoDoOriginador, COLUNAS_DEAL_ORIGINADOR, ladoValido,
} from "../../lib/ma/acesso-deal";

const dealCompleto = {
  id: "d1", code: "C1", v3_code: "V3-1", title: "Alvo", target_company: "Alvo SA", sector: "Agro",
  deal_value: 10, stage: "PROSPECTING", status: "ACTIVE", asset_data: { a: 1 }, documents: [],
  buyer_name: "Comprador X", seller_name: "Vendedor Y", contract_status: null,
  notes: "nota interna", comments: [{ t: "interno" }], assigned_to: "u9", probability_percent: 50,
  closed_reason: "motivo", deletion_reason: "x", originator_profile_id: "p1", created_by: "p2",
};

test("papéis internos do deal", () => {
  for (const r of ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"]) assert.equal(ehPapelInternoDeal(r), true);
  for (const r of ["PARTNER", "PARTNER_PRO", "GOLD", "DIAMANTE", "STARTER", "ENTERPRISE", "PARTNER_HE", "INSTITUICAO", "SDR", "CLOSER", null, undefined, ""]) {
    assert.equal(ehPapelInternoDeal(r as string | null), false);
  }
});

test("originador é originator_profile_id ou created_by, nunca assigned_to", () => {
  assert.equal(ehOriginadorDoDeal(dealCompleto, "p1"), true);
  assert.equal(ehOriginadorDoDeal(dealCompleto, "p2"), true);
  assert.equal(ehOriginadorDoDeal(dealCompleto, "u9"), false);
  assert.equal(ehOriginadorDoDeal(dealCompleto, "outro"), false);
  assert.equal(ehOriginadorDoDeal(dealCompleto, null), false);
});

test("detalhe do originador: só a allowlist, sem campos internos", () => {
  const r = recorteDealParaOriginador(dealCompleto);
  for (const proibida of ["notes", "comments", "assigned_to", "probability_percent", "closed_reason", "deletion_reason", "originator_profile_id", "created_by"]) {
    assert.equal(proibida in r, false, proibida);
  }
  for (const k of Object.keys(r)) assert.ok((COLUNAS_DEAL_ORIGINADOR as readonly string[]).includes(k), k);
  assert.deepEqual(r.asset_data, { a: 1 });
});

test("identidade da contraparte nula até o contrato assinado e liberada depois", () => {
  const antes = recorteDealParaOriginador(dealCompleto);
  assert.equal(antes.buyer_name, null);
  assert.equal(antes.seller_name, null);
  const depois = recorteDealParaOriginador({ ...dealCompleto, contract_status: "SIGNED" });
  assert.equal(depois.buyer_name, "Comprador X");
  assert.equal(depois.seller_name, "Vendedor Y");
});

test("lista do originador: só colunas mínimas, sem asset_data nem identidade", () => {
  const r = recorteListaParaOriginador(dealCompleto);
  for (const proibida of ["asset_data", "documents", "description", "buyer_name", "seller_name", "notes", "comments", "assigned_to"]) {
    assert.equal(proibida in r, false, proibida);
  }
  assert.equal(r.target_company, "Alvo SA");
});

test("lado do originador inválido ou ausente é nulo", () => {
  assert.equal(ladoValido("vendedor"), "vendedor");
  assert.equal(ladoValido("comprador"), "comprador");
  for (const v of [null, undefined, "", "intermediario", "VENDEDOR", 1]) assert.equal(ladoValido(v), null);
});

test("cliente do deal: tabela de decisão fail-closed", () => {
  const v = (role: string | null) => ({ role, status: "ativo", legal_name: "N", document_type: "cnpj", document_number: "11", v3_client_id: "x", first_seen_at: "y" } as never);
  assert.equal(clientesDoLadoDoOriginador("vendedor", [v("vendedor")]).length, 1);
  assert.equal(clientesDoLadoDoOriginador("comprador", [v("comprador")]).length, 1);
  assert.deepEqual(clientesDoLadoDoOriginador("vendedor", [v("comprador")]), []);
  assert.deepEqual(clientesDoLadoDoOriginador("comprador", [v("vendedor")]), []);
  assert.deepEqual(clientesDoLadoDoOriginador("vendedor", [v("intermediario")]), []);
  assert.deepEqual(clientesDoLadoDoOriginador("vendedor", [v(null)]), []);
  assert.deepEqual(clientesDoLadoDoOriginador(null, [v("vendedor")]), []);
  assert.deepEqual(clientesDoLadoDoOriginador("invalido", [v("vendedor")]), []);
  const so = clientesDoLadoDoOriginador("vendedor", [v("vendedor"), v("comprador")]);
  assert.equal(so.length, 1);
  assert.deepEqual(Object.keys(so[0]).sort(), ["document_number", "document_type", "legal_name", "role", "status"]);
});
