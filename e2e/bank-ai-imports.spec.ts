import { expect, test, type Page } from "@playwright/test";

test.use({ timezoneId: "Africa/Lagos", locale: "en-US" });
const image = {
  name: "releve-test.png",
  mimeType: "image/png",
  buffer: Buffer.from("test"),
};
const data = {
  document_type: "bank_statement",
  currency: "TND",
  bank_statement: {
    bank_name: "Banque test",
    iban: "TN22222",
    period_start: "2026-09-01",
    period_end: "2026-09-30",
    opening_balance: "5000",
    closing_balance: "5224.8",
    transactions: [
      {
        transaction_date: "2026-09-15",
        description: "ATLAS",
        reference: "ENC-SEP-001",
        debit: null,
        credit: "1000",
      },
      {
        transaction_date: "2026-09-18",
        description: "CARTHAGE",
        reference: "DEC-SEP-001",
        debit: "700",
        credit: null,
      },
      {
        transaction_date: "2026-09-24",
        description: "SAHEL",
        debit: "65.2",
        credit: null,
      },
      {
        transaction_date: "2026-09-30",
        description: "Frais",
        debit: "10",
        credit: null,
      },
    ],
  },
};

async function mockWorkspace(
  page: Page,
  options: {
    status?: string;
    manage?: boolean;
    failStart?: boolean;
    iban?: string | null;
  } = {},
) {
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(45_000);
  const user = {
    id: "test",
    email: "test@example.invalid",
    fullName: "Test",
    mfaEnabled: false,
  };
  const organizations = [
    {
      id: "org",
      name: "Cabinet test",
      slug: "test",
      role: "Comptable",
      permissions: [
        "dossiers.view",
        "bank_reconciliation.view",
        "documents.view",
        "chart_of_accounts.view",
        "accounting.view",
        ...(options.manage === false
          ? []
          : [
              "bank_reconciliation.manage",
              "documents.upload",
              "documents.validate",
            ]),
      ],
    },
  ];
  const dossier = (id: string) => ({
    id,
    legalName: `${id} SARL`,
    status: "ACTIF",
    legalForm: "SARL",
    taxRegime: "REEL",
    isVatSubject: true,
    tags: [],
  });
  const accounts = ["a", "b"].map((id) => ({
    id,
    name: `Compte ${id.toUpperCase()}`,
    iban: id === "a" ? "TN11111" : "TN22222",
    currency: "TND",
    bank: { name: "Banque test" },
    ledgerAccount: { code: "5321" },
    journal: { code: "BQ" },
  }));
  let status = options.status;
  let uploadCount = 0;
  let extractionCount = 0;
  let reviewPayload: Record<string, unknown> | undefined;
  const extraction = structuredClone(data);
  if (options.iban !== undefined)
    extraction.bank_statement.iban = options.iban as string;
  const document = () => ({
    id: "source",
    dossierId: "alpha",
    originalName: image.name,
    category: "RELEVES_BANCAIRES",
    mimeType: "image/png",
    createdAtUtc: "2026-09-30T12:00:00Z",
    extractionStatus: status,
    extractedData: extraction,
    processingStatus: "A_TRAITER",
  });
  const job = () => ({
    id: "job",
    documentId: "source",
    status,
    normalizedData: extraction,
    sourceData: extraction,
    validationIssues: [],
  });
  const statements: Record<string, unknown>[] = [];
  let failStart = options.failStart ?? false;
  let gate: Promise<void> | undefined;
  let reviewStarted = false;
  await page.addInitScript(
    ({ user, organizations }) => {
      sessionStorage.setItem(
        "compta-tn.session",
        JSON.stringify({
          accessToken: "mock",
          refreshToken: "mock",
          accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
          user,
          organizations,
        }),
      );
      localStorage.setItem("compta-tn.organization", "org");
    },
    { user, organizations },
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith("/api/")) {
      await route.continue();
      return;
    }
    let body: unknown = [];
    let responseStatus = 200;
    if (path === "/api/auth/me") body = { ...user, organizations };
    else if (path.endsWith("/dossiers"))
      body = {
        items: [dossier("alpha"), dossier("beta")],
        total: 2,
        page: 1,
        pageSize: 100,
      };
    else if (/\/dossiers\/(alpha|beta)$/.test(path))
      body = dossier(path.split("/").at(-1)!);
    else if (path.endsWith("/bank-reconciliation/accounts")) body = accounts;
    else if (path.endsWith("/bank-reconciliation/statements"))
      body = path.includes("/alpha/") ? statements : [];
    else if (path.endsWith("/documents") && request.method() === "POST") {
      expect(request.postData()).toContain("RELEVES_BANCAIRES");
      uploadCount += 1;
      status = "NON_DEMANDEE";
      body = document();
    } else if (path.endsWith("/documents"))
      body = status && !path.includes("/beta/") ? [document()] : [];
    else if (path.endsWith("/extraction") && request.method() === "POST") {
      extractionCount += 1;
      if (failStart) {
        responseStatus = 503;
        body = { message: "Lecture indisponible, réessayez." };
        failStart = false;
      } else {
        status = "EN_COURS";
        body = job();
      }
    } else if (path.endsWith("/extraction")) {
      reviewStarted = true;
      if (gate) await gate;
      body = job();
    } else if (path.endsWith("/preview"))
      body = {
        kind: "image",
        originalName: image.name,
        url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1kAAAAASUVORK5CYII=",
      };
    else if (path.endsWith("/extraction/review")) {
      reviewPayload = request.postDataJSON();
      status = reviewPayload?.decision === "REJETER" ? "REJETEE" : "VALIDEE";
      if (status === "VALIDEE")
        statements.push({
          id: "statement",
          sourceFileName: image.name,
          bankAccountId: reviewPayload?.bankAccountId,
          bankAccount: accounts.find(
            (account) => account.id === reviewPayload?.bankAccountId,
          ),
          periodStart: "2026-09-01",
          periodEnd: "2026-09-30",
          openingBalance: "5000",
          closingBalance: "5224.8",
          rowCount: 4,
          status: "IMPORTE",
        });
      body = job();
    } else if (path.endsWith("/work-sessions/active")) body = null;
    await route.fulfill({
      status: responseStatus,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return {
    setStatus: (value: string) => {
      status = value;
    },
    counts: () => ({
      uploadCount,
      extractionCount,
      imported: statements.length,
    }),
    review: () => reviewPayload,
    delayReview: (value: Promise<void>) => {
      gate = value;
    },
    reviewStarted: () => reviewStarted,
  };
}

async function openScanner(page: Page) {
  await page
    .getByRole("button", { name: "Importer un relevé", exact: true })
    .click();
  const importer = page.getByRole("dialog", {
    name: "Importer un relevé bancaire",
  });
  await importer
    .getByRole("combobox", { name: "Compte bancaire", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Compte B — Banque test", exact: true })
    .click();
  await importer
    .getByRole("button", { name: "Scanner une image avec l’IA" })
    .click();
  await expect(page).toHaveURL(/\/banque\?dossierId=alpha/);
  return page.getByRole("dialog", {
    name: "Scanner un relevé bancaire avec l’IA",
  });
}

test("default period uses local calendar dates without a UTC day shift", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-01T12:00:00Z") });
  await mockWorkspace(page);
  await page.goto("/banque?dossierId=alpha");
  await page
    .getByRole("button", { name: "Importer un relevé", exact: true })
    .click();
  await expect(page.getByLabel("Début de période")).toHaveValue("2026-10-01");
  await expect(page.getByLabel("Fin de période")).toHaveValue("2026-10-31");
});

test("scan survives closing and refresh, then review imports once without leaving Banque", async ({
  page,
}) => {
  const mock = await mockWorkspace(page);
  await page.goto("/banque?dossierId=alpha");
  const scanner = await openScanner(page);
  await scanner.locator('input[type="file"]').setInputFiles(image);
  await scanner
    .getByRole("button", { name: "Lire avec l’IA", exact: true })
    .click();
  await expect(scanner.getByText(/L’IA lit le relevé/)).toBeVisible();
  await scanner
    .getByRole("button", { name: "Continuer en arrière-plan" })
    .click();
  await page.reload();
  const imports = page.getByRole("region", { name: "Imports IA de relevés" });
  await expect(
    imports.getByText("Extraction en cours", { exact: true }),
  ).toBeVisible();
  expect(mock.counts().imported).toBe(0);
  mock.setStatus("A_REVOIR");
  await imports.getByRole("button", { name: "Vérifier les données" }).click();
  const review = page.getByRole("dialog");
  await expect(review.getByRole("img", { name: image.name })).toBeVisible();
  await expect(
    review.getByRole("combobox", { name: "Compte bancaire de destination" }),
  ).toHaveValue("Compte B · TN22222");
  await expect(review.locator("tbody tr")).toHaveCount(4);
  await review.getByLabel("Solde final", { exact: true }).fill("5224.800");
  await review.getByRole("button", { name: "Confirmer ces données" }).click();
  await expect(review).toBeHidden();
  await expect(imports).toHaveCount(0);
  await expect(
    page.getByText("5 224,800", { exact: false }).first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/banque\?dossierId=alpha/);
  expect(mock.counts()).toEqual({
    uploadCount: 1,
    extractionCount: 1,
    imported: 1,
  });
  expect(mock.review()).toMatchObject({
    bankAccountId: "b",
    correctedData: { bank_statement: { closing_balance: "5224.800" } },
  });
});

test("scanner preserves the chosen bank account when the image has no IBAN", async ({
  page,
}) => {
  const mock = await mockWorkspace(page, { iban: null });
  await page.goto("/banque?dossierId=alpha");
  const scanner = await openScanner(page);
  await scanner.locator('input[type="file"]').setInputFiles(image);
  await scanner
    .getByRole("button", { name: "Lire avec l’IA", exact: true })
    .click();
  await expect(scanner.getByText(/L’IA lit le relevé/)).toBeVisible();
  mock.setStatus("A_REVOIR");
  await scanner
    .getByRole("button", { name: "Vérifier les données", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("combobox", { name: "Compte bancaire de destination" }),
  ).toHaveValue("Compte B · TN22222");
});

test("failed extraction start can retry without uploading another original", async ({
  page,
}) => {
  const mock = await mockWorkspace(page, { failStart: true });
  await page.goto("/banque?dossierId=alpha");
  const scanner = await openScanner(page);
  await scanner.locator('input[type="file"]').setInputFiles(image);
  await scanner
    .getByRole("button", { name: "Lire avec l’IA", exact: true })
    .click();
  await expect(
    scanner.getByText("Lecture indisponible, réessayez.", { exact: true }),
  ).toBeVisible();
  await scanner
    .getByRole("button", { name: "Relancer la lecture", exact: true })
    .click();
  await expect(scanner.getByText(/L’IA lit le relevé/)).toBeVisible();
  expect(mock.counts()).toEqual({
    uploadCount: 1,
    extractionCount: 2,
    imported: 0,
  });
});

test("failed jobs remain visible and retryable in Banque", async ({ page }) => {
  const mock = await mockWorkspace(page, { status: "ECHEC" });
  await page.goto("/banque?dossierId=alpha");
  const imports = page.getByRole("region", { name: "Imports IA de relevés" });
  await expect(
    imports.getByText("Extraction échouée", { exact: true }),
  ).toBeVisible();
  await imports.getByRole("button", { name: "Relancer l’extraction" }).click();
  await expect(
    imports.getByText("Extraction en cours", { exact: true }),
  ).toBeVisible();
  expect(mock.counts()).toEqual({
    uploadCount: 0,
    extractionCount: 1,
    imported: 0,
  });
});

test("bank viewers cannot upload, retry or approve extraction", async ({
  page,
}) => {
  await mockWorkspace(page, { status: "A_REVOIR", manage: false });
  await page.goto("/banque?dossierId=alpha");
  await expect(
    page.getByText("Prête à vérifier", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vérifier les données" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Importer un relevé", exact: true }),
  ).toHaveCount(0);
});

test("a late review response cannot open another dossier's statement", async ({
  page,
}) => {
  const mock = await mockWorkspace(page, { status: "A_REVOIR" });
  let release!: () => void;
  mock.delayReview(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  await page.goto("/banque?dossierId=alpha");
  await page
    .getByRole("button", { name: "Vérifier les données", exact: true })
    .click();
  await expect.poll(mock.reviewStarted).toBe(true);
  await page
    .getByRole("combobox", { name: "Dossier client", exact: true })
    .click();
  await page.getByRole("option", { name: "beta SARL", exact: true }).click();
  await expect(page).toHaveURL(/dossierId=beta/);
  const completed = page.waitForResponse((response) =>
    response.url().includes("/documents/source/extraction"),
  );
  release();
  await completed;
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
