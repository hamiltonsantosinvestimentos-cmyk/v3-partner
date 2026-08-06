import { test, expect } from "@playwright/test";

// Bolsa de Ativos: Calculadora Rapida de Comissionamento, Recorrencia e
// Lamina de Fechamento (Mesa de Capitais).
//
// Diferenca deliberada em relacao ao spec original recebido: nao existe rota
// dedicada "/bolsa/calculadora". A calculadora rapida e um MODAL dentro de
// "/bolsa/mesa", atras do mesmo gate de role (ADMIN/GESTAO/MESA_OPERACIONAL)
// que ja protege a Mesa de Capitais inteira.
//
// Fase 4 (06/08/2026), padrao planilha "Simular Grades": todo percentual e
// SEMPRE % DIRETO da operacao (mesma escala de % Comissão Total), nunca %
// de um sub-total do lado. Cascata em 2 decotes explicitos por lado: Grupo
// (Cheia) -> Fee V3 -> Grupo Liquido -> Mandatario -> Intermediarios
// (residual automatico, nunca digitado, pode dar negativo). Nenhuma
// validacao bloqueia a tela em nenhum momento; saldo negativo so desabilita
// o PDF daquele lado especifico.
//
// Sessao QA compartilhada (tests/e2e/auth.setup.ts) e ADMIN, ja tem acesso
// a Mesa de Capitais, sem setup adicional de role neste arquivo.

async function abrirCalculadora(page: import("@playwright/test").Page) {
  await page.goto("/bolsa/mesa");
  await expect(page.getByRole("heading", { name: "Mesa de Capitais" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Calculadora Rápida" }).click();
  await expect(page.getByText("Calculadora Rápida · Comissionamento e Lâmina de Fechamento")).toBeVisible();
}

test.describe("Bolsa de Ativos - Calculadora Rapida de Comissionamento (Fase 4, padrao planilha)", () => {
  test("calcula em % direto da operacao, sem bloqueio, com Grupo Liquido explicito e Fee V3 Total", async ({ page }) => {
    await abrirCalculadora(page);

    // Mascara "maquineta" (maskCurrencyBRLInput): os digitos representam
    // CENTAVOS ("100000000" -> R$ 1.000.000,00).
    await page.fill('input[name="face_value"]', "100000000");
    await page.fill('input[name="fee_total_pct"]', "10");

    // Nunca deve aparecer qualquer mensagem de bloqueio nesta versao.
    await expect(page.getByText(/precisa somar 100%/i)).toHaveCount(0);

    // Lado Compra: Grupo Cheia 5% direto (= R$50.000,00), Fee V3 2% (R$20.000,00),
    // Mandatario 1% (R$10.000,00) -> Grupo Liquido = 5-2=3%, Intermediarios = 3-1=2% (R$20.000,00).
    await page.fill('input[name="buy_side_pct"]', "5");
    await page.fill('input[name="buy_fee_v3_pct"]', "2");
    await page.fill('input[name="buy_mandatario_pct"]', "1");

    // Lado Venda: Grupo Cheia 5%, Fee V3 1% (R$10.000,00), Mandatario 1%
    // (R$10.000,00) -> Grupo Liquido = 5-1=4%, Intermediarios = 4-1=3% (R$30.000,00).
    await page.fill('input[name="sell_side_pct"]', "5");
    await page.fill('input[name="sell_fee_v3_pct"]', "1");
    await page.fill('input[name="sell_mandatario_pct"]', "1");

    // Resultado calcula sozinho, sem clicar em nenhum botao "Calcular".
    await expect(page.getByText("R$ 100.000,00")).toBeVisible(); // % Comissão Total = 10% de R$1M
    await expect(page.getByText("R$ 50.000,00").first()).toBeVisible(); // SOMA GRUPO COMPRA (CHEIA)
    await expect(page.getByText("R$ 30.000,00").first()).toBeVisible(); // Fee V3 Total (2%+1% = 3% = R$30.000)

    // Nenhum aviso de saldo negativo com esses valores.
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

    // Lado Compra: Grupo Cheia 5% (direto), Fee V3 4% + Mandatario 3% = 7%
    // > 5% da Cheia -> Grupo Liquido 1%, Intermediarios = 1-3 = -2%, negativo.
    await page.fill('input[name="buy_side_pct"]', "5");
    await page.fill('input[name="buy_fee_v3_pct"]', "4");
    await page.fill('input[name="buy_mandatario_pct"]', "3");

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
