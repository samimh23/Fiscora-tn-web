import { expect, test } from "@playwright/test";

test("live financial answer retains its citations and opens the requested report year (mocked API)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.on("pageerror", (error) =>
    console.error("Browser error:", error.message),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      console.error("Browser console:", message.text());
  });
  const organizations = [
    {
      id: "org",
      name: "Test Cabinet",
      slug: "test",
      role: "Administrateur",
      permissions: [
        "organization.view",
        "dossiers.view",
        "documents.view",
        "documents.validate",
        "business_invoices.view",
        "payments.view",
        "third_parties.view",
        "financial_statements.view",
      ],
    },
  ];
  const user = {
    id: "user",
    email: "test@example.invalid",
    fullName: "Test User",
    isPlatformAdmin: false,
    mfaEnabled: false,
  };
  const dossier = {
    id: "dossier",
    legalName: "Test SARL",
    status: "ACTIVE",
    legalForm: "SARL",
    taxRegime: "REEL",
    isVatSubject: true,
    tags: [],
    employeeCount: 0,
  };
  await page.addInitScript(
    ({ organizations, user }) => {
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
    { organizations, user },
  );
  const reportRequests: string[] = [];
  const turn = {
    id: "turn",
    createdAtUtc: "2026-09-30T12:00:00Z",
    question: "Résumé financier pour 2024",
    answer: "Résultat net : 200.000 TND. [S1]",
    model: "live-financial-readonly-v1",
    citations: [
      {
        label: "S1",
        chunkId: "live:report:2024",
        sourceId: "report-2024",
        sourceName: "États financiers 2024",
        pageNumber: null,
        kind: "FINANCIAL_REPORT",
        path: "/etats-financiers?dossierId=dossier&year=2024",
      },
    ],
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) {
      await route.continue();
      return;
    }
    let body: unknown = [];
    if (path === "/api/auth/me") body = { ...user, organizations };
    else if (path.endsWith("/dossiers"))
      body = { items: [dossier], total: 1, page: 1, pageSize: 100 };
    else if (path.endsWith("/dossiers/dossier")) body = dossier;
    else if (path.endsWith("/assistant/history"))
      body = { items: [turn], nextCursor: null };
    else if (path.endsWith("/assistant/index-status"))
      body = {
        indexed: 0,
        pending: 0,
        processing: 0,
        failed: 0,
        structuredInvoices: 1,
      };
    else if (path.endsWith("/assistant/ask")) body = turn;
    else if (path.endsWith("/work-sessions/active")) body = null;
    else if (/\/financial-statements\/statements\/\d{4}$/.test(path)) {
      reportRequests.push(path);
      const year = Number(path.split("/").at(-1));
      const zero = { current: "0.000", previous: "0.000" };
      body = {
        source: "TEMPS_REEL",
        currencyCode: "TND",
        period: { year },
        comparisonPeriod: { year: year - 1 },
        balanceSheet: {
          assets: [],
          equityAndLiabilities: [],
          totalAssets: zero,
          totalEquityAndLiabilities: zero,
          balanceDifference: zero,
        },
        incomeStatement: {
          lines: [],
          operatingResult: zero,
          ordinaryResultBeforeTax: zero,
          netResult: zero,
        },
        cashFlowStatement: { lines: [] },
        controls: [],
        mappingWarnings: [],
        notes: null,
      };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/assistant?dossierId=dossier");
  await expect(
    page.getByRole("heading", { name: "Assistant Fiscora", exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByText("Résultat net : 200.000 TND. [S1]", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Résultat net : 200.000 TND. [S1]", { exact: true }),
  ).toBeVisible();
  await page.getByText("[S1] États financiers 2024", { exact: true }).click();
  await expect(page).toHaveURL(/etats-financiers\?dossierId=dossier&year=2024/);
  await expect(page.getByRole("combobox", { name: "Exercice" })).toHaveText(
    "2024",
  );
  await expect
    .poll(() => reportRequests.some((path) => path.endsWith("/2024")))
    .toBe(true);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Exercice" })).toHaveText(
    "2024",
  );
  await page.goto("/etats-financiers?dossierId=dossier&year=2008");
  await expect(page.getByRole("combobox", { name: "Exercice" })).toHaveText(
    "2008",
  );
  await expect
    .poll(() => reportRequests.some((path) => path.endsWith("/2008")))
    .toBe(true);
});
