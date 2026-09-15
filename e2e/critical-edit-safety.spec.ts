import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("sécurité des parcours de modification", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Parcours fonctionnel exécuté une seule fois.",
    );
    await signIn(page);
    await page.goto("/dossiers");
    await expect(
      page.getByRole("heading", { name: "Dossiers clients" }),
    ).toBeVisible();
  });

  test("avertit avant de fermer un formulaire modifié et conserve la saisie", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Nouveau dossier" }).click();
    const legalName = page.getByLabel("Raison sociale");
    await legalName.fill("Dossier temporaire Playwright");

    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(
      page.getByRole("heading", { name: "Modifications non enregistrées" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Continuer la saisie" }).click();
    await expect(legalName).toHaveValue("Dossier temporaire Playwright");

    await page.getByRole("button", { name: "Annuler" }).click();
    await page
      .getByRole("button", { name: "Quitter sans enregistrer" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Créer un dossier client" }),
    ).toBeHidden();
  });

  test("confirme visiblement une création réussie", async ({ page }) => {
    await page.route("**/api/organizations/*/dossiers", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "11111111-1111-4111-8111-111111111111",
          legalName: "Dossier succès Playwright",
          tradeName: null,
          taxIdentifier: null,
          rneNumber: null,
          vatCode: null,
          customsCode: null,
          legalForm: "SARL",
          taxRegime: "REEL",
          status: "ACTIF",
          isVatSubject: true,
          hasVatSuspension: false,
          isTotallyExporting: false,
          activitySector: null,
          cnssEmployerNumber: null,
          employeeCount: 0,
          fiscalYearStartMonth: 1,
          fiscalYearStartDay: 1,
          monthlyFee: null,
          annualFee: null,
          billingFrequency: "MENSUELLE",
          internalNotes: null,
          tags: [],
        }),
      });
    });

    await page.getByRole("button", { name: "Nouveau dossier" }).click();
    await page.getByLabel("Raison sociale").fill("Dossier succès Playwright");
    await page.getByRole("button", { name: "Créer le dossier" }).click();

    await expect(
      page.getByText("Le dossier client a été créé.", { exact: true }),
    ).toBeVisible();
  });
});
