import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { QA_CM_LISTING_ID, NONEXISTENT_CONTRACT_ID } from "./fixtures";

// Bolsa de Capitais V3 — Fase 3 (SLA 48h, Match ID, Esteira de Qualificacao).
//
// Escopo deliberado (mesmo racional de ma-embarcacoes-pipeline.spec.ts): o
// preenchimento publico de qualificacao e criado DIRETO no banco via service
// role, nao via POST /api/cm/qualifications, para nao disparar e-mail real
// via Resend a cada execucao de CI. A rota de criacao em si e testada so no
// caminho de validacao (422), que nao chega a enviar nada.

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes (ver .env.local)");
  return createClient(url, key);
}

test.describe("Bolsa de Capitais — SLA de Assinaturas", () => {
  test("GET pending-sla retorna o shape esperado", async ({ request }) => {
    const res = await request.get("/api/cm/contracts/pending-sla");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(Array.isArray(json.summary)).toBe(true);
  });

  test("GET listings/[id]/contracts retorna o shape esperado", async ({ request }) => {
    const res = await request.get(`/api/cm/listings/${QA_CM_LISTING_ID}/contracts`);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(Array.isArray(json.contracts)).toBe(true);
  });

  test("POST resend em contrato inexistente retorna 404", async ({ request }) => {
    const res = await request.post(`/api/cm/contracts/${NONEXISTENT_CONTRACT_ID}/resend`);
    expect(res.status()).toBe(404);
  });
});

test.describe("Bolsa de Capitais — Match ID", () => {
  test("generate_cm_match_id gera codigo no formato MATCH-YYYY-NNN", async () => {
    const db = svc();
    const { data, error } = await db.rpc("generate_cm_match_id");
    expect(error).toBeNull();
    expect(data).toMatch(/^MATCH-\d{4}-\d{3}$/);
  });
});

test.describe("Bolsa de Capitais — Esteira de Qualificação de Partes", () => {
  test("POST /api/cm/qualifications rejeita document_type inválido (422, sem enviar e-mail)", async ({ request }) => {
    const res = await request.post("/api/cm/qualifications", {
      data: {
        listing_id: QA_CM_LISTING_ID,
        document_type: "tipo_invalido",
        parties: [{ full_name: "Teste", email: "teste@v3partners.com.br", role_in_document: "parte_principal" }],
      },
    });
    expect(res.status()).toBe(422);
  });

  test("POST /api/cm/qualifications rejeita lote sem envolvidos (422)", async ({ request }) => {
    const res = await request.post("/api/cm/qualifications", {
      data: { listing_id: QA_CM_LISTING_ID, document_type: "nda_quadripartite", parties: [] },
    });
    expect(res.status()).toBe(422);
  });

  test("fluxo público de preenchimento: token válido, CPF inválido rejeitado, depois preenchimento completo trava o link", async ({ request }) => {
    const db = svc();
    const token = randomUUID().replace(/-/g, "");

    const { data: batch, error: batchError } = await db
      .from("cm_qualification_batches")
      .insert({ listing_id: QA_CM_LISTING_ID, document_type: "mandato" })
      .select("id")
      .single();
    expect(batchError).toBeNull();

    const { error: qualError } = await db.from("cm_party_qualifications").insert({
      batch_id: batch!.id,
      full_name: "QA Playwright Mandatário",
      email: "qa-playwright@v3partners.com.br",
      role_in_document: "mandatario",
      qualification_token: token,
    });
    expect(qualError).toBeNull();

    try {
      // GET público: token válido, ainda pendente
      const getRes = await request.get(`/api/cm/qualificacao/${token}`);
      expect(getRes.ok()).toBeTruthy();
      const getJson = await getRes.json();
      expect(getJson.role_in_document).toBe("mandatario");
      expect(getJson.document_type_label).toBe("Mandato");

      // POST com CPF inválido: rejeitado antes de gravar
      const invalidRes = await request.post(`/api/cm/qualificacao/${token}`, {
        data: { cpf_cnpj: "111.111.111-11", rg: "12.345.678-9", endereco_completo: "Rua Teste, 123", pix_key: "qa@v3partners.com.br" },
      });
      expect(invalidRes.status()).toBe(422);

      // POST com CPF válido (11144477735, checksum real): completa o único
      // envolvido do lote — batch_complete precisa vir true
      const validRes = await request.post(`/api/cm/qualificacao/${token}`, {
        data: { cpf_cnpj: "111.444.777-35", rg: "12.345.678-9", endereco_completo: "Rua Teste, 123", pix_key: "qa@v3partners.com.br" },
      });
      expect(validRes.ok()).toBeTruthy();
      const validJson = await validRes.json();
      expect(validJson.batch_complete).toBe(true);

      // GET de novo: link já preenchido, deve travar (409)
      const lockedRes = await request.get(`/api/cm/qualificacao/${token}`);
      expect(lockedRes.status()).toBe(409);
    } finally {
      // Cleanup: apaga o lote de teste (cascade remove a qualificação)
      await db.from("cm_qualification_batches").delete().eq("id", batch!.id);
    }
  });

  test("GET qualificação com token inexistente retorna 404", async ({ request }) => {
    const res = await request.get("/api/cm/qualificacao/token-que-nao-existe-123456");
    expect(res.status()).toBe(404);
  });
});
