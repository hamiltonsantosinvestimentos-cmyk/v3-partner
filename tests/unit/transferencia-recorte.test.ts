// Filtro de colunas por papel e travas da transferência (BRIEF Mesa M&A bloco C, segunda entrega, 01/11/2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { recortarTransferenciaPorPapel } from "../../lib/ma/transferencias";

const DEAL = "2f1c7a52-3f0e-4c7f-9d6a-0b1d4c9e8a11";
const listing = { id: "l1", ma_deal_id: DEAL, anonymous_id: null, metadata: { transferencia: { motivo: "x" }, outro: 1 } };

test("equipe recebe ma_deal_id e classificacao_pendente", () => {
  for (const role of ["ADMIN", "GESTAO", "MESA_OPERACIONAL"]) {
    const r = recortarTransferenciaPorPapel(listing, role, "anonymous_id");
    assert.equal(r.ma_deal_id, DEAL);
    assert.equal(r.classificacao_pendente, true);
  }
  assert.equal(recortarTransferenciaPorPapel({ ...listing, anonymous_id: "V3-BA-2026-11-AGR-001" }, "ADMIN", "anonymous_id").classificacao_pendente, false);
  assert.equal(recortarTransferenciaPorPapel({ id: "c1", ma_deal_id: null, code: null }, "ADMIN", "code").classificacao_pendente, false);
});

test("partner, instituição, anônimo e papel vazio não recebem nenhum campo de transferência", () => {
  for (const role of ["PARTNER", "PARTNER_PRO", "ENTERPRISE", "INSTITUICAO", "FINANCEIRO", "", null, undefined]) {
    const r = recortarTransferenciaPorPapel(listing, role as string, "anonymous_id");
    assert.ok(!("ma_deal_id" in r));
    assert.ok(!("classificacao_pendente" in r));
    assert.deepEqual(r.metadata, { outro: 1 });
    assert.ok(!JSON.stringify(r).includes(DEAL));
  }
});

test("as duas rotas de listagem aplicam o filtro", () => {
  const raiz = path.resolve(__dirname, "..", "..");
  const l = fs.readFileSync(path.join(raiz, "app/api/cm/listings/route.ts"), "utf8");
  const c = fs.readFileSync(path.join(raiz, "app/api/credit-proposals/route.ts"), "utf8");
  assert.match(l, /recortarTransferenciaPorPapel\(l as Record<string, unknown>, caller\.role, "anonymous_id"\)/);
  assert.equal((c.match(/recortarTransferenciaPorPapel\(/g) ?? []).length, 2);
});

test("a rota de status recusa vitrine sem código e a transferência não grava originator_profile_id", () => {
  const raiz = path.resolve(__dirname, "..", "..");
  const st = fs.readFileSync(path.join(raiz, "app/api/cm/listings/[id]/status/route.ts"), "utf8");
  assert.match(st, /\["ativo_vitrine", "proposta_recebida"\]\.includes\(new_status\)/);
  assert.match(st, /alvo\?\.ma_deal_id && !alvo\.anonymous_id/);
  const mig = fs.readFileSync(path.join(raiz, "supabase/migrations/20261030g_ma_transferir_esteira.sql"), "utf8");
  const insertListing = mig.slice(mig.indexOf("insert into public.cm_asset_listings"), mig.indexOf("insert into public.cm_asset_listings") + 400);
  assert.doesNotMatch(insertListing, /originator_profile_id/);
});
