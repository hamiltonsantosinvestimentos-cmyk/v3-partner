import { test, expect, APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M&A V3 Partners — Esteira de 4 etapas (FPA Compra, Carta de Intencao, FPA
// Venda, Contrato de Venda). Cria e apaga convites descartaveis a cada
// execucao (mesmo padrao usado nas sessoes de verificacao manual desta
// feature).
//
// Escopo deliberado: testa os fluxos que NAO disparam ClickSign/Resend real
// a cada rodada de CI (FPA Compra, e os caminhos de erro/validacao de
// Contrato de Venda e FPA Venda). O envio real com assinatura ao vivo foi
// verificado manualmente contra producao durante o desenvolvimento desta
// feature, nao e re-executado aqui para nao enviar e-mail real a cada CI.
//
// IMPORTANTE: usa um deal room de fixture dedicado (QA Playwright, deal
// W5/e65dce3a...), nunca o deal room de uma operacao real. Ate 2026-07-25
// este teste usava o deal room real do MA-26-30823 (embarcacoes
// Dalmolin/Gustavo), o que injetava notificacoes de teste na Timeline de
// uma operacao de verdade a cada push para main (o workflow
// .github/workflows/e2e-tests.yml roda esta suite a cada push). Corrigido
// apos o proprio Joao notar o ruido na Timeline real em producao.

const DEAL_ROOM_ID = "c3b8a0f8-9d29-4622-9fd2-2941c9012b2f"; // fixture QA Playwright, deal W5 (e65dce3a...)

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes (ver .env.local)");
  return createClient(url, key);
}

async function createInvite(accessSide: "buyer" | "seller" | "intermediario") {
  const db = svc();
  const token = `pw-${accessSide}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await db
    .from("deal_room_invites")
    .insert({
      deal_room_id: DEAL_ROOM_ID,
      investor_name: "Teste Playwright",
      investor_email: "playwright-test@v3partners.com.br",
      access_side: accessSide,
      token,
      token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Falha ao criar invite de teste: ${error?.message}`);
  return { inviteId: data.id as string, token };
}

async function cleanupInvite(inviteId: string) {
  const db = svc();
  await db.from("operation_contracts").delete().eq("deal_room_invite_id", inviteId);
  await db.from("deal_room_invites").delete().eq("id", inviteId);
}

test.describe("M&A V3 Partners, Esteira de Embarcacoes (4 etapas)", () => {
  test("FPA Compra: GET carrega contexto do deal (deducao 6%)", async ({ request }) => {
    const { inviteId, token } = await createInvite("intermediario");
    try {
      const getRes = await request.get(`/api/investor/fpa-compra-intake/${token}`);
      expect(getRes.ok()).toBeTruthy();
      const getBody = await getRes.json();
      expect(getBody.deal_code).toBeTruthy();
      expect(getBody.deducao_percent).toBe(6);
    } finally {
      await cleanupInvite(inviteId);
    }
  });

  test("FPA Compra: rejeita submissao sem local de assinatura", async ({ request }) => {
    const { inviteId, token } = await createInvite("intermediario");
    try {
      const res = await request.post(`/api/investor/fpa-compra-intake/${token}`, {
        data: {
          participantes: [{ nome: "Gustavo Teste", cpf_cnpj: "111.444.777-35", email: "gustavo-teste@v3partners.com.br", bluepay_pix: "gustavo@chavepix.com", valor_bruto: 109200 }],
          local: "",
        },
      });
      expect(res.status()).toBe(422);
    } finally {
      await cleanupInvite(inviteId);
    }
  });

  test("FPA Compra: rejeita valor_bruto ausente antes de acionar ClickSign", async ({ request }) => {
    const { inviteId, token } = await createInvite("intermediario");
    try {
      const res = await request.post(`/api/investor/fpa-compra-intake/${token}`, {
        data: {
          participantes: [{ nome: "Gustavo Teste", cpf_cnpj: "111.444.777-35", email: "gustavo-teste@v3partners.com.br", bluepay_pix: "gustavo@chavepix.com", valor_bruto: 0 }],
          local: "Rio de Janeiro, RJ",
        },
      });
      expect(res.status()).toBe(422);
    } finally {
      await cleanupInvite(inviteId);
    }
  });

  test("FPA Compra: gate de access_side, invite errado e rejeitado", async ({ request }) => {
    const { inviteId, token } = await createInvite("buyer"); // errado de proposito
    try {
      const res = await request.get(`/api/investor/fpa-compra-intake/${token}`);
      expect(res.status()).toBe(403);
    } finally {
      await cleanupInvite(inviteId);
    }
  });

  test("FPA Compra: rejeita participante sem email valido", async ({ request }) => {
    const { inviteId, token } = await createInvite("intermediario");
    try {
      const res = await request.post(`/api/investor/fpa-compra-intake/${token}`, {
        data: { participantes: [{ nome: "Teste", cpf_cnpj: "111.444.777-35", email: "nao-e-email", bluepay_pix: "x" }] },
      });
      expect(res.status()).toBe(422);
    } finally {
      await cleanupInvite(inviteId);
    }
  });

  test("Contrato de Venda: gate de access_side, invite errado e rejeitado", async ({ request }) => {
    const { inviteId, token } = await createInvite("buyer"); // access_side errado de proposito
    try {
      const res = await request.get(`/api/investor/contrato-venda-intake/${token}`);
      expect(res.status()).toBe(403);
    } finally {
      await cleanupInvite(inviteId);
    }
  });

  test("Contrato de Venda: rejeita CNPJ invalido antes de acionar ClickSign", async ({ request }) => {
    const { inviteId, token } = await createInvite("seller");
    try {
      const res = await request.post(`/api/investor/contrato-venda-intake/${token}`, {
        data: {
          razao_social_estaleiro: "Estaleiro Teste Ltda",
          cnpj_estaleiro: "00.000.000/0000-00", // invalido
          nome_representante: "Teste",
          email: "teste@v3partners.com.br",
          local: "Rio de Janeiro, RJ",
        },
      });
      expect(res.status()).toBe(422);
    } finally {
      await cleanupInvite(inviteId);
    }
  });

  test("FPA Venda: gate de access_side, invite errado e rejeitado", async ({ request }) => {
    const { inviteId, token } = await createInvite("intermediario"); // errado de proposito
    try {
      const res = await request.get(`/api/investor/fpa-venda-intake/${token}`);
      expect(res.status()).toBe(403);
    } finally {
      await cleanupInvite(inviteId);
    }
  });

  test("FPA Venda: rejeita submissao sem participantes", async ({ request }) => {
    const { inviteId, token } = await createInvite("seller");
    try {
      const res = await request.post(`/api/investor/fpa-venda-intake/${token}`, {
        data: { participantes: [], local: "Rio de Janeiro, RJ" },
      });
      expect(res.status()).toBe(422);
    } finally {
      await cleanupInvite(inviteId);
    }
  });

  test("FPA Venda: calculo de deducao de 6% e responsabilidade do form, API valida valor_bruto > 0", async ({ request }) => {
    const { inviteId, token } = await createInvite("seller");
    try {
      const res = await request.post(`/api/investor/fpa-venda-intake/${token}`, {
        data: {
          participantes: [
            { nome: "Rafael Teste", cpf_cnpj: "111.444.777-35", email: "rafael-teste@v3partners.com.br", bluepay_pix: "rafael@chavepix.com", valor_bruto: 0 },
          ],
          local: "Rio de Janeiro, RJ",
        },
      });
      expect(res.status()).toBe(422);
    } finally {
      await cleanupInvite(inviteId);
    }
  });

  test("Painel /propostas: timeline da esteira reflete o estagio real de cada operacao", async ({ request }: { request: APIRequestContext }) => {
    // Insercao direta via Supabase (nao pelo intake publico): os 4 documentos
    // da esteira agora exigem ClickSign real para sair de "rascunho", e este
    // teste verifica a logica de agregacao/match da timeline, nao o envio
    // ao ClickSign em si (ja coberto pelas verificacoes manuais desta sessao).
    const db = svc();
    const { inviteId, token } = await createInvite("intermediario");
    let contractId: string | null = null;
    try {
      const { data: template } = await db.from("contract_templates").select("id").eq("template_name", "FPA Compra").single();
      expect(template, "template FPA Compra deveria existir").toBeTruthy();

      const { data: invite } = await db.from("deal_room_invites").select("deal_room_id").eq("id", inviteId).single();
      const { data: room } = await db.from("deal_rooms").select("deal_id").eq("id", invite!.deal_room_id).single();

      const { data: contract, error } = await db
        .from("operation_contracts")
        .insert({
          template_id: template!.id,
          vertical: "ma",
          contract_title: "FPA Compra, Deal TESTE-PLAYWRIGHT",
          rendered_html: "<p>teste</p>",
          status_signature: "enviado_assinatura",
          deal_id: room!.deal_id,
          deal_room_invite_id: inviteId,
          created_by: "d0af8eaa-9f3c-4e7a-b8c6-613736524317",
        })
        .select("id")
        .single();
      expect(error, error?.message).toBeFalsy();
      contractId = contract!.id;

      const timelineRes = await request.get("/api/ma/loi-contracts");
      expect(timelineRes.ok()).toBeTruthy();
      const { operacoes } = await timelineRes.json();

      const found = (operacoes as Array<{ dealId: string; stages: Array<{ templateName: string; status: string; contractId: string | null }> }>).find(
        op => op.stages.some(s => s.contractId === contractId)
      );
      expect(found, "deveria haver a operacao com a FPA Compra de teste").toBeTruthy();

      const fpaCompraStage = found!.stages.find(s => s.templateName === "FPA Compra");
      expect(fpaCompraStage?.status).toBe("enviado_assinatura");
      expect(fpaCompraStage?.contractId).toBe(contractId);
    } finally {
      if (contractId) await db.from("operation_contracts").delete().eq("id", contractId);
      await cleanupInvite(inviteId);
    }
  });
});
