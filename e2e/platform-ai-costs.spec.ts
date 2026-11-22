import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "admin",
  email: "admin@example.invalid",
  fullName: "Admin Test",
  isPlatformAdmin: true,
  mfaEnabled: false,
};
const organization = {
  id: "org",
  name: "Cabinet test",
  slug: "test",
  role: "Propriétaire",
  permissions: [],
};

const aiUsage = {
  days: 30,
  trackingSinceUtc: "2026-11-01T08:00:00Z",
  totals: { calls: 412, problems: 9, costUsd: 0.8421 },
  features: [
    {
      feature: "assistant_answer",
      provider: "vertex",
      model: "gemini-2.5-flash",
      calls: 120,
      errors: 2,
      fallbacks: 0,
      retried: 3,
      p50Ms: 1700,
      p95Ms: 3300,
      inputTokens: 360000,
      outputTokens: 48000,
      units: 0,
      costUsd: 0.228,
      lastCallAtUtc: "2026-11-22T10:00:00Z",
      lastProblemAtUtc: "2026-11-21T09:30:00Z",
    },
    {
      feature: "rerank",
      provider: "ranking",
      model: "semantic-ranker-default@latest",
      calls: 118,
      errors: 0,
      fallbacks: 7,
      retried: 0,
      p50Ms: 420,
      p95Ms: 2500,
      inputTokens: 0,
      outputTokens: 0,
      units: 3540,
      costUsd: 0.111,
      lastCallAtUtc: "2026-11-22T10:00:00Z",
      lastProblemAtUtc: "2026-11-22T08:00:00Z",
    },
  ],
  daily: [
    { date: "2026-11-21", calls: 200, problems: 5, costUsd: 0.4 },
    { date: "2026-11-22", calls: 212, problems: 4, costUsd: 0.44 },
  ],
  assistant: {
    answers: 120,
    likes: 18,
    dislikes: 2,
    comments: 1,
    withoutSource: 3,
    weekly: [{ week: "2026-11-16", likes: 18, dislikes: 2 }],
    organizations: [
      { organizationName: "Cabinet Pro", answers: 120, dislikes: 2 },
    ],
  },
};

const ratedAnswers = [
  {
    id: "turn",
    createdAtUtc: "2026-11-22T09:00:00Z",
    feedbackAtUtc: "2026-11-22T09:01:00Z",
    rating: -1,
    comment: "Le montant TTC manque",
    question: "Quel est le total de la facture A-BLUE-SEP-001 ?",
    answer: "Le total HT est de 500,000 TND [S1].",
    sources: ["[S1] 01-facture-achat-septembre.pdf"],
    modelName: "gemini-2.5-flash",
    organizationName: "Cabinet Pro",
    dossierName: "FISCORA LAB TEST SARL",
  },
];

const costs = {
  azure: {
    provider: "azure",
    status: "OK",
    scope: "/subscriptions/s/resourceGroups/rg-fiscora-staging",
    currency: "USD",
    monthToDate: 52.83,
    credits: null,
    lastMonth: 64.93,
    monthlyBudget: 40,
    byService: [
      { name: "Azure App Service", project: null, cost: 36.05 },
      { name: "Azure Database for PostgreSQL", project: null, cost: 12.83 },
    ],
    daily: [
      { date: "2026-11-21", cost: 2.46 },
      { date: "2026-11-22", cost: 1.14 },
    ],
    refreshedAtUtc: "2026-11-22T10:00:00Z",
    message: null,
  },
  gcp: {
    provider: "gcp",
    status: "WAITING_FOR_EXPORT",
    scope: "fiscora-ai.billing_export",
    currency: null,
    monthToDate: null,
    credits: null,
    lastMonth: null,
    monthlyBudget: 50,
    byService: [],
    daily: [],
    refreshedAtUtc: "2026-11-22T10:00:00Z",
    message: "The billing export is not enabled yet.",
  },
};

async function setup(page: Page, language?: string, usage: unknown = aiUsage) {
  page.on("pageerror", (error) => console.error(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") console.error(message.text());
  });
  await page.addInitScript(
    ({ user, organization, language }) => {
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
      if (language) localStorage.setItem("compta-tn-language", language);
    },
    { user, organization, language },
  );
  const feedbackFilters: string[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (!path.startsWith("/api/")) return route.continue();
    let body: unknown = [];
    if (path === "/api/auth/me")
      body = { ...user, organizations: [organization] };
    else if (path.endsWith("/dossiers"))
      body = { items: [], total: 0, page: 1, pageSize: 100 };
    else if (path.endsWith("/work-sessions/active")) body = null;
    else if (path === "/api/platform-admin/overview")
      body = {
        generatedAtUtc: "2026-11-22T10:00:00Z",
        totals: {
          organizationsTotal: 1,
          organizationsActive: 1,
          usersTotal: 1,
          usersActive: 1,
          activeSessions: 1,
          dossiersActive: 1,
          documentsTotal: 3,
          storageBytes: 1000,
        },
        services: [],
        alerts: [],
      };
    else if (path === "/api/platform-admin/ai-usage") body = usage;
    else if (path === "/api/platform-admin/assistant-feedback") {
      feedbackFilters.push(url.searchParams.get("rating") ?? "");
      body = url.searchParams.get("rating") === "down" ? ratedAnswers : [];
    } else if (path === "/api/platform-admin/cloud-costs") body = costs;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return { feedbackFilters };
}

test("platform admin sees AI usage, quality and the disliked answers", async ({
  page,
}) => {
  const { feedbackFilters } = await setup(page);
  await page.goto("/administration-plateforme?section=ia");
  await expect(page.getByText("Appels IA", { exact: true })).toBeVisible();
  await expect(page.getByText("412", { exact: true })).toBeVisible();
  await expect(page.getByText("90 % utiles", { exact: true })).toBeVisible();
  const answerRow = page
    .getByRole("row")
    .filter({ hasText: "Réponses de l’assistant" });
  await expect(answerRow.getByText("3.30 s", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Reclassement des passages" }),
  ).toContainText("7");

  // Disliked answers come first, with the user's comment.
  await expect(page.getByText("Le montant TTC manque")).toBeVisible();
  await expect(
    page.getByText("Quel est le total de la facture A-BLUE-SEP-001 ?"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Utiles", exact: true }).click();
  await expect(
    page.getByText("Aucune réponse notée pour ce filtre."),
  ).toBeVisible();
  expect(feedbackFilters).toEqual(["down", "up"]);
});

test("platform admin sees Azure spend against the budget and the Google export step", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/administration-plateforme?section=couts");
  await expect(page.getByText("52.83 $", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Budget mensuel : 40.00 $", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Azure App Service" }),
  ).toContainText("36.05 $");
  await expect(page.getByText("132 %", { exact: true })).toBeVisible();
  await expect(page.getByText("Export en attente")).toBeVisible();
  await expect(page.getByText(/jeu de données billing_export/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Ouvrir l’export de facturation/ }),
  ).toHaveAttribute("href", "https://console.cloud.google.com/billing/export");
});

test("the AI and cost screens are translated in English", async ({ page }) => {
  await setup(page, "en");
  await page.goto("/administration-plateforme?section=ia");
  await expect(page.getByText("AI calls", { exact: true })).toBeVisible();
  await expect(page.getByText("90 % useful", { exact: true })).toBeVisible();
  await page.goto("/administration-plateforme?section=couts");
  await expect(
    page.getByText("Monthly budget: 40.00 $", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Export pending")).toBeVisible();
});

test("before the first recorded call, the AI page explains why it is empty", async ({
  page,
}) => {
  await setup(page, undefined, {
    ...aiUsage,
    trackingSinceUtc: null,
    totals: { calls: 0, problems: 0, costUsd: 0 },
    features: [],
    daily: [],
    assistant: { ...aiUsage.assistant, likes: 0, dislikes: 0, weekly: [] },
  });
  await page.goto("/administration-plateforme?section=ia");
  await expect(
    page.getByText(/Le suivi des appels IA est actif/),
  ).toBeVisible();
  await expect(
    page.getByText("Aucun appel à afficher pour cette période."),
  ).toBeVisible();
  await expect(page.getByText(/Aucun avis pour l’instant/)).toBeVisible();
  await page.getByRole("button", { name: "7 j", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "7 j", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
