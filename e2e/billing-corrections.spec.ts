import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const dossierId = "22222222-2222-4222-8222-222222222222";
const invoiceId = "33333333-3333-4333-8333-333333333333";
const paymentId = "44444444-4444-4444-8444-444444444444";

function invoice(status: string) {
  return {
    id: invoiceId,
    number: "HON-E2E-001",
    issueDate: "2026-09-01",
    dueDate: "2026-09-30",
    description: "Honoraires de test",
    netAmount: "100.000",
    vatRate: "0.190",
    vatAmount: "19.000",
    stampDuty: "1.000",
    totalAmount: "120.000",
    paidAmount: status === "PAYEE" ? "120.000" : "0.000",
    status,
    notes: null,
  };
}

async function mockBilling(page: Page, status: string) {
  await page.route("**/api/organizations/*/billing/summary", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ billed: "120.000", paid: "0.000", outstanding: "120.000" }),
    }),
  );
  await page.route("**/api/organizations/*/dossiers?page=1&pageSize=100", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: dossierId,
            legalName: "Dossier E2E",
            tradeName: null,
            taxIdentifier: null,
            legalForm: "SARL",
            taxRegime: "REEL",
            status: "ACTIF",
            isVatSubject: true,
            employeeCount: 0,
            monthlyFee: null,
            tags: [],
          },
        ],
        total: 1,
        page: 1,
        pageSize: 100,
      }),
    }),
  );
  await page.route(
    `**/api/organizations/*/dossiers/${dossierId}/invoices`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([invoice(status)]),
      }),
  );
  await page.route(
    `**/api/organizations/*/dossiers/${dossierId}/invoices/${invoiceId}/payments`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: paymentId,
            paymentDate: "2026-09-10",
            amount: "120.000",
            reference: "VIR-E2E",
            correctionType: null,
            correctionDate: null,
            correctionReason: null,
          },
        ]),
      }),
  );
}

test.describe("facturation et corrections tracées", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Parcours comptable exécuté une seule fois.",
    );
    await signIn(page);
  });

  test("émet un brouillon avec un retour de succès", async ({ page }) => {
    await mockBilling(page, "BROUILLON");
    await page.route(`**/invoices/${invoiceId}/send`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );

    await page.goto(`/honoraires?dossierId=${dossierId}`);
    await expect(page.getByText("HON-E2E-001")).toBeVisible();
    await page.getByRole("button", { name: "Émettre" }).click();
    await expect(page.getByText("La facture a été émise.", { exact: true })).toBeVisible();
  });

  test("annule sans supprimer la facture de l’historique", async ({ page }) => {
    await mockBilling(page, "ENVOYEE");
    await page.route(`**/invoices/${invoiceId}/cancel`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );

    await page.goto(`/honoraires?dossierId=${dossierId}`);
    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(page.getByRole("heading", { name: "Annuler la facture ?" })).toBeVisible();
    await expect(page.getByText(/restera dans l’historique/)).toBeVisible();
    await page.getByRole("button", { name: "Confirmer l’annulation" }).click();
    await expect(
      page.getByText("La facture a été annulée sans supprimer son historique.", {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("exige un motif avant de corriger un règlement", async ({ page }) => {
    await mockBilling(page, "PAYEE");
    await page.route(`**/payments/${paymentId}/correct`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );

    await page.goto(`/honoraires?dossierId=${dossierId}`);
    await page.getByRole("button", { name: "Règlements" }).click();
    await page.getByRole("button", { name: "Corriger" }).click();

    const confirm = page.getByRole("button", { name: "Confirmer la correction" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Motif obligatoire").fill("Erreur de saisie contrôlée");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(
      page.getByText("La correction du règlement a été enregistrée.", {
        exact: true,
      }),
    ).toBeVisible();
  });
});
