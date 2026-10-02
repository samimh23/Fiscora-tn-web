import { expect, test, type Page } from "@playwright/test";

async function openCostForm(page: Page) {
  page.setDefaultTimeout(15_000);
  const organization = {
    id: "cost-org", name: "Cabinet test", slug: "costs", role: "Propriétaire",
    permissions: ["profitability.view", "team_costs.manage", "users.view"],
  };
  const user = {
    id: "cost-user", email: "costs@example.invalid", fullName: "Test",
    isPlatformAdmin: false, mfaEnabled: false,
  };
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
    let body: unknown = [];
    if (path === "/api/auth/me") body = { ...user, organizations: [organization] };
    else if (path.endsWith("/dossiers")) body = { items: [], total: 0, page: 1, pageSize: 100 };
    else if (path.endsWith("/profitability")) body = { basis: { warning: "" }, totals: {}, dossiers: [], members: [] };
    else if (path.endsWith("/members")) body = [
      { membershipId: "worker", fullName: "Colab", role: "Collaborateur", isActive: true },
      { membershipId: "portal", fullName: "Moula el moul", role: "Portail client", isActive: true },
      { membershipId: "owner", fullName: "Owner", role: "Propriétaire", isActive: true },
      { membershipId: "inactive", fullName: "Inactive", role: "Collaborateur", isActive: false },
    ];
    else if (path.endsWith("/team-cost-rates") && route.request().method() === "POST") {
      saved = route.request().postDataJSON();
      body = { id: "rate", ...saved };
    } else if (path.endsWith("/work-sessions/active")) body = null;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/rentabilite");
  await page.getByRole("button", { name: "Coût collaborateur", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Collaborateur", exact: true }).click();
  await expect(page.getByRole("option", { name: "Moula el moul", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Inactive", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Owner", exact: true })).toBeVisible();
  await page.getByRole("option", { name: "Colab", exact: true }).click();
  return { dialog, saved: () => saved };
}

test("hourly worker uses one rate for pay and cost without monthly targets", async ({ page }) => {
  const { dialog, saved } = await openCostForm(page);
  // A previous monthly value must never leak into the hourly cost payload.
  await dialog.getByLabel("Coût employeur mensuel", { exact: true }).fill("1500");
  await dialog.getByRole("combobox", { name: "Rémunération", exact: true }).click();
  await page.getByRole("option", { name: "Horaire", exact: true }).click();
  await expect(dialog.getByLabel("Coût horaire employeur", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("Coût employeur mensuel", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("Objectif mensuel (minutes)", { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Enregistrer", exact: true })).toBeDisabled();
  await dialog.getByLabel("Taux horaire", { exact: true }).fill("10.125");
  await expect(dialog.getByText("Coût calculé = taux horaire × heures approuvées.")).toBeVisible();
  await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect.poll(saved).toMatchObject({
    membershipId: "worker", compensationType: "HORAIRE",
    payRateAmount: "10.125", employerCostRateAmount: "10.125",
  });
});

test("monthly compensation keeps its existing distinct employer cost", async ({ page }) => {
  const { dialog, saved } = await openCostForm(page);
  await dialog.getByLabel("Salaire mensuel", { exact: true }).fill("1000");
  await expect(dialog.getByRole("button", { name: "Enregistrer", exact: true })).toBeDisabled();
  await dialog.getByLabel("Coût employeur mensuel", { exact: true }).fill("1200");
  await expect(dialog.getByLabel("Objectif mensuel (minutes)", { exact: true })).toHaveValue("9600");
  await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect.poll(saved).toMatchObject({
    compensationType: "MENSUELLE", payRateAmount: "1000", employerCostRateAmount: "1200",
  });
});
