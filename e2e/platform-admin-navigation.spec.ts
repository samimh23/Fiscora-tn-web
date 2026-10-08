import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page) {
  page.on("console", (message) => {
    if (message.type() === "error") console.error(message.text());
  });
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
  await page.addInitScript(
    ({ user, organization }) => {
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
    { user, organization },
  );
  const date = "2026-10-04T12:00:00Z";
  const writes: string[] = [];
  const reads: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    if (route.request().method() === "GET") reads.push(path);
    else writes.push(path);
    let body: unknown = [];
    if (path === "/api/auth/me")
      body = { ...user, organizations: [organization] };
    else if (path.endsWith("/dossiers"))
      body = { items: [], total: 0, page: 1, pageSize: 100 };
    else if (path.endsWith("/work-sessions/active")) body = null;
    else if (path.endsWith("/overview"))
      body = {
        generatedAtUtc: date,
        totals: {
          organizationsTotal: 2,
          organizationsActive: 2,
          usersTotal: 4,
          usersActive: 4,
          activeSessions: 8,
          dossiersActive: 5,
          documentsTotal: 25,
          storageBytes: 14000000,
        },
        services: [
          {
            code: "API",
            label: "API Fiscora",
            status: "OPERATIONNEL",
            detail: "Le service répond aux requêtes authentifiées.",
          },
          {
            code: "DATABASE",
            label: "PostgreSQL",
            status: "OPERATIONNEL",
            detail: "Réponse en 2 ms.",
          },
          {
            code: "BACKUPS",
            label: "Sauvegardes",
            status: "NON_CONFIGURE",
            detail:
              "Aucune stratégie de sauvegarde de production n’est déclarée.",
          },
        ],
        alerts: [
          {
            code: "BACKUPS",
            label: "Sauvegardes de production non configurées",
            count: 1,
            severity: "warning",
          },
        ],
      };
    else if (path.endsWith("/organizations"))
      body = ["Cabinet Pro", "Cabinet Demo"].map((name, i) => ({
        id: `cabinet-${i}`,
        name,
        slug: `cabinet-${i}`,
        isActive: true,
        membersCount: 2,
        dossiersCount: 3,
        documentsCount: 12,
        storageBytes: 7000000,
        lastActivityAtUtc: date,
      }));
    else if (path.endsWith("/users"))
      body = [
        {
          ...user,
          isActive: true,
          membershipsCount: 1,
          activeSessionsCount: 3,
          lastLoginAtUtc: date,
          createdAtUtc: date,
          emailVerified: true,
          mfaEnabled: true,
          memberships: [
            {
              organizationId: "cabinet-0",
              organizationName: "Cabinet Pro",
              role: "Propriétaire",
            },
          ],
        },
        {
          ...user,
          id: "worker",
          fullName: "Colab Test",
          email: "colab@example.invalid",
          isPlatformAdmin: false,
          isActive: true,
          membershipsCount: 2,
          activeSessionsCount: 2,
          lastLoginAtUtc: date,
          createdAtUtc: date,
          emailVerified: true,
          mfaEnabled: false,
          memberships: [
            {
              organizationId: "cabinet-0",
              organizationName: "Cabinet Pro",
              role: "Collaborateur",
            },
            {
              organizationId: "cabinet-1",
              organizationName: "Cabinet Demo",
              role: "Portail client",
            },
          ],
        },
        {
          ...user,
          id: "portal",
          fullName: "Client Test",
          email: "client@example.invalid",
          isPlatformAdmin: false,
          isActive: false,
          emailVerified: false,
          mfaEnabled: true,
          membershipsCount: 1,
          activeSessionsCount: 0,
          lastLoginAtUtc: null,
          createdAtUtc: date,
          disabledReason: "Désactivation de test",
          memberships: [
            {
              organizationId: "cabinet-0",
              organizationName: "Cabinet Pro",
              role: "Portail client",
            },
          ],
        },
        {
          ...user,
          id: "no-cabinet",
          fullName: "Sans Cabinet",
          email: "sans@example.invalid",
          isPlatformAdmin: false,
          isActive: true,
          emailVerified: false,
          membershipsCount: 0,
          activeSessionsCount: 0,
          lastLoginAtUtc: null,
          createdAtUtc: date,
          memberships: [],
        },
      ];
    else if (path.endsWith("/jobs"))
      body = {
        generatedAtUtc: date,
        pipelines: [
          {
            code: "DOCUMENT_EXTRACTION",
            label: "Extraction documentaire",
            status: "OK",
            pending: 0,
            processing: 0,
            failed: 0,
            lastFailureAtUtc: null,
          },
        ],
      };
    else if (path.endsWith("/training-datasets"))
      body = {
        schemaVersion: "fiscora-nuextract-v1",
        counts: [
          { kind: "invoice", status: "READY", count: "800" },
          { kind: "bank_statement", status: "READY", count: "200" },
        ],
        exports: [],
      };
    else if (path.endsWith("/email/status"))
      body = {
        configured: true,
        provider: "SMTP",
        from: "fiscora@example.invalid",
        sentLast24h: 2,
        failedLast24h: 0,
      };
    else if (path.endsWith("/monitoring"))
      body = {
        windowMinutes: 60,
        generatedAtUtc: date,
        history: [],
        pipelines: [],
        http: {
          requestsTotal: 40,
          activeRequests: 0,
          errors5xx: 0,
          errorRate: 0,
          averageDurationMs: 2,
          p95DurationMs: 5,
        },
        runtime: {
          status: "OPERATIONNEL",
          environment: "test",
          nodeVersion: "22",
          startedAtUtc: date,
          uptimeSeconds: 60,
          memoryRssBytes: 100000,
          heapUsedBytes: 50000,
        },
        database: { status: "OPERATIONNEL", latencyMs: 2 },
        integrations: {},
      };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return { writes, reads };
}

async function selectSection(page: Page, name: string) {
  const menu = page.getByRole("button", {
    name: "Ouvrir le menu administrateur",
    includeHidden: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: "Pilotage détaillé" })
    .getByRole("link", { name, exact: true })
    .click();
}

test("training dataset export requires explicit confirmation and creates only one background request", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.goto("/administration-plateforme?section=training");
  await expect(
    page.getByRole("heading", { level: 1, name: "Jeux de données IA" }),
  ).toBeVisible();
  const button = page.getByRole("button", {
    name: "Exporter le jeu de données",
    exact: true,
  });
  await expect(button).toBeDisabled();
  await page
    .getByLabel(
      "Je confirme que cet export est destiné à un entraînement autorisé et restera confidentiel.",
    )
    .check();
  await expect(button).toBeEnabled();
  const request = page.waitForRequest(
    (item) =>
      item.url().endsWith("/training-datasets/exports") &&
      item.method() === "POST",
  );
  await button.click();
  expect((await request).postDataJSON()).toEqual({
    documentKind: "all",
    limit: 1000,
    offset: 0,
  });
  await expect(
    page.getByText(
      "Export demandé. Les images et le ZIP sont préparés en arrière-plan.",
    ),
  ).toBeVisible();
  await expectNoPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("training-datasets.png"),
    fullPage: true,
  });
});

async function expectNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

test("sidebar opens every admin section directly with no stacked dashboard or accidental writes", async ({
  page,
}, testInfo) => {
  const { writes, reads } = await setup(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/administration-plateforme");
  await expect(
    page.getByRole("heading", { name: "Centre de contrôle Fiscora" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Services et intégrations" }),
  ).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
  expect(reads.some((path) => path.endsWith("/organizations"))).toBe(false);
  await expectNoPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("overview.png"),
    fullPage: true,
  });
  const sections = [
    ["Cabinets", "cabinets"],
    ["Utilisateurs", "utilisateurs"],
    ["Abonnements", "abonnements"],
    ["Traitements", "traitements"],
    ["E-mails", "emails"],
    ["Jeux de données IA", "training"],
    ["Supervision", "supervision"],
  ];
  for (const [label, key] of sections) {
    await selectSection(page, label);
    await expect(page).toHaveURL(new RegExp(`section=${key}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: label, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Services et intégrations" }),
    ).toHaveCount(0);
    await expectNoPageOverflow(page);
    if (key === "cabinets")
      await page.screenshot({
        path: testInfo.outputPath("cabinets.png"),
        fullPage: true,
      });
    if (
      await page
        .getByRole("button", { name: "Ouvrir le menu administrateur" })
        .isVisible()
    ) {
      await expect(
        page.getByRole("button", { name: "Ouvrir le menu administrateur" }),
      ).toHaveAttribute("aria-expanded", "false");
    } else {
      await expect(
        page
          .getByRole("navigation")
          .getByRole("link", { name: label, exact: true }),
      ).toHaveAttribute("aria-current", "page");
    }
  }
  expect(
    reads.some((path) =>
      /saas-analytics|audit-logs|electronic-invoices/.test(path),
    ),
  ).toBe(false);
  await expect(
    page.getByRole("link", { name: "Analytics SaaS", includeHidden: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Journal d’audit", includeHidden: true }),
  ).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("deep links, refresh, back navigation and independent searches preserve section context", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/administration-plateforme?section=cabinets");
  await page.getByLabel("Rechercher un cabinet").fill("Cabinet Pro");
  await expect(page.getByRole("cell", { name: "Cabinet Demo" })).toHaveCount(0);
  await selectSection(page, "Utilisateurs");
  await expect(page.getByLabel("Rechercher un compte")).toHaveValue("");
  await page.goBack();
  await expect(page.getByLabel("Rechercher un cabinet")).toHaveValue(
    "Cabinet Pro",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Cabinets", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "Cabinet Demo" })).toBeVisible();
  await selectSection(page, "Vue d’ensemble");
  await expect(
    page.getByRole("heading", { name: "Centre de contrôle Fiscora" }),
  ).toBeVisible();
  await page.goto("/administration-plateforme?section=inconnue");
  await expect(
    page.getByRole("heading", { name: "Centre de contrôle Fiscora" }),
  ).toBeVisible();
});

test("retired admin sections fall back to overview without loading removed APIs", async ({
  page,
}) => {
  const { reads } = await setup(page);
  for (const section of ["analytics", "audit"]) {
    await page.goto(`/administration-plateforme?section=${section}`);
    await expect(
      page.getByRole("heading", { name: "Centre de contrôle Fiscora" }),
    ).toBeVisible();
  }
  expect(
    reads.some((path) =>
      /saas-analytics|audit-logs|electronic-invoices/.test(path),
    ),
  ).toBe(false);
});

test("destructive actions still require explicit confirmation and an audited reason", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto("/administration-plateforme?section=cabinets");
  await page
    .getByRole("button", { name: "Suspendre", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Confirmer la suspension" }),
  ).toBeDisabled();
  await dialog.getByLabel("Justification obligatoire").fill("Court");
  await expect(
    dialog.getByRole("button", { name: "Confirmer la suspension" }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Justification obligatoire")
    .fill("Contrôle manuel de test");
  await expect(
    dialog.getByRole("button", { name: "Confirmer la suspension" }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  expect(writes).toEqual([]);
  await selectSection(page, "Utilisateurs");
  await page.getByRole("button", { name: "Actions pour Admin Test" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Votre compte" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("menuitem", { name: "Révoquer les connexions" }),
  ).toBeDisabled();
});

test("users filters respect roles within the selected cabinet and account details show security", async ({
  page,
}, testInfo) => {
  const { writes } = await setup(page);
  await page.goto("/administration-plateforme?section=utilisateurs");
  await expect(
    page.getByRole("button", { name: "Actions pour Colab Test" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Sessions", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("combobox", { name: "Cabinet", exact: true }).click();
  await page.getByRole("option", { name: "Cabinet Pro", exact: true }).click();
  await page.getByRole("combobox", { name: "Rôle", exact: true }).click();
  await page
    .getByRole("option", { name: "Portail client", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Actions pour Colab Test" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Actions pour Client Test" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Statut", exact: true }).click();
  await page.getByRole("option", { name: "Actif", exact: true }).click();
  await expect(
    page.getByText("Aucun utilisateur trouvé.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Réinitialiser les filtres" }).click();
  await page.getByRole("button", { name: "Actions pour Colab Test" }).click();
  await page.getByRole("menuitem", { name: "Voir les détails" }).click();
  const detail = page.getByRole("dialog", { name: "Détails du compte" });
  await expect(
    detail.getByText("E-mail : Vérifié", { exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByText("Double authentification (MFA) : Désactivée", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(detail.getByText("Cabinet Pro", { exact: true })).toBeVisible();
  await expect(detail.getByText("Cabinet Demo", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Fermer" }).click();
  await expect(detail).toHaveCount(0);
  await expect(page.getByText("Colab Test", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Actions pour Colab Test" }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("users.png"),
    fullPage: true,
  });
  expect(writes).toEqual([]);
});

test("user actions remain guarded and revocation uses the existing audited endpoint", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto("/administration-plateforme?section=utilisateurs");
  await page.getByRole("button", { name: "Actions pour Sans Cabinet" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Révoquer les connexions" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Actions pour Client Test" }).click();
  await page.getByRole("menuitem", { name: "Réactiver le compte" }).click();
  let dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Confirmer la réactivation" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Actions pour Colab Test" }).click();
  await page.getByRole("menuitem", { name: "Désactiver le compte" }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Confirmer la suspension" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Actions pour Colab Test" }).click();
  await page.getByRole("menuitem", { name: "Révoquer les connexions" }).click();
  dialog = page.getByRole("dialog", { name: "Révoquer les connexions" });
  await expect(
    dialog.getByRole("button", { name: "Confirmer la révocation" }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Justification obligatoire")
    .fill("Appareil perdu par le collaborateur");
  expect(writes).toEqual([]);
  const requestPromise = page.waitForRequest(
    (request) =>
      request.url().endsWith("/users/worker/revoke-sessions") &&
      request.method() === "POST",
  );
  await dialog.getByRole("button", { name: "Confirmer la révocation" }).click();
  expect((await requestPromise).postDataJSON()).toEqual({
    reason: "Appareil perdu par le collaborateur",
  });
  await expect(
    page.getByText("Les connexions de Colab Test ont été révoquées."),
  ).toBeVisible();
});
