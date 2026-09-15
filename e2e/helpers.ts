import { expect, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL ?? "demo.sarl.complete@comptatn.tn";
const password = process.env.E2E_PASSWORD ?? "DemoSarl2026!";

export async function signIn(page: Page) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Ma journée/ })).toBeVisible();
}

export async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(
    dimensions.content,
    `La page déborde horizontalement (${dimensions.content}px > ${dimensions.viewport}px).`,
  ).toBeLessThanOrEqual(dimensions.viewport + 1);
}
