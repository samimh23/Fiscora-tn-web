import { expect, test, type Page } from "@playwright/test";

const extraction = {
  document_type: "invoice", invoice_nature: "BIENS",
  document_number: "A-TEST-001", issue_date: "2026-09-05",
  supplier: { name: "Fournisseur test" }, currency: "TND",
  subtotal_excl_tax: "100", tax_amount: "0", total_incl_tax: "100",
  line_items: [{ description: "Produit test", quantity: "1", unit_price: "100", unit_price_basis: "HT", tax_rate: "0" }],
};
const document = (status: string) => ({
  id: "source", dossierId: "alpha", originalName: "facture-test.png",
  category: "FACTURES_ACHATS", mimeType: "image/png", sizeBytes: "100",
  extractionStatus: status, extractedData: extraction, processingStatus: "A_TRAITER",
  createdAtUtc: "2026-09-05T10:00:00Z", periodYear: 2026, periodMonth: 9,
  malwareScanStatus: "SAIN", uploadedBy: { type: "CABINET", name: "Test" },
});
const dossier = (id: string) => ({
  id, legalName: `${id} SARL`, status: "ACTIF", legalForm: "SARL",
  taxRegime: "REEL", isVatSubject: true, tags: [],
});

async function mockWorkspace(page: Page, initialStatus?: string, canReview = true) {
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(45_000);
  const user = { id: "test", email: "test@example.invalid", fullName: "Test", mfaEnabled: false };
  const organizations = [{ id: "org", name: "Cabinet test", slug: "test", role: "Administrateur", permissions: [
    "dossiers.view", "documents.view", "documents.upload",
    "business_invoices.view", "business_invoices.manage", "third_parties.view",
    "accounting.view", "chart_of_accounts.view", "fiscal_settings.view",
    ...(canReview ? ["documents.validate"] : []),
  ] }];
  await page.addInitScript(({ user, organizations }) => {
    sessionStorage.setItem("compta-tn.session", JSON.stringify({ accessToken: "mock", refreshToken: "mock",
      accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z", user, organizations }));
    localStorage.setItem("compta-tn.organization", "org");
  }, { user, organizations });
  let status = initialStatus;
  let invoice: Record<string, unknown> | undefined;
  let uploadCount = 0;
  let extractionRequests = 0;
  let extractionGate: Promise<void> | undefined;
  let preparingStarted = false;
  let extractedData = structuredClone(extraction);
  let reviewPayload: Record<string, unknown> | undefined;
  let reviewCount = 0;
  const job = () => ({ id: "job", documentId: "source", status,
    normalizedData: extractedData,
    sourceData: { ...extractedData, _evidence: {
      document_number: { status: "MATCHED", page: 1, text: "A-TEST-001", bbox: [100, 100, 300, 200] },
    } }, validationIssues: [] });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!path.startsWith("/api/")) { await route.continue(); return; }
    let body: unknown = [];
    if (path === "/api/auth/me") body = { ...user, organizations };
    else if (path.endsWith("/dossiers")) body = { items: [dossier("alpha"), dossier("beta")], total: 2, page: 1, pageSize: 100 };
    else if (/\/dossiers\/(alpha|beta)$/.test(path)) body = dossier(path.split("/").at(-1)!);
    else if (path.endsWith("/ledger-accounts")) body = ["607", "4011"].map((code) => ({
      id: code, code, name: code, isActive: true, allowsPosting: true,
      type: code === "4011" ? "Liability" : "Expense", normalBalance: "Debit",
    }));
    else if (path.endsWith("/journals")) body = [{ id: "ac", code: "AC", name: "Achats", type: "ACHATS", isActive: true }];
    else if (path.endsWith("/third-parties")) body = [{ id: "supplier", name: "Fournisseur test", type: "FOURNISSEUR", payableAccountId: "4011" }];
    else if (path.endsWith("/documents") && request.method() === "POST") {
      uploadCount += 1; status = "EN_ATTENTE"; body = document(status);
    } else if (path.endsWith("/documents")) body = status && !path.includes("/beta/") && (!url.searchParams.get("category") || url.searchParams.get("category") === "FACTURES_ACHATS") ? [document(status)] : [];
    else if (path.endsWith("/extraction/review-queue")) body = status === "A_REVOIR" ? [{ ...job(), document: document(status) }] : [];
    else if (path.endsWith("/preview")) body = { kind: "image", originalName: "facture-test.png",
      url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1kAAAAASUVORK5CYII=" };
    else if (path.endsWith("/extraction") && request.method() === "POST") {
      extractionRequests += 1; status = "EN_COURS"; body = { status };
    } else if (path.endsWith("/extraction")) {
      preparingStarted = true;
      if (extractionGate) await extractionGate;
      body = job();
    } else if (path.endsWith("/business-invoices") && request.method() === "POST") {
      invoice = { ...request.postDataJSON(), id: "invoice", status: "BROUILLON", settlementStatus: "NON_REGLEE", netPayable: "100" };
      body = invoice;
    } else if (path.endsWith("/business-invoices")) body = invoice && !path.includes("/beta/") ? [invoice] : [];
    else if (path.endsWith("/extraction/review")) {
      reviewCount += 1;
      reviewPayload = request.postDataJSON();
      status = reviewPayload?.decision === "REJETER" ? "REJETEE" : "VALIDEE";
      if (reviewPayload?.correctedData) extractedData = reviewPayload.correctedData as typeof extraction;
      body = job();
    }
    else if (path.endsWith("/work-sessions/active")) body = null;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return {
    setStatus: (value: string) => { status = value; },
    counts: () => ({ uploadCount, extractionRequests }),
    invoice: () => invoice,
    delayPrepare: (gate: Promise<void>) => { extractionGate = gate; },
    preparingStarted: () => preparingStarted,
    review: () => reviewPayload,
    reviewCount: () => reviewCount,
  };
}

test("scan continues in invoice imports after closing and refreshing, then creates one draft", async ({ page }) => {
  const mock = await mockWorkspace(page);
  await page.goto("/factures?dossierId=alpha");
  await page.getByRole("button", { name: "Scanner par IA", exact: true }).click();
  const scanner = page.getByRole("dialog");
  await scanner.locator('input[type="file"]').setInputFiles({
    name: "facture-test.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1kAAAAASUVORK5CYII=", "base64"),
  });
  await scanner.getByRole("button", { name: "Lire avec l’IA", exact: true }).click();
  await scanner.getByRole("button", { name: "Continuer en arrière-plan" }).click();
  const imports = page.getByRole("region", { name: "Imports IA", exact: true });
  await expect(imports.getByText("Extraction en cours", { exact: true })).toBeVisible();
  expect(mock.invoice()).toBeUndefined();
  await page.reload();
  await expect(imports.getByText("facture-test.png", { exact: true })).toBeVisible();
  mock.setStatus("A_REVOIR");
  await expect(imports.getByRole("button", { name: "Vérifier les données", exact: true })).toBeVisible();
  await expect(imports.getByRole("button", { name: "Préparer la facture", exact: true })).toHaveCount(0);
  await imports.getByRole("button", { name: "Vérifier les données", exact: true }).click();
  const review = page.getByRole("dialog");
  await expect(review.getByRole("img", { name: "facture-test.png" })).toBeVisible();
  await review.getByLabel("Numéro", { exact: true }).focus();
  await expect(review.getByLabel("Zone extraite A-TEST-001", { exact: true })).toBeVisible();
  await review.getByLabel("Numéro", { exact: true }).fill("A-CORRECTED-001");
  expect(mock.invoice()).toBeUndefined();
  await review.getByRole("button", { name: "Confirmer ces données" }).click();
  await expect(review).toBeHidden();
  expect(mock.review()?.decision).toBe("APPROUVER");
  await expect(imports.getByText("Prête à préparer", { exact: true })).toBeVisible();
  await expect(imports.getByRole("button", { name: "Préparer la facture", exact: true })).toBeVisible();
  await imports.getByRole("button", { name: "Préparer la facture", exact: true }).click();
  const draft = page.getByRole("dialog");
  await expect(draft.getByLabel("Numéro", { exact: false })).toHaveValue("A-CORRECTED-001");
  expect(mock.invoice()).toBeUndefined();
  await draft.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(draft).toBeHidden();
  await expect(imports).toHaveCount(0);
  await expect(page.getByText("Facture A-CORRECTED-001", { exact: true })).toBeVisible();
  expect(mock.counts()).toEqual({ uploadCount: 1, extractionRequests: 1 });
  expect(mock.invoice()?.sourceDocumentId).toBe("source");
  expect(mock.reviewCount()).toBe(1);
});

test("already extracted documents can be prepared from invoices without reuploading", async ({ page }) => {
  const mock = await mockWorkspace(page, "VALIDEE");
  await page.goto("/factures?dossierId=alpha");
  const imports = page.getByRole("region", { name: "Imports IA", exact: true });
  await expect(imports.getByText("Prête à préparer", { exact: true })).toBeVisible();
  await imports.getByRole("button", { name: "Préparer la facture", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(mock.counts()).toEqual({ uploadCount: 0, extractionRequests: 0 });
  expect(mock.invoice()).toBeUndefined();
});

test("failed extraction is visible and retryable", async ({ page }) => {
  const mock = await mockWorkspace(page, "ECHEC");
  await page.goto("/factures?dossierId=alpha");
  const imports = page.getByRole("region", { name: "Imports IA", exact: true });
  await expect(imports.getByText("Extraction échouée", { exact: true })).toBeVisible();
  await imports.getByRole("button", { name: "Relancer l’extraction" }).click();
  await expect(imports.getByText("Extraction en cours", { exact: true })).toBeVisible();
  expect(mock.counts()).toEqual({ uploadCount: 0, extractionRequests: 1 });
});

test("document viewers cannot prepare or retry without extraction permission", async ({ page }) => {
  await mockWorkspace(page, "A_REVOIR", false);
  await page.goto("/factures?dossierId=alpha");
  const imports = page.getByRole("region", { name: "Imports IA", exact: true });
  await expect(imports.getByText("Prête à vérifier", { exact: true })).toBeVisible();
  await expect(imports.getByRole("button", { name: "Préparer la facture" })).toHaveCount(0);
  await expect(imports.getByRole("button", { name: "Vérifier les données" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Scanner par IA" })).toHaveCount(0);
});

test("a late preparation response does not open a draft in another dossier", async ({ page }) => {
  const mock = await mockWorkspace(page, "VALIDEE");
  let release!: () => void;
  mock.delayPrepare(new Promise<void>((resolve) => { release = resolve; }));
  await page.goto("/factures?dossierId=alpha");
  await page.getByRole("region", { name: "Imports IA", exact: true }).getByRole("button", { name: "Préparer la facture" }).click();
  await expect.poll(mock.preparingStarted).toBe(true);
  await page.getByRole("combobox", { name: "Dossier client", exact: true }).click();
  await page.getByRole("option", { name: "beta SARL", exact: true }).click();
  await expect(page).toHaveURL(/dossierId=beta/);
  const completed = page.waitForResponse((response) => response.url().includes("/documents/source/extraction"));
  release();
  await completed;
  await expect(page.getByRole("region", { name: "Imports IA", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Documents keeps the same source review and confirmation workflow", async ({ page }) => {
  const mock = await mockWorkspace(page, "A_REVOIR");
  await page.goto("/documents?dossierId=alpha");
  await page.getByRole("button", { name: "Vérifier les données", exact: true }).first().click();
  const review = page.getByRole("dialog");
  await expect(review.getByRole("img", { name: "facture-test.png" })).toBeVisible();
  await review.getByLabel("Numéro", { exact: true }).fill("A-DOCUMENTS-001");
  await review.getByRole("button", { name: "Confirmer ces données" }).click();
  await expect(review).toBeHidden();
  expect(mock.review()?.correctedData).toMatchObject({ document_number: "A-DOCUMENTS-001" });
  expect(mock.invoice()).toBeUndefined();
});

test("review can be closed, reopened, rejected with a comment or reread", async ({ page }) => {
  const mock = await mockWorkspace(page, "A_REVOIR");
  await page.goto("/factures?dossierId=alpha");
  const imports = page.getByRole("region", { name: "Imports IA", exact: true });
  const open = () => imports.getByRole("button", { name: "Vérifier les données" }).click();
  await open();
  const review = page.getByRole("dialog");
  await review.getByLabel("Numéro", { exact: true }).fill("NOT-SAVED");
  await review.getByRole("button", { name: "Fermer", exact: true }).click();
  expect(mock.review()).toBeUndefined();
  await open();
  await expect(review.getByLabel("Numéro", { exact: true })).toHaveValue("A-TEST-001");
  await expect(review.getByRole("button", { name: "Rejeter", exact: true })).toBeDisabled();
  await review.getByLabel("Note de contrôle").fill("Document illisible");
  await review.getByRole("button", { name: "Rejeter", exact: true }).click();
  await expect(review).toBeHidden();
  expect(mock.review()).toMatchObject({ decision: "REJETER", comment: "Document illisible" });
  mock.setStatus("A_REVOIR");
  await page.reload();
  await open();
  await review.getByRole("button", { name: "Relire avec l’IA" }).click();
  await expect(review).toBeHidden();
  await expect(imports.getByText("Extraction en cours", { exact: true })).toBeVisible();
  expect(mock.counts().extractionRequests).toBe(1);
  expect(mock.invoice()).toBeUndefined();
});

test("failed confirmation keeps corrections visible and does not create an invoice", async ({ page }) => {
  const mock = await mockWorkspace(page, "A_REVOIR");
  await page.route("**/documents/source/extraction/review", (route) => route.fulfill({
    status: 400, contentType: "application/json", body: JSON.stringify({ message: "La validation a échoué." }),
  }));
  await page.goto("/factures?dossierId=alpha");
  await page.getByRole("button", { name: "Vérifier les données", exact: true }).click();
  const review = page.getByRole("dialog");
  await review.getByLabel("Numéro", { exact: true }).fill("KEEP-CORRECTION");
  await review.getByRole("button", { name: "Confirmer ces données" }).click();
  await expect(review.getByText("La validation a échoué.", { exact: true })).toBeVisible();
  await expect(review.getByLabel("Numéro", { exact: true })).toHaveValue("KEEP-CORRECTION");
  expect(mock.invoice()).toBeUndefined();
});

test("a late review response does not open data in another dossier", async ({ page }) => {
  const mock = await mockWorkspace(page, "A_REVOIR");
  let release!: () => void;
  mock.delayPrepare(new Promise<void>((resolve) => { release = resolve; }));
  await page.goto("/factures?dossierId=alpha");
  await page.getByRole("button", { name: "Vérifier les données", exact: true }).click();
  await expect.poll(mock.preparingStarted).toBe(true);
  await page.getByRole("combobox", { name: "Dossier client", exact: true }).click();
  await page.getByRole("option", { name: "beta SARL", exact: true }).click();
  await expect(page).toHaveURL(/dossierId=beta/);
  const completed = page.waitForResponse((response) => response.url().includes("/documents/source/extraction"));
  release();
  await completed;
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the scanner opens source verification instead of bypassing it", async ({ page }) => {
  const mock = await mockWorkspace(page);
  await page.goto("/factures?dossierId=alpha");
  await page.getByRole("button", { name: "Scanner par IA", exact: true }).click();
  const scanner = page.getByRole("dialog");
  await scanner.locator('input[type="file"]').setInputFiles({
    name: "facture-test.png", mimeType: "image/png", buffer: Buffer.from("test"),
  });
  await scanner.getByRole("button", { name: "Lire avec l’IA", exact: true }).click();
  await expect(scanner.getByText(/L’IA lit la facture/)).toBeVisible();
  expect(mock.counts().extractionRequests).toBe(1);
  mock.setStatus("A_REVOIR");
  await expect(scanner.getByRole("button", { name: "Vérifier les données", exact: true })).toBeEnabled();
  await scanner.getByRole("button", { name: "Vérifier les données", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vérifier les données lues par l’IA", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("img", { name: "facture-test.png" })).toBeVisible();
  expect(mock.invoice()).toBeUndefined();
});

test("shared bank statement review preserves matching account and edited transactions", async ({ page }) => {
  await mockWorkspace(page, "A_REVOIR");
  const statement = { document_type: "bank_statement", currency: "TND", bank_statement: {
    bank_name: "Banque test", iban: "TN12345", period_start: "2026-09-01", period_end: "2026-09-30",
    opening_balance: "100", closing_balance: "90",
    transactions: [{ transaction_date: "2026-09-05", description: "Frais", debit: "10", credit: null }],
  } };
  await page.route("**/documents/extraction/review-queue", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify([{
      id: "bank-job", documentId: "source", status: "A_REVOIR", validationIssues: [],
      normalizedData: statement, sourceData: statement,
      document: { ...document("A_REVOIR"), category: "RELEVES_BANCAIRES" },
    }]),
  }));
  await page.route("**/bank-reconciliation/accounts", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify([
      { id: "other", name: "Autre compte", iban: "TN99999", currency: "TND" },
      { id: "matching", name: "Compte correspondant", iban: "TN12345", currency: "TND" },
    ]),
  }));
  let payload: Record<string, unknown> | undefined;
  await page.route("**/documents/source/extraction/review", (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("/documents?dossierId=alpha");
  await page.getByRole("button", { name: "Vérifier les données", exact: true }).first().click();
  const review = page.getByRole("dialog");
  await expect(review.getByRole("combobox", { name: "Compte bancaire de destination" })).toHaveValue("Compte correspondant · TN12345");
  const transaction = review.locator("tbody tr").first();
  await transaction.getByRole("textbox").nth(2).fill("Frais corrigés");
  await review.getByRole("button", { name: "Confirmer ces données" }).click();
  await expect(review).toBeHidden();
  expect(payload).toMatchObject({ decision: "APPROUVER", bankAccountId: "matching",
    correctedData: { bank_statement: { transactions: [{ description: "Frais corrigés" }] } },
  });
});
