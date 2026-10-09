import { test, expect, type Page } from "@playwright/test";

async function fixture(page: Page, role = "Propriétaire", fail = false) {
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) =>
    console.error("Browser error:", error.message),
  );
  const organization = {
    id: "org-a",
    name: "Test Cabinet",
    slug: "a",
    role,
    permissions: [
      "dossiers.view",
      "dossiers.create",
      "dossiers.delete",
      "documents.view",
    ],
  };
  const user = {
    id: "owner",
    email: "owner@example.invalid",
    fullName: "Owner",
    isPlatformAdmin: false,
    mfaEnabled: false,
  };
  let items = ["Alpha SARL", "Beta SARL"].map((legalName, index) => ({
    id: `dossier-${index}`,
    legalName,
    legalForm: "SARL",
    taxRegime: "REEL",
    status: "ACTIF",
    tags: [],
  }));
  const deletions: unknown[] = [];
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
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith("/api/")) {
      await route.continue();
      return;
    }
    let body: unknown = [];
    if (request.method() === "DELETE") {
      deletions.push(request.postDataJSON());
      if (fail) {
        await route.fulfill({
          status: 409,
          json: { message: "Suppression annulée." },
        });
        return;
      }
      items = items.filter((item) => !path.endsWith(item.id));
      body = { deleted: true };
    } else if (path === "/api/auth/me")
      body = { ...user, organizations: [organization] };
    else if (path.endsWith("/dossiers"))
      body = { items, total: items.length, page: 1, pageSize: 100 };
    else if (path.endsWith("/work-sessions/active")) body = null;
    await route.fulfill({ status: 200, json: body });
  });
  await page.goto("/dossiers");
  return deletions;
}
test("owner must type exact name and acknowledge, then the deleted dossier disappears", async ({
  page,
}) => {
  const deletions = await fixture(page);
  await page
    .getByRole("button", { name: "Supprimer Alpha SARL", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", {
    name: "Supprimer définitivement",
    exact: true,
  });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("textbox").fill("Wrong");
  await dialog.getByRole("checkbox").check();
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("textbox").fill("Alpha SARL");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Supprimer Alpha SARL", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Supprimer Beta SARL", exact: true }),
  ).toBeVisible();
  expect(deletions).toEqual([
    { confirmationName: "Alpha SARL", acknowledgePermanentDeletion: true },
  ]);
  if (test.info().project.name === "desktop")
    await expect(
      page.getByRole("combobox", { name: "Dossier client" }),
    ).toHaveValue("Beta SARL");
});
test("cancel does not delete anything", async ({ page }) => {
  const deletions = await fixture(page);
  await page
    .getByRole("button", { name: "Supprimer Alpha SARL", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Annuler", exact: true })
    .click();
  expect(deletions).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Supprimer Alpha SARL", exact: true }),
  ).toBeVisible();
});
test("collaborators do not see delete even if a stale permission exists", async ({
  page,
}) => {
  await fixture(page, "Collaborateur");
  await expect(
    page.getByRole("button", { name: "Supprimer Alpha SARL", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Alpha SARL", { exact: true })).toBeVisible();
});
test("a rejected deletion retains the dossier and displays the server error", async ({
  page,
}) => {
  await fixture(page, "Propriétaire", true);
  await page
    .getByRole("button", { name: "Supprimer Alpha SARL", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Alpha SARL");
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Supprimer définitivement", exact: true })
    .click();
  await expect(dialog.getByText("Suppression annulée.")).toBeVisible();
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Supprimer Alpha SARL", exact: true }),
  ).toBeVisible();
});
