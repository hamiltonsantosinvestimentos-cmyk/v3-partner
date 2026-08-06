import { test, expect } from "@playwright/test";

// Bolsa de Ativos: Calculadora Rapida de Comissionamento, Recorrencia e
// Lamina de Fechamento (Mesa de Capitais).
//
// Diferenca deliberada em relacao ao spec original recebido: nao existe rota
// dedicada "/bolsa/calculadora". A calculadora rapida e um MODAL dentro de
// "/bolsa/mesa", atras do mesmo gate de role (ADMIN/GESTAO/MESA_OPERACIONAL)
// que ja protege a Mesa de Capitais inteira. Uma rota publica separada
// obrigaria replicar o gate de acesso em mais um lugar, contrariando o
// requisito explicito de Joao ("nao aparece para todos os partners").
//
// Sessao QA compartilhada (tests/e2e/auth.setup.ts) e ADMIN, ja tem acesso
// a Mesa de Capitais, sem setup adicional de role neste arquivo.

test.describe("Bolsa de Ativos - Calculadora Rapida de Comissionamento", () => {
  test("calcula o split de comissao com desagio e multiplica pelos meses de recorrencia", async ({ page }) => {
    await page.goto("/bolsa/mesa");
    await expect(page.getByRole("heading", { name: "Mesa de Capitais" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Calculadora Rápida" }).click();
    await expect(page.getByText("Calculadora Rápida · Comissionamento e Lâmina de Fechamento")).toBeVisible();

    // Valor de face de R$ 1.000.000,00, sem desagio (fee incide sobre o
    // valor de face, mesmo criterio ja usado pela RPC calculate_cm_commission_split).
    // O campo usa a mascara "maquineta" (maskCurrencyBRLInput, mesmo padrao de
    // ask_price_floor/valor_face em mesa-capitais-client.tsx): page.fill() entrega
    // o valor de uma vez so, entao os digitos precisam representar CENTAVOS
    // ("100000000" -> R$ 1.000.000,00), nao o valor em reais direto.
    await page.fill('input[name="face_value"]', "100000000");
    await page.fill('input[name="desconto_desagio_pct"]', "0");

    // Fee total 10%, split fechado 100% entre compra/venda/V3 (Mesa define
    // fee_v3_pct manualmente por operacao, nunca calculado).
    await page.fill('input[name="fee_total_pct"]', "10");
    await page.fill('input[name="fee_v3_pct"]', "20");
    await page.fill('input[name="buy_side_pct"]', "40");
    await page.fill('input[name="sell_side_pct"]', "40");

    // Ativa recorrencia de 12 meses
    await page.check('input[name="is_recurrent"]');
    await page.fill('input[name="recurrence_months"]', "12");

    await page.getByRole("button", { name: "Calcular", exact: true }).click();

    // Valida se o volume acumulado reflete R$ 12.000.000,00 (1.000.000 x 12 meses)
    const totalVolume = await page.locator(".total-accumulated-volume").textContent();
    expect(totalVolume).toContain("12.000.000");

    // Valida se os botoes de exportacao ficam habilitados apos o calculo
    const exportPdfBtn = page.getByRole("button", { name: /Salvar PDF/i });
    await expect(exportPdfBtn).toBeVisible();
    await expect(exportPdfBtn).toBeEnabled();
    await expect(page.getByRole("button", { name: /Gerar Imagem/i })).toBeEnabled();
  });

  test("bloqueia calculo quando compra + venda + V3 nao fecham 100%", async ({ page }) => {
    await page.goto("/bolsa/mesa");
    await page.getByRole("button", { name: "Calculadora Rápida" }).click();

    await page.fill('input[name="face_value"]', "50000000"); // R$ 500.000,00 (mascara maquineta)
    await page.fill('input[name="buy_side_pct"]', "30");
    await page.fill('input[name="sell_side_pct"]', "30");
    await page.fill('input[name="fee_v3_pct"]', "30"); // soma = 90%, nao fecha 100%

    await page.getByRole("button", { name: "Calcular", exact: true }).click();

    await expect(page.getByText(/precisa somar 100%/i)).toBeVisible();
  });
});
