import { test as setup, expect } from "@playwright/test";

const authFile = "tests/e2e/.auth/user.json";

setup("autentica usuario QA e salva sessao", async ({ page }) => {
  const email = process.env.QA_EMAIL;
  const password = process.env.QA_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "QA_EMAIL/QA_PASSWORD ausentes. Rode o script de criacao do usuario de teste (ver Fase 3 do plano de governanca de documentos) antes de rodar a suite."
    );
  }

  await page.goto("/login");
  await page.getByPlaceholder(/e-mail/i).or(page.locator('input[type="email"]')).first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /acessar plataforma/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  await page.context().storageState({ path: authFile });
});
