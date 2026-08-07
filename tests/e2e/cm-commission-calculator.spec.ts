import { test, expect } from "@playwright/test";
import { PDFParse } from "pdf-parse";
import { readFile } from "node:fs/promises";

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
// P0 achado ao vivo por Joao (mesmo dia, apos a Fase 4 ir pro ar): "Salvar
// Simulacao" falhava sempre com "null value in column fee_v3_pct violates
// not-null constraint", a Fase 3 parou de escrever nesse campo mas a
// coluna nunca foi migrada pra nullable. Corrigido via migration
// 20260806d. O primeiro teste abaixo agora cobre esse caminho de proposito
// (clica Salvar Simulacao de verdade), o que a suite anterior nunca fazia,
// so testava export de PDF, que roda no navegador sem tocar a API.
//
// Sessao QA compartilhada (tests/e2e/auth.setup.ts) e ADMIN, ja tem acesso
// a Mesa de Capitais, sem setup adicional de role neste arquivo.
//
// 06/08/2026: Joao reportou suspeita de bug no calculo de % Desagio ->
// Preco do Comprador. Verificado ao vivo em producao ANTES de mexer em
// codigo (regra do gate de verificacao): a formula ja funcionava
// corretamente (lib/commission-calculator.ts nunca mudou essa parte desde
// a Fase 4). O teste abaixo fecha essa cobertura que faltava, e o unico
// gap real encontrado foi a ausencia de um bloco "RESUMO FINANCEIRO DE
// AQUISICAO" com rotulo proprio no topo do PDF Buy-Side (o dado ja existia
// disperso na lamina, so nao estava agrupado/rotulado do jeito pedido).
// lib/lamina-fechamento-render.ts ganhou drawResumoAquisicao(), so no
// variante "buy". O segundo teste abaixo baixa o PDF de verdade e usa
// pdf-parse (ja instalado no repo, mesmo pacote usado em
// app/api/contracts/templates/upload/route.ts) para ler o texto real
// extraido do PDF, nao so o nome do arquivo/trigger de download.

async function abrirCalculadora(page: import("@playwright/test").Page) {
  await page.goto("/bolsa/mesa");
  await expect(page.getByRole("heading", { name: "Mesa de Capitais" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Calculadora Rápida" }).click();
  await expect(page.getByText("Calculadora Rápida · Comissionamento e Lâmina de Fechamento")).toBeVisible();
}

test.describe("Bolsa de Ativos - Calculadora Rapida de Comissionamento (Fase 4, padrao planilha)", () => {
  test("calcula em % direto, salva a simulacao sem erro de banco, e habilita os 3 PDFs", async ({ page }) => {
    await abrirCalculadora(page);

    await page.fill('input[name="face_value"]', "100000000"); // R$ 1.000.000,00
    await page.fill('input[name="fee_total_pct"]', "10");

    await expect(page.getByText(/precisa somar 100%/i)).toHaveCount(0);

    // Lado Compra: Grupo Cheia 5%, Fee V3 2%, Mandatario 1% -> Grupo Liquido
    // 3%, Intermediarios 2% (positivo).
    await page.fill('input[name="buy_side_pct"]', "5");
    await page.fill('input[name="buy_fee_v3_pct"]', "2");
    await page.fill('input[name="buy_mandatario_pct"]', "1");

    // Lado Venda: Grupo Cheia 5%, Fee V3 1%, Mandatario 1% -> Grupo Liquido
    // 4%, Intermediarios 3% (positivo).
    await page.fill('input[name="sell_side_pct"]', "5");
    await page.fill('input[name="sell_fee_v3_pct"]', "1");
    await page.fill('input[name="sell_mandatario_pct"]', "1");

    await expect(page.getByText("R$ 100.000,00")).toBeVisible(); // % Comissão Total = 10% de R$1M
    await expect(page.getByText("R$ 50.000,00").first()).toBeVisible(); // SOMA GRUPO COMPRA (CHEIA)
    await expect(page.getByText(/Ajuste as fatias/i)).toHaveCount(0);

    // P0 regressivo: clica Salvar Simulacao de verdade (bate na API/banco,
    // diferente da exportacao de PDF que roda so no navegador) e confirma
    // que NENHUM erro de constraint aparece na tela.
    await page.getByRole("button", { name: "Salvar Simulação", exact: true }).click();
    await expect(page.getByText(/not-null constraint|null value in column|erro ao salvar/i)).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText("Simulação salva.")).toBeVisible({ timeout: 10_000 });

    // Os 3 botoes de PDF ficam habilitados.
    await expect(page.getByRole("button", { name: /PDF Buy-Side/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /PDF Sell-Side/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /PDF Consolidado/i })).toBeEnabled();

    const [downloadBuy] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /PDF Buy-Side/i }).click(),
    ]);
    expect(downloadBuy.suggestedFilename()).toContain("BuySide");
  });

  test("recorrencia mostra colunas Mensal e Acumulado nas tabelas com os valores corretos", async ({ page }) => {
    await abrirCalculadora(page);

    await page.fill('input[name="face_value"]', "100000000"); // R$ 1.000.000,00
    await page.fill('input[name="fee_total_pct"]', "10");
    await page.fill('input[name="buy_side_pct"]', "5");
    await page.fill('input[name="buy_fee_v3_pct"]', "2");
    await page.fill('input[name="buy_mandatario_pct"]', "1");
    await page.fill('input[name="sell_side_pct"]', "5");
    await page.fill('input[name="sell_fee_v3_pct"]', "1");
    await page.fill('input[name="sell_mandatario_pct"]', "1");

    // Antes de ligar a recorrencia, as colunas de acumulado nao existem.
    await expect(page.getByText(/Acum\. Bruto/i)).toHaveCount(0);

    await page.check('input[name="is_recurrent"]');
    await page.fill('input[name="recurrence_months"]', "12");

    // Fee V3 Compra mensal = R$ 20.000,00 (2% de R$1M); acumulado 12 meses = R$ 240.000,00.
    await expect(page.getByText(/Acum\. Bruto/i).first()).toBeVisible();
    await expect(page.getByText("R$ 20.000,00").first()).toBeVisible();
    await expect(page.getByText("R$ 240.000,00").first()).toBeVisible();

    // Grupo de Intermediarios Compra: mensal R$ 20.000,00 (2% de R$1M),
    // acumulado 12 meses = R$ 240.000,00 tambem (mesmo % que o V3 aqui,
    // valores batem por coincidencia dos numeros escolhidos no teste).
    await expect(page.getByText(/Ajuste as fatias/i)).toHaveCount(0);

    const [downloadBuy] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /PDF Buy-Side/i }).click(),
    ]);
    expect(downloadBuy.suggestedFilename()).toContain("BuySide");
  });

  test("saldo de Intermediarios negativo nao trava a tela, so desabilita o PDF daquele lado", async ({ page }) => {
    await abrirCalculadora(page);

    await page.fill('input[name="face_value"]', "50000000"); // R$ 500.000,00
    await page.fill('input[name="fee_total_pct"]', "5");

    // Lado Compra: Grupo Cheia 5%, Fee V3 4% + Mandatario 3% = 7% > 5% ->
    // Grupo Liquido 1%, Intermediarios = 1-3 = -2%, negativo.
    await page.fill('input[name="buy_side_pct"]', "5");
    await page.fill('input[name="buy_fee_v3_pct"]', "4");
    await page.fill('input[name="buy_mandatario_pct"]', "3");

    await expect(page.getByText(/precisa somar 100%/i)).toHaveCount(0);
    await expect(page.getByText(/erro ao calcular/i)).toHaveCount(0);

    await expect(page.getByText(/Ajuste as fatias/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /PDF Buy-Side/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /PDF Sell-Side/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /PDF Consolidado/i })).toBeDisabled();
  });

  test("% Desagio calcula Deságio (R$) e Preço do Comprador em tempo real, e % Titulares calcula o R$ junto", async ({ page }) => {
    await abrirCalculadora(page);

    // R$ 10.000.000,00 (mascara de moeda: digitos representam centavos).
    await page.fill('input[name="face_value"]', "1000000000");
    await page.fill('input[name="desconto_desagio_pct"]', "30");

    // Desagio (R$) = Valor de Face x 30% = R$ 3.000.000,00.
    // Preco do Comprador (R$) = Valor de Face - Desagio (R$) = R$ 7.000.000,00.
    await expect(page.getByText("30% · R$ 3.000.000,00")).toBeVisible();
    await expect(page.getByText("Preço do Comprador: R$ 7.000.000,00")).toBeVisible();

    // % Titulares segue a mesma logica (Valor Titulares = Valor de Face x %Titulares).
    await page.fill('input[name="titulares_pct"]', "10");
    await expect(page.getByText("10% · R$ 1.000.000,00")).toBeVisible();
  });

  test("PDF Buy-Side traz o bloco RESUMO FINANCEIRO DE AQUISIÇÃO com Preço Final de Aquisição real", async ({ page }) => {
    await abrirCalculadora(page);

    await page.fill('input[name="face_value"]', "1000000000"); // R$ 10.000.000,00
    await page.fill('input[name="desconto_desagio_pct"]', "30");
    await page.fill('input[name="fee_total_pct"]', "5");
    await page.fill('input[name="buy_side_pct"]', "2.5");
    await page.fill('input[name="buy_fee_v3_pct"]', "0.5");
    await page.fill('input[name="buy_mandatario_pct"]', "1");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /PDF Buy-Side/i }).click(),
    ]);
    expect(download.suggestedFilename()).toContain("BuySide");

    const pdfPath = await download.path();
    if (!pdfPath) throw new Error("Download do PDF Buy-Side nao gerou arquivo local (path nulo).");
    const buffer = await readFile(pdfPath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const { text } = await parser.getText();

    expect(text).toContain("RESUMO FINANCEIRO DE AQUISIÇÃO");
    expect(text).toContain("Valor de Face do Ativo");
    expect(text).toContain("Deságio da Operação");
    expect(text).toContain("Preço Final de Aquisição");
    expect(text).toContain("Comissão/Fee de Estruturação Buy-Side");
    // Confere o valor real, nao so o rotulo: R$ 10.000.000,00 com 30% de
    // desagio fecha em R$ 7.000.000,00 (mesmo caso do teste anterior).
    expect(text).toContain("R$ 7.000.000,00");
  });
});
