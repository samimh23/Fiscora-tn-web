import { expect, test, type Page, type Route } from "@playwright/test";

const docId = "00000000-0000-4000-8000-000000000001";
const imageId = "00000000-0000-4000-8000-000000000002";
const deniedId = "00000000-0000-4000-8000-000000000003";
const turn = {
  id: "turn",
  createdAtUtc: "2026-09-30T12:00:00Z",
  question: "Describe the approved documents",
  answer: "Les données validées indiquent 119.000 TND [S1].",
  scope: "DOCUMENT",
  model: "gemini",
  citations: [
    {
      label: "S1",
      chunkId: docId,
      sourceId: docId,
      sourceName: "Invoice.pdf",
      kind: "DOCUMENT",
      pageNumber: 2,
      pages: [2],
      excerpt: "Total TTC : 119.000 TND",
    },
    {
      label: "S2",
      chunkId: imageId,
      sourceId: imageId,
      sourceName: "Statement.svg",
      kind: "DOCUMENT",
      pageNumber: null,
      excerpt: "Solde initial : 5000.000 TND",
    },
    {
      label: "S3",
      chunkId: deniedId,
      sourceId: deniedId,
      sourceName: "Restricted.pdf",
      kind: "DOCUMENT",
      pageNumber: null,
    },
    {
      label: "S4",
      chunkId: docId.replace(/1$/, "4"),
      sourceId: docId.replace(/1$/, "4"),
      sourceName: "Fourth.pdf",
      kind: "DOCUMENT",
      pageNumber: null,
    },
  ],
};

// A two-page test PDF, generated in memory; no production documents or login.
function twoPagePdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...["Original page one", "Total TTC: 119.000 TND"].map((text) => {
      const stream = `BT /F1 15 Tf 20 100 Td (${text}) Tj ET`;
      return `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    }),
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

async function prepare(
  page: Page,
  options: { history?: unknown[]; ask?: (route: Route) => Promise<void> } = {},
) {
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
    legalName: "Demo SARL",
    status: "ACTIVE",
    legalForm: "SARL",
    taxRegime: "REEL",
    isVatSubject: true,
    tags: [],
    employeeCount: 0,
  };
  await page.addInitScript(
    ({ user, organizations }) => {
      sessionStorage.setItem(
        "compta-tn.session",
        JSON.stringify({
          accessToken: "mock",
          refreshToken: "mock",
          user,
          organizations,
        }),
      );
      localStorage.setItem("compta-tn.organization", "org");
    },
    { user, organizations },
  );
  const sourceRequests: { path: string; authorization: string | undefined }[] =
    [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path.endsWith("/assistant/ask") && options.ask)
      return options.ask(route);
    if (path.includes("/documents/")) {
      sourceRequests.push({
        path,
        authorization: route.request().headers().authorization,
      });
      if (path.includes(deniedId))
        return route.fulfill({
          status: 403,
          json: { message: "Access denied" },
        });
      if (path.endsWith("/preview"))
        return route.fulfill({
          json: { kind: path.includes(imageId) ? "image" : "pdf" },
        });
      if (path.endsWith("/content"))
        return route.fulfill(
          path.includes(imageId)
            ? {
                contentType: "image/svg+xml",
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="250"><rect width="500" height="250" fill="#edf6f3"/><text x="30" y="100" font-size="22">Statement original: 5000.000 TND</text></svg>',
              }
            : { contentType: "application/pdf", body: twoPagePdf() },
        );
    }
    let body: unknown = [];
    if (path === "/api/auth/me") body = { ...user, organizations };
    else if (path.endsWith("/dossiers"))
      body = { items: [dossier], total: 1, page: 1, pageSize: 100 };
    else if (path.endsWith("/dossiers/dossier")) body = dossier;
    else if (path.endsWith("/assistant/history"))
      body = { items: options.history ?? [], nextCursor: null };
    else if (path.endsWith("/assistant/index-status"))
      body = { indexed: 2, pending: 0, processing: 0, failed: 0 };
    else if (path.endsWith("/work-sessions/active")) body = null;
    await route.fulfill({ json: body });
  });
  await page.goto("/assistant?dossierId=dossier");
  await expect(
    page.getByRole("heading", { name: "Assistant Fiscora", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Votre question" }),
  ).toBeEnabled();
  return { sourceRequests };
}

test("citations open the authenticated original at its known page, without guessing unknown pages", async ({
  page,
}, info) => {
  const { sourceRequests } = await prepare(page, { history: [turn] });
  await expect(
    page.getByText("Sources documentaires validées", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "[S1] Invoice.pdf · p. 2", exact: true })
    .click();
  const source = page.getByRole("dialog");
  await expect(source.getByText("Page localisée : 2")).toBeVisible();
  await expect(
    source.getByText("Total TTC : 119.000 TND", { exact: true }),
  ).toBeVisible();
  await expect(source.getByText("2 / 2", { exact: true })).toBeVisible();
  await expect(source.locator("canvas")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("source-preview.png"),
    fullPage: true,
  });
  await source.getByRole("button", { name: "Fermer la source" }).click();
  await page
    .getByRole("button", { name: "[S2] Statement.svg", exact: true })
    .click();
  await expect(source.getByText(/Page non localisée/)).toBeVisible();
  await expect(
    source.getByRole("img", { name: "Original : Statement.svg" }),
  ).toBeVisible();
  await source.getByRole("button", { name: "Fermer la source" }).click();
  await page
    .getByRole("button", { name: "[S3] Restricted.pdf", exact: true })
    .click();
  await expect(source.getByText(/L’original est indisponible/)).toBeVisible();
  expect(
    sourceRequests.every((request) => request.authorization === "Bearer mock"),
  ).toBe(true);
  expect(
    sourceRequests.some((request) =>
      request.path.endsWith(`/${deniedId}/content`),
    ),
  ).toBe(false);
});

test("failure retains the question and retries the same message without a duplicate bubble", async ({
  page,
}) => {
  let attempts = 0;
  await prepare(page, {
    ask: async (route) => {
      attempts++;
      await route.fulfill(
        attempts === 1
          ? { status: 503, json: { message: "Temporary failure" } }
          : {
              json: {
                ...turn,
                id: "retry",
                answer: "Fresh answer after retry",
                citations: [],
                scope: "LIVE_FINANCIAL",
              },
            },
      );
    },
  });
  const input = page.getByRole("textbox", { name: "Votre question" });
  await input.fill("What is the balance?");
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(input).toHaveValue("What is the balance?");
  await page.getByRole("button", { name: "Réessayer cette question" }).click();
  await expect(
    page.getByText("Fresh answer after retry", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("What is the balance?", { exact: true }),
  ).toHaveCount(1);
  await expect(page.getByText(/Données comptables actuelles/)).toBeVisible();
  expect(attempts).toBe(2);
});

test("stopped requests and reset conversations cannot append a late answer", async ({
  page,
}) => {
  const waiting: Route[] = [];
  await prepare(page, {
    ask: async (route) => {
      waiting.push(route);
    },
  });
  const input = page.getByRole("textbox", { name: "Votre question" });
  await input.fill("Stop this question");
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect.poll(() => waiting.length).toBe(1);
  await page.getByRole("button", { name: "Arrêter l’attente" }).click();
  await expect(input).toHaveValue("Stop this question");
  await expect(
    page.getByText(/peut encore se terminer sur le serveur/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Réessayer cette question" }).click();
  await expect.poll(() => waiting.length).toBe(2);
  await page
    .getByRole("button", { name: "Nouvelle conversation", exact: true })
    .click();
  for (const route of waiting)
    await route
      .fulfill({
        json: { ...turn, answer: "Late answer must not appear", citations: [] },
      })
      .catch(() => undefined);
  await expect(input).toBeEnabled();
  await expect(
    page.getByText("Late answer must not appear", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Stop this question", { exact: true }),
  ).toHaveCount(0);
});

test("the compact widget exposes every source and the same original viewer", async ({
  page,
}) => {
  await prepare(page, { history: [turn] });
  await page.goto('/dossiers?dossierId=dossier');
  await page
    .getByRole("button", { name: /Ouvrir l’Assistant Fiscora/ })
    .click();
  const widget = page.getByRole("dialog", {
    name: "Assistant Fiscora",
    exact: true,
  });
  await expect(
    widget.getByRole("button", { name: "Voir les 4 sources" }),
  ).toBeVisible();
  await expect(
    widget.getByRole("button", { name: "[S4] Fourth.pdf" }),
  ).toHaveCount(0);
  await widget.getByRole("button", { name: "Voir les 4 sources" }).click();
  await expect(
    widget.getByRole("button", { name: "[S4] Fourth.pdf" }),
  ).toBeVisible();
  await widget
    .getByRole("button", { name: "[S2] Statement.svg", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Original : Statement.svg" }),
  ).toBeVisible();
});
