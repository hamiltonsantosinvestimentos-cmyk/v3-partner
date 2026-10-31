// Bloco C da Mesa M&A (30/10/2026): selo do card e caminho do ativo.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anexarTransferencias } from "../../lib/ma/transferencias";

type Linha = Record<string, unknown>;

// Cliente falso: cada tabela devolve as linhas combinadas, e só o .in("ma_deal_id", ids) filtra.
function bancoFalso(tabelas: Record<string, Linha[]>, consultas: string[] = []): SupabaseClient {
  return {
    from(tabela: string) {
      consultas.push(tabela);
      return {
        select() {
          return {
            in(_coluna: string, ids: string[]) {
              return Promise.resolve({ data: (tabelas[tabela] ?? []).filter((l) => ids.includes(l.ma_deal_id as string)) });
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

test("sem deals: não consulta o banco e devolve lista vazia", async () => {
  const consultas: string[] = [];
  const r = await anexarTransferencias(bancoFalso({}, consultas), []);
  assert.deepEqual(r, []);
  assert.deepEqual(consultas, []);
});

test("deal sem registro de destino recebe transferencias vazio", async () => {
  const r = await anexarTransferencias(bancoFalso({}), [{ id: "d1" }]);
  assert.deepEqual(r[0].transferencias, []);
});

test("agrupa por deal e destino, com código vazio como null", async () => {
  const db = bancoFalso({
    cm_asset_listings: [{ id: "l1", ma_deal_id: "d1", anonymous_id: null, deleted_at: null, created_at: "2026-10-30T10:00:00Z" }],
    credit_desk_proposals: [{ id: "c1", ma_deal_id: "d1", code: "V3-CR-2026-10-GRL-022", deleted_at: null, created_at: "2026-10-30T11:00:00Z" }],
  });
  const [d1] = await anexarTransferencias(db, [{ id: "d1" }]);
  assert.equal(d1.transferencias.length, 2);
  const bolsa = d1.transferencias.find((t) => t.destino === "bolsa");
  const credito = d1.transferencias.find((t) => t.destino === "credito");
  assert.equal(bolsa?.codigo, null);
  assert.equal(bolsa?.cancelado, false);
  assert.equal(credito?.codigo, "V3-CR-2026-10-GRL-022");
});

test("o registro mais recente de cada destino vale, e cancelado vem marcado", async () => {
  const db = bancoFalso({
    cm_asset_listings: [
      { id: "antigo", ma_deal_id: "d1", anonymous_id: null, deleted_at: "2026-10-30T12:00:00Z", created_at: "2026-10-30T09:00:00Z" },
      { id: "novo", ma_deal_id: "d1", anonymous_id: null, deleted_at: null, created_at: "2026-10-30T13:00:00Z" },
    ],
  });
  const [d1] = await anexarTransferencias(db, [{ id: "d1" }]);
  assert.equal(d1.transferencias.length, 1);
  assert.equal(d1.transferencias[0].registro_id, "novo");
  assert.equal(d1.transferencias[0].cancelado, false);

  const soCancelado = bancoFalso({
    cm_asset_listings: [{ id: "x", ma_deal_id: "d2", anonymous_id: null, deleted_at: "2026-10-30T12:00:00Z", created_at: "2026-10-30T09:00:00Z" }],
  });
  const [d2] = await anexarTransferencias(soCancelado, [{ id: "d2" }]);
  assert.equal(d2.transferencias[0].cancelado, true);
});

test("registros de um deal não vazam para outro", async () => {
  const db = bancoFalso({
    cm_asset_listings: [{ id: "l1", ma_deal_id: "d1", anonymous_id: "V3-BA-2026-10-GRL-001", deleted_at: null, created_at: "2026-10-30T10:00:00Z" }],
  });
  const r = await anexarTransferencias(db, [{ id: "d1" }, { id: "d2" }]);
  assert.equal(r[0].transferencias.length, 1);
  assert.equal(r[1].transferencias.length, 0);
});
