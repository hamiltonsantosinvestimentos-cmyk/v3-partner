import { test, expect } from "@playwright/test";

// Bolsa de Ativos: Calculadora Rapida de Comissionamento, Recorrencia e
// Lamina de Fechamento (Mesa de Capitais).
//
// Diferenca deliberada em relacao ao spec original recebido: nao existe rota
// dedicada "/bolsa/calculadora". A calculadora rapida e um MODAL dentro de
// "/bolsa/mesa", atras do mesmo gate de role (ADMIN/GESTAO/MESA_OPERACIONAL)
// que ja protege a Mesa de Capitais inteira.
//
// Fase 3 (06/08/2026), cascata top-down sem trava de soma: cada lado
// (Compra/Venda) recebe uma fatia bruta independente da Comissao Total,
// V3 e Mandatario sao % manuais do lado, Intermediarios e sempre o resto
// automatico (pode dar negativo, decisao explicita de Joao: tela nunca
// bloqueia por mensagem de erro, so desabilita o botao de PDF daquele lado
// especifico quando o saldo fica negativo). 3 variantes de PDF: Buy-Side,
// Sell-Side (cada uma so com os proprios numeros) e Consolidado/Mesa V3
// (uso interno, mostra os dois lados).
//
// Sessao QA compartilhada (tests/e2e/auth.setup.ts) e ADMIN, ja tem acesso
// a Mesa de Capitais, sem setup adicional de role neste arquivo.

async function abrirCalculadora(page: import("@playwright/test").Page) {
  await page.goto("/bolsa/mesa");
  await expect(page.getByRole("heading", { name: "Mesa de Capitais" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Calculadora Rápida" }).click();
  await expect(page.getByText("Calculadora Rápida · Comissionamento e Lâmina de Fechamento")).toBeVisible();
}

test.describe("Bolsa de Ativos - Calculadora Rapida de Comissionamento (Fase 3, cascata sem trava)", () => {
  test("calcula em tempo real, sem bloqueio, e habilita os 3 PDFs quando os saldos ficam positivos", async ({ page }) => {
    await abrirCalculadora(page);

    // Mascara "maquineta" (maskCurrencyBRLInput): os digitos representam
    // CENTAVOS ("100000000" -> R$ 1.000.000,00).
    await page.fill('input[name="face_value"]', "100000000");
    await page.fill('input[name="fee_total_pct"]', "10");

    // Nunca deve aparecer qualquer mensagem de "precisa somar 100%" nesta
    // versao, a trava foi removida deliberadamente.
    await expect(page.getByText(/precisa somar 100%/i)).toHaveCount(0);

    // Lado Compra (default Fatia do Lado = 50%): V3 20%, Mandatario 30%
    // -> Intermediarios = 50% do lado, positivo.
    await page.fill('input[name="buy_fee_v3_pct"]', "20");
    await page.fill('input[name="buy_mandatario_pct"]', "30");

    // Lado Venda (default 50%): V3 15%, Mandatario 25% -> Intermediarios = 60%, positivo.
    await page.fill('input[name="sell_fee_v3_pct"]', "15");
    await page.fill('input[name="sell_mandatario_pct"]', "25");

    // Resultado calcula sozinho, sem clicar em nenhum botao "Calcular".
    await expect(page.getByText("R$ 100.000,00")).toBeVisible(); // Comissao Total = 10% de R$1M

    // Nenhum aviso de saldo negativo deve aparecer com esses valores.
    await expect(page.getByText(/Ajuste as fatias/i)).toHaveCount(0);

    // Os 3 botoes de PDF ficam habilitados.
    await expect(page.getByRole("button", { name: /PDF Buy-Side/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /PDF Sell-Side/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /PDF Consolidado/i })).toBeEnabled();

    const [downloadBuy] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /PDF Buy-Side/i }).click(),
    ]);
    expect(downloadBuy.suggestedFilename()).toContain("BuySide");

    const [downloadConsolidado] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /PDF Consolidado/i }).click(),
    ]);
    expect(downloadConsolidado.suggestedFilename()).toContain("Consolidado");
  });

  test("saldo de Intermediarios negativo nao trava a tela, so desabilita o PDF daquele lado", async ({ page }) => {
    await abrirCalculadora(page);

    await page.fill('input[name="face_value"]', "50000000"); // R$ 500.000,00
    await page.fill('input[name="fee_total_pct"]', "5");

    // Lado Compra: V3 70% + Mandatario 50% = 120% do lado -> Intermediarios negativo.
    await page.fill('input[name="buy_fee_v3_pct"]', "70");
    await page.fill('input[name="buy_mandatario_pct"]', "50");

    // Nenhuma mensagem de erro bloqueante em nenhum momento.
    await expect(page.getByText(/precisa somar 100%/i)).toHaveCount(0);
    await expect(page.getByText(/erro ao calcular/i)).toHaveCount(0);

    // Aviso especifico do lado negativo aparece, e o botao de PDF daquele
    // lado fica desabilitado; o do outro lado continua livre.
    await expect(page.getByText(/Ajuste as fatias/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /PDF Buy-Side/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /PDF Sell-Side/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /PDF Consolidado/i })).toBeDisabled();
  });
});
