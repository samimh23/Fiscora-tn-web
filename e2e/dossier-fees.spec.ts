import { expect, test, type Page } from "@playwright/test";

const organization = {
  id: "fee-org", name: "Cabinet test", slug: "fees", role: "Administrateur",
  permissions: ["dossiers.view", "dossiers.create", "dossiers.manage"],
};
const user = {
  id: "fee-user", email: "fees@example.invalid", fullName: "Test",
  isPlatformAdmin: false, mfaEnabled: false,
};
const existing = {
  id: "fee-dossier", legalName: "Test honoraires SARL", tradeName: null,
  taxIdentifier: null, legalForm: "SARL", taxRegime: "REEL", status: "ACTIF",
  isVatSubject: true, tags: [], employeeCount: 0,
  monthlyFee: "300.000", annualFee: "3600.000", billingFrequency: "MENSUELLE",
};

async function mockWorkspace(page: Page, frequency = "MENSUELLE") {
  page.setDefaultTimeout(15_000);
  let saved: Record<string, unknown> | undefined;
  await page.addInitScript(({ organization, user }) => {
    sessionStorage.setItem("compta-tn.session", JSON.stringify({
      accessToken: "mock", refreshToken: "mock",
      accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
      user, organizations: [organization],
    }));
    localStorage.setItem("compta-tn.organization", organization.id);
  }, { organization, user });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) {
      await route.continue();
      return;
    }
    const dossier = { ...existing, billingFrequency: frequency };
    let body: unknown = [];
    if (path === "/api/auth/me") body = { ...user, organizations: [organization] };
    else if (["POST", "PATCH"].includes(route.request().method()) && /\/dossiers(?:\/fee-dossier)?$/.test(path)) {
      saved = route.request().postDataJSON();
      body = { ...dossier, ...saved };
    } else if (path.endsWith("/dossiers")) body = { items: [dossier], total: 1, page: 1, pageSize: 10 };
    else if (path.endsWith("/dossiers/fee-dossier")) body = dossier;
    else if (path.endsWith("/setup-status")) body = { isReadyForInvoicing: true, completedCount: 0, totalCount: 0, steps: [] };
    else if (path.endsWith("/work-sessions/active")) body = null;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return () => saved;
}

async function selectPeriod(page: Page, period: "Mensuel" | "Annuel") {
  await page.getByRole("combobox", { name: "Période des honoraires" }).click();
  await page.getByRole("option", { name: period, exact: true }).click();
}

test("new dossier has one fee field and only monthly/annual choices", async ({ page }) => {
  const saved = await mockWorkspace(page);
  await page.goto("/dossiers?nouveau=1");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Raison sociale").fill("Nouveau test SARL");
  await expect(dialog.getByLabel("Honoraires HT (TND)", { exact: true })).toHaveCount(1);
  await page.getByRole("combobox", { name: "Période des honoraires" }).click();
  await expect(page.getByRole("option")).toHaveText(["Mensuel", "Annuel"]);
  await page.getByRole("option", { name: "Annuel", exact: true }).click();
  await dialog.getByLabel("Honoraires HT (TND)", { exact: true }).fill("3600.125");
  await dialog.getByRole("button", { name: "Créer le dossier", exact: true }).click();
  await expect.poll(saved).toMatchObject({ billingFrequency: "ANNUELLE", annualFee: "3600.125", monthlyFee: null });
});

test("existing fees survive switching periods and editing the selected amount", async ({ page }) => {
  const saved = await mockWorkspace(page);
  await page.goto("/dossiers/fee-dossier");
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const amount = dialog.getByLabel("Honoraires HT (TND)", { exact: true });
  await expect(amount).toHaveValue("300.000");
  await selectPeriod(page, "Annuel");
  await expect(amount).toHaveValue("3600.000");
  await selectPeriod(page, "Mensuel");
  await expect(amount).toHaveValue("300.000");
  await amount.fill("350.000");
  await dialog.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect.poll(saved).toMatchObject({ billingFrequency: "MENSUELLE", monthlyFee: "350.000", annualFee: "3600.000" });
});

test("fees remain optional and invalid amounts are rejected", async ({ page }) => {
  const saved = await mockWorkspace(page);
  await page.goto("/dossiers?nouveau=1");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Raison sociale").fill("Sans honoraires SARL");
  const amount = dialog.getByLabel("Honoraires HT (TND)", { exact: true });
  await amount.fill("-10");
  await dialog.getByRole("button", { name: "Créer le dossier", exact: true }).click();
  await expect(dialog.getByText("Montant invalide (3 décimales maximum).", { exact: true })).toBeVisible();
  expect(saved()).toBeUndefined();
  await amount.fill("");
  await dialog.getByRole("button", { name: "Créer le dossier", exact: true }).click();
  await expect.poll(saved).toMatchObject({ monthlyFee: null, annualFee: null, billingFrequency: "MENSUELLE" });
});

test("legacy frequency requires an explicit choice without deleting saved fees", async ({ page }) => {
  const saved = await mockWorkspace(page, "TRIMESTRIELLE");
  await page.goto("/dossiers/fee-dossier");
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(dialog.getByText("Choisissez des honoraires mensuels ou annuels.", { exact: true })).toBeVisible();
  expect(saved()).toBeUndefined();
  await selectPeriod(page, "Annuel");
  await dialog.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect.poll(saved).toMatchObject({ monthlyFee: "300.000", annualFee: "3600.000", billingFrequency: "ANNUELLE" });
});
