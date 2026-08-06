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
// Fase 2 (06/08/2026): cada lado (Compra/Venda) quebra em Mandatario/Titular
// (digitado em % do lado ou R$, com toggle) + Grupo de Intermediarios (sempre
// o restante automatico). Os botoes de exportacao viraram "PDF Buy-Side" e
// "PDF Sell-Side" (nunca um PDF combinado, decisao explicita de Joao para nao
// gerar conflito entre as partes). Esta suite NAO abre o PDF baixado para ler
// a nota do FPA dentro do arquivo, o projeto nao tem lib de parse de PDF e nao
// vamos inventar uma dependencia nova so para o teste; confirma o download
// real acontecendo (evento "download" do Playwright) e confere os mesmos
// numeros por papel na tela, que sao a mesma fonte de dado usada no PDF.
//
// Sessao QA compartilhada (tests/e2e/auth.setup.ts) e ADMIN, ja tem acesso
// a Mesa de Capitais, sem setup adicional de role neste arquivo.

async function abrirCalculadora(page: import("@playwright/test").Page) {
  await page.goto("/bolsa/mesa");
  await expect(page.getByRole("heading", { name: "Mesa de Capitais" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Calculadora Rápida" }).click();
  await expect(page.getByText("Calculadora Rápida · Comissionamento e Lâmina de Fechamento")).toBeVisible();
}

test.describe("Bolsa de Ativos - Calculadora Rapida de Comissionamento (Fase 2)", () => {
  test("calcula o breakdown por papel (V3/Mandatario/Intermediarios) nos dois lados e multiplica pelos meses de recorrencia", async ({ page }) => {
    await abrirCalculadora(page);

    // Valor de face R$ 1.000.000,00, sem desagio, fee total 10%.
    // Mascara "maquineta" (maskCurrencyBRLInput): os digitos representam
    // CENTAVOS ("100000000" -> R$ 1.000.000,00), nao o valor em reais direto.
    await page.fill('input[name="face_value"]', "100000000");
    await page.fill('input[name="desconto_desagio_pct"]', "0");
    await page.fill('input[name="fee_total_pct"]', "10");

    // Split de topo: V3 20%, Compra 40%, Venda 40% (soma 100%).
    await page.fill('input[name="fee_v3_pct"]', "20");
    await page.fill('input[name="buy_side_pct"]', "40");
    await page.fill('input[name="sell_side_pct"]', "40");

    // Mandatario Compra: 60% do lado Compra (unidade default = "% do lado").
    // Mandatario Venda: R$ 12.000,00 direto (troca o toggle pra R$ primeiro).
    await page.fill('input[name="buy_mandatario_input"]', "60");
    // Toggle do bloco Venda: comeca em "% do lado" (unit default = pct), clicar
    // troca para "R$". nth(1) porque o bloco Compra tem o mesmo texto de botao.
    await page.getByRole("button", { name: "% do lado" }).nth(1).click();
    await page.fill('input[name="sell_mandatario_input"]', "1200000"); // maquineta -> R$ 12.000,00

    // Ativa recorrencia de 12 meses
    await page.check('input[name="is_recurrent"]');
    await page.fill('input[name="recurrence_months"]', "12");

    await page.getByRole("button", { name: "Calcular", exact: true }).click();

    // Fee total = R$ 1.000.000,00 x 10% = R$ 100.000,00
    await expect(page.getByText("R$ 100.000,00")).toBeVisible();

    // Lado Compra: bucket = R$ 40.000,00 (40% do fee). Mandatario = 60% disso
    // = R$ 24.000,00. Intermediarios = restante = R$ 16.000,00.
    await expect(page.getByText("R$ 24.000,00").first()).toBeVisible();
    await expect(page.getByText("R$ 16.000,00").first()).toBeVisible();

    // Lado Venda: bucket = R$ 40.000,00. Mandatario digitado direto em R$ 12.000,00.
    // Intermediarios = restante = R$ 28.000,00.
    await expect(page.getByText("R$ 12.000,00").first()).toBeVisible();
    await expect(page.getByText("R$ 28.000,00").first()).toBeVisible();

    // Volume acumulado de 12 meses = R$ 1.000.000,00 x 12 = R$ 12.000.000,00
    const totalVolume = await page.locator(".total-accumulated-volume").textContent();
    expect(totalVolume).toContain("12.000.000");

    // Os dois botoes segregados ficam habilitados, e disparam download real
    // (nunca um terceiro botao de PDF combinado, nem PNG).
    await expect(page.getByRole("button", { name: /PDF Buy-Side/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /PDF Sell-Side/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Salvar PDF/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Gerar Imagem/i })).toHaveCount(0);

    const [downloadBuy] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /PDF Buy-Side/i }).click(),
    ]);
    expect(downloadBuy.suggestedFilename()).toContain("BuySide");

    const [downloadSell] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /PDF Sell-Side/i }).click(),
    ]);
    expect(downloadSell.suggestedFilename()).toContain("SellSide");
  });

  test("bloqueia calculo quando compra + venda + V3 nao fecham 100%", async ({ page }) => {
    await abrirCalculadora(page);

    await page.fill('input[name="face_value"]', "50000000"); // R$ 500.000,00 (mascara maquineta)
    await page.fill('input[name="buy_side_pct"]', "30");
    await page.fill('input[name="sell_side_pct"]', "30");
    await page.fill('input[name="fee_v3_pct"]', "30"); // soma = 90%, nao fecha 100%

    await page.getByRole("button", { name: "Calcular", exact: true }).click();

    await expect(page.getByText(/precisa somar 100%/i)).toBeVisible();
  });
});
