import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Africa/Lagos" });

test("saved dossier fee drives the default estimate without creating an invoice", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-02T12:00:00Z") });
  const organization = {
    id: "fee-org",
    name: "Cabinet test",
    slug: "fees",
    role: "Propriétaire",
    permissions: ["profitability.view", "dossiers.view"],
  };
  const user = {
    id: "owner",
    email: "owner@example.invalid",
    fullName: "Test",
    isPlatformAdmin: false,
    mfaEnabled: false,
  };
  await page.addInitScript(
    ({ organization, user }) => {
      sessionStorage.setItem(
        "compta-tn.session",
        JSON.stringify({
          accessToken: "mock",
          refreshToken: "mock",
          accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
          user,
          organizations: [organization],
        }),
      );
      localStorage.setItem("compta-tn.organization", organization.id);
    },
    { organization, user },
  );
  let invoiceWrites = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    if (path.includes("/invoices") && route.request().method() !== "GET")
      invoiceWrites++;
    let body: unknown = [];
    if (path === "/api/auth/me")
      body = { ...user, organizations: [organization] };
    else if (path.endsWith("/dossiers"))
      body = { items: [], total: 0, page: 1, pageSize: 100 };
    else if (path.endsWith("/work-sessions/active")) body = null;
    else if (path.endsWith("/profitability"))
      body = {
        basis: {
          warning: "",
          estimate:
            "Honoraires HT du dossier ; estimation distincte des factures et encaissements.",
        },
        totals: {
          approvedHours: "1.00",
          allocatedEmployerCost: "10.000",
          estimatedRevenueNet: "500.000",
          estimatedMargin: "490.000",
          billedRevenueNet: "300.000",
          collectedRevenueNet: "200.000",
          marginOnBilled: "290.000",
          missingContractFeeCount: 1,
        },
        dossiers: [
          {
            dossierId: "client",
            dossierName: "Client test",
            approvedHours: "1.00",
            billableRate: "100.00",
            allocatedEmployerCost: "10.000",
            estimatedRevenueNet: "500.000",
            estimatedMargin: "490.000",
            estimatedMarginRate: "98.00",
            billedRevenueNet: "300.000",
            marginOnBilled: "290.000",
            marginRateOnBilled: "96.67",
            missingContractFee: false,
          },
          {
            dossierId: "missing",
            dossierName: "Client sans tarif",
            approvedHours: "0.00",
            estimatedRevenueNet: "0.000",
            estimatedMargin: "0.000",
            missingContractFee: true,
          },
        ],
        members: [
          {
            membershipId: "worker",
            fullName: "Colab",
            approvedHours: "1.00",
            billableRate: "100.00",
            payAmount: "10.000",
            employerCost: "10.000",
            allocatedEstimatedRevenue: "500.000",
            contributionMarginEstimated: "490.000",
            allocatedBilledRevenue: "300.000",
            contributionMarginBilled: "290.000",
          },
        ],
      };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/rentabilite");
  await expect(page.getByLabel("Du", { exact: true })).toHaveValue(
    "2026-10-01",
  );
  await expect(page.getByLabel("Au", { exact: true })).toHaveValue(
    "2026-10-31",
  );
  await expect(
    page.getByText("Marge estimée", { exact: true }).first(),
  ).toBeVisible();
  const client = page.getByRole("row").filter({ hasText: "Client test" });
  await expect(client).toContainText("500,000");
  await expect(client).toContainText("490,000");
  const worker = page.getByRole("row").filter({ hasText: "Colab" });
  await expect(worker).toContainText("490,000");
  await expect(
    page.getByText("Honoraires à renseigner", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Base de calcul", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Honoraires facturés", exact: true })
    .click();
  await expect(client).toContainText("300,000");
  await expect(client).toContainText("290,000");
  await expect(client).not.toContainText("500,000");
  await expect(worker).toContainText("290,000");
  await expect(page.getByText(/Honoraires encaissés HT/)).toContainText(
    "200,000",
  );
  expect(invoiceWrites).toBe(0);
});
