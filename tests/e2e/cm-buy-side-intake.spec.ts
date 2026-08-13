import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// Buy-Side Intake — recorrencia, partner de origem, documento pos-lock, painel
// "Demandas de Compra" (12/08/2026). Motivado por relato real de Joao: Dr.
// Athaydes gerou links de comprador para precatorios, os compradores
// preencheram, mas ninguem conseguia enxergar os documentos em painel algum.
// Causa raiz real (investigada, nao presumida): investor_demand_documents
// vazia (upload nunca sobrevivia ao gate de intake_locked) + demand_matches
// vazia (0 listings em ativo_vitrine + cron n8n W-CM-Match quebrado). Este
// spec cobre o que este PR corrige: persistencia de recorrencia/partner,
// upload de documento mesmo apos o formulario travado, e o painel novo que
// nao depende de nenhum match ter acontecido.

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes (ver .env.local)");
  return createClient(url, key);
}

const createdDemandIds: string[] = [];

test.afterAll(async () => {
  if (createdDemandIds.length === 0) return;
  const db = svc();
  await db.from("investor_demand_documents").delete().in("demand_id", createdDemandIds);
  await db.from("investor_demands").delete().in("id", createdDemandIds);
});

test.describe("Buy-Side Intake — recorrência + partner de origem", () => {
  test("submissão com ?partner= válido e recorrência mensal persiste os 3 campos novos", async ({ request }) => {
    const db = svc();
    const token = randomUUID().replace(/-/g, "");

    const { data: admin } = await db.from("profiles").select("id").eq("role", "ADMIN").limit(1).single();
    expect(admin?.id).toBeTruthy();

    const { data: demand, error: insertError } = await db
      .from("investor_demands")
      .insert({
        nome_contato: "Pendente", email: "pendente@pendente.com",
        setores: ["precatorio"], ufs: ["RJ"], ticket_min: 0, ticket_max: 0,
        tipos_operacao: ["compra"], origem: "intake_buy", status: "pendente", intake_token: token,
      })
      .select("id").single();
    expect(insertError).toBeNull();
    createdDemandIds.push(demand!.id);

    const res = await request.post(`/api/cm/intake/buy/${token}`, {
      data: {
        nome_contato: "QA PLAYWRIGHT BUY-SIDE FIXTURE",
        email: "qa-buyside@v3partners.com.br",
        asset_types_preferidos: ["precatorio"],
        ticket_min: "", ticket_max: "",
        nda_accepted: true,
        purchase_frequency_type: "RECURRENT_MONTHLY",
        recurrence_months: 12,
        origin_partner_id: admin!.id,
      },
    });
    expect(res.ok()).toBeTruthy();

    const { data: after } = await db
      .from("investor_demands")
      .select("purchase_frequency_type, recurrence_months, origin_partner_id, intake_locked, status")
      .eq("id", demand!.id).single();

    expect(after?.purchase_frequency_type).toBe("RECURRENT_MONTHLY");
    expect(after?.recurrence_months).toBe(12);
    expect(after?.origin_partner_id).toBe(admin!.id);
    expect(after?.intake_locked).toBe(true);
    expect(after?.status).toBe("ativo");
  });

  test("origin_partner_id inválido (não existe em profiles) nunca bloqueia o cadastro, só fica sem atribuição", async ({ request }) => {
    const db = svc();
    const token = randomUUID().replace(/-/g, "");

    const { data: demand } = await db
      .from("investor_demands")
      .insert({
        nome_contato: "Pendente", email: "pendente@pendente.com",
        setores: ["precatorio"], ufs: ["RJ"], ticket_min: 0, ticket_max: 0,
        tipos_operacao: ["compra"], origem: "intake_buy", status: "pendente", intake_token: token,
      })
      .select("id").single();
    createdDemandIds.push(demand!.id);

    const res = await request.post(`/api/cm/intake/buy/${token}`, {
      data: {
        nome_contato: "QA PLAYWRIGHT BUY-SIDE FIXTURE 2",
        email: "qa-buyside-2@v3partners.com.br",
        asset_types_preferidos: ["precatorio"],
        nda_accepted: true,
        origin_partner_id: "00000000-0000-0000-0000-000000000000",
      },
    });
    expect(res.ok()).toBeTruthy();

    const { data: after } = await db.from("investor_demands").select("origin_partner_id").eq("id", demand!.id).single();
    expect(after?.origin_partner_id).toBeNull();
  });

  test("upload de documento funciona MESMO com intake_locked=true (fix do gate que bloqueava o \"enviar depois\")", async ({ request }) => {
    const db = svc();
    const token = randomUUID().replace(/-/g, "");

    const { data: demand } = await db
      .from("investor_demands")
      .insert({
        nome_contato: "QA PLAYWRIGHT BUY-SIDE FIXTURE 3", email: "qa-buyside-3@v3partners.com.br",
        setores: ["precatorio"], ufs: ["RJ"], ticket_min: 0, ticket_max: 0,
        tipos_operacao: ["compra"], origem: "intake_buy", status: "ativo",
        intake_token: token, intake_locked: true,
      })
      .select("id").single();
    createdDemandIds.push(demand!.id);

    const res = await request.post(`/api/cm/intake/buy/${token}/documents`, {
      multipart: {
        file: { name: "loi-teste.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 teste playwright") },
        document_type: "loi_mou",
      },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.document?.document_type).toBe("loi_mou");

    const { data: docs } = await db.from("investor_demand_documents").select("id").eq("demand_id", demand!.id);
    expect(docs?.length).toBe(1);
  });

  test("GET /api/cm/investor-demands lista o comprador com document_count e origin_partner mesmo sem nenhum match", async ({ request }) => {
    const db = svc();
    const token = randomUUID().replace(/-/g, "");
    const { data: admin } = await db.from("profiles").select("id, full_name").eq("role", "ADMIN").limit(1).single();

    const { data: demand } = await db
      .from("investor_demands")
      .insert({
        nome_contato: "QA PLAYWRIGHT BUY-SIDE FIXTURE 4", email: "qa-buyside-4@v3partners.com.br",
        setores: ["precatorio"], ufs: ["RJ"], asset_types_preferidos: ["precatorio"],
        ticket_min: 1000000, ticket_max: 5000000, tipos_operacao: ["compra"],
        origem: "intake_buy", status: "ativo", intake_token: token, intake_locked: true,
        purchase_frequency_type: "SINGLE_PURCHASE", origin_partner_id: admin!.id,
      })
      .select("id").single();
    createdDemandIds.push(demand!.id);

    await db.from("investor_demand_documents").insert({
      demand_id: demand!.id, document_type: "procuracao",
      storage_path: `investor-documents/${demand!.id}/procuracao_teste.pdf`,
      original_filename: "procuracao_teste.pdf", file_size_bytes: 10,
    });

    const res = await request.get("/api/cm/investor-demands?status=ativo");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    const found = (json.demands as any[]).find((d) => d.id === demand!.id);
    expect(found).toBeTruthy();
    expect(found.document_count).toBe(1);
    expect(found.match_count).toBe(0);
    expect(found.origin_partner?.id).toBe(admin!.id);

    const kycRes = await request.get(`/api/cm/kyc-documents?demand_id=${demand!.id}`);
    expect(kycRes.ok()).toBeTruthy();
    const kycJson = await kycRes.json();
    expect(kycJson.documents?.length).toBe(1);
    expect(kycJson.documents[0].document_type).toBe("procuracao");
  });
});

test.describe("Bolsa de Capitais — painel Demandas de Compra (UI)", () => {
  test("aba lista o comprador de teste com partner, frequência e botão de documentos", async ({ page }) => {
    const db = svc();
    const token = randomUUID().replace(/-/g, "");
    const { data: admin } = await db.from("profiles").select("id, full_name").eq("role", "ADMIN").limit(1).single();

    const { data: demand } = await db
      .from("investor_demands")
      .insert({
        nome_contato: "QA PLAYWRIGHT BUY-SIDE UI FIXTURE", email: "qa-buyside-ui@v3partners.com.br",
        setores: ["precatorio"], ufs: ["RJ"], asset_types_preferidos: ["precatorio"],
        ticket_min: 1000000, ticket_max: 5000000, tipos_operacao: ["compra"],
        origem: "intake_buy", status: "ativo", intake_token: token, intake_locked: true,
        purchase_frequency_type: "RECURRENT_MONTHLY", recurrence_months: 6, origin_partner_id: admin!.id,
      })
      .select("id").single();
    createdDemandIds.push(demand!.id);

    await page.goto("/bolsa/mesa");
    await page.getByRole("button", { name: "Demandas de Compra" }).click();
    await expect(page.getByText("QA PLAYWRIGHT BUY-SIDE UI FIXTURE")).toBeVisible({ timeout: 15_000 });

    // Escopado na linha do fixture -- admin.full_name (ex: "JOAO LEMOS") tambem aparece no
    // topbar/sidebar da propria sessao logada, getByText solto na pagina inteira e ambiguo.
    const row = page.locator("tr", { hasText: "QA PLAYWRIGHT BUY-SIDE UI FIXTURE" });
    await expect(row.getByText(/Recorrente \(6m\)/)).toBeVisible();
    if (admin?.full_name) {
      await expect(row.getByText(admin.full_name)).toBeVisible();
    }

    await row.getByRole("button", { name: /Documentos/ }).click();
    await expect(page.getByText("Nenhum documento enviado ainda pelo comprador.")).toBeVisible();
  });
});

test.describe("Bolsa de Capitais — Fila de Autorização NDA (ADMIN)", () => {
  test("GET /api/cm/listings/nda-queue exige ADMIN e retorna o shape esperado", async ({ request }) => {
    const res = await request.get("/api/cm/listings/nda-queue");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(Array.isArray(json.listings)).toBe(true);
  });

  test("aba Fila NDA aparece pro ADMIN e carrega sem erro (mesmo vazia)", async ({ page }) => {
    await page.goto("/bolsa/mesa");
    await page.getByRole("button", { name: "Fila NDA" }).click();
    await expect(page.getByText("Fila de Autorização de NDA")).toBeVisible({ timeout: 15_000 });
  });
});
