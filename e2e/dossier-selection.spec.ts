import { expect, test, type Page } from "@playwright/test";

const organizations = [
  {
    id: "org-a",
    name: "Cabinet A",
    slug: "a",
    role: "Administrateur",
    permissions: [
      "dossiers.view",
      "documents.view",
      "accounting.view",
      "assistant.ask",
    ],
  },
  {
    id: "org-b",
    name: "Cabinet B",
    slug: "b",
    role: "Administrateur",
    permissions: [
      "dossiers.view",
      "documents.view",
      "accounting.view",
      "assistant.ask",
    ],
  },
];
const user = {
  id: "test-user",
  email: "test@example.invalid",
  fullName: "Test User",
  isPlatformAdmin: false,
  mfaEnabled: false,
};
const dossier = (id: string, legalName: string) => ({
  id,
  legalName,
  tradeName: null,
  taxIdentifier: null,
  legalForm: "SARL",
  taxRegime: "REEL",
  status: "ACTIVE",
  isVatSubject: true,
  activitySector: "Services",
  tags: [],
  employeeCount: 0,
});
const items = [dossier("alpha", "Alpha SARL"), dossier("beta", "Beta SARL")];

async function mockWorkspace(
  page: Page,
  { extraPermissions = [], sharedPermissions = [] }: {
    extraPermissions?: string[];
    sharedPermissions?: string[];
  } = {},
) {
  const workspaceOrganizations = organizations.map((organization) => ({
    ...organization,
    permissions: [
      ...organization.permissions,
      ...sharedPermissions,
      ...(organization.id === "org-a" ? extraPermissions : []),
    ],
  }));
  page.on("pageerror", (error) =>
    console.error("Browser error:", error.message),
  );
  const requests: string[] = [];
  await page.addInitScript(
    ({ organizations, user }) => {
      if (!sessionStorage.getItem("compta-tn.session")) {
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
      }
      if (!localStorage.getItem("compta-tn.organization"))
        localStorage.setItem("compta-tn.organization", "org-a");
    },
    { organizations: workspaceOrganizations, user },
  );
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (!path.startsWith("/api/")) {
      await route.continue();
      return;
    }
    requests.push(path);
    let body: unknown = [];
    if (path === "/api/auth/me")
      body = { ...user, organizations: workspaceOrganizations };
    else if (/\/dossiers$/.test(path))
      body = {
        items: path.includes("org-b")
          ? [dossier("gamma", "Gamma SARL")]
          : items,
        total: 2,
        page: 1,
        pageSize: 100,
      };
    else if (/\/dossiers\/[^/]+$/.test(path))
      body = [...items, dossier("gamma", "Gamma SARL")].find((item) =>
        path.endsWith(`/${item.id}`),
      );
    else if (path.endsWith("/assistant/history"))
      body = { items: [], nextCursor: null };
    else if (path.endsWith("/assistant/index-status"))
      body = { pending: 0, processing: 0, ready: 0, failed: 0 };
    else if (path.endsWith("/work-sessions/active")) body = null;
    else if (path.endsWith("/quality-assurance"))
      body = {
        totals: {
          dossiersChecked: 0,
          averageScore: 0,
          BLOCKER: 0,
          WARNING: 0,
          INFO: 0,
        },
        dossiers: [],
      };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return requests;
}

async function chooseGlobal(page: Page, name: string) {
  await page.getByRole("combobox", { name: "Dossier client" }).first().click();
  await page.getByRole("option", { name, exact: true }).click();
}

test.describe("shared dossier selection (mocked API)", () => {
  test.beforeEach(async ({ page }, info) => {
    page.setDefaultTimeout(15_000);
    test.skip(
      info.project.name !== "desktop",
      "Run the state regression once.",
    );
  });

  test("selection survives module navigation, refresh and a URL without dossierId", async ({
    page,
  }) => {
    await mockWorkspace(page);
    await page.goto("/documents?dossierId=alpha");
    await chooseGlobal(page, "Beta SARL");
    await expect(page).toHaveURL(/dossierId=beta/);
    await page.getByRole("link", { name: "Comptabilité", exact: true }).click();
    await expect(page).toHaveURL(/comptabilite\?dossierId=beta/);
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "Dossier client" }),
    ).toHaveValue("Beta SARL");
    await page.goto("/documents");
    await expect(
      page.getByRole("combobox", { name: "Dossier client" }),
    ).toHaveValue("Beta SARL");
    await expect(
      page.getByRole("heading", { name: "Beta SARL", exact: true }),
    ).toBeVisible();
  });

  test("module links are permission-aware and keep the active dossier", async ({
    page,
  }) => {
    await mockWorkspace(page, {
      extraPermissions: [
        "payroll.view",
        "declarations.view",
        "fixed_assets.view",
        "foreign_trade.view",
        "quality_assurance.view",
      ],
      sharedPermissions: ["fiscal_settings.view", "billing.view"],
    });
    await page.goto("/documents?dossierId=alpha");
    const sidebar = page.getByRole("navigation");
    await sidebar.getByRole("button", { name: "Fiscal & social" }).click();
    await sidebar.getByRole("button", { name: "Travail du cabinet" }).click();
    const modules = [
      ["Immobilisations", "/immobilisations", "Immobilisations"],
      [
        "Commerce extérieur",
        "/commerce-exterieur",
        "Devises & commerce extérieur",
      ],
      ["Fiscal annuel", "/fiscal-annuel", "Fiscal annuel"],
      ["Paie & CNSS", "/paie", "Paie & CNSS"],
      ["Assurance qualité", "/qualite", "Assurance qualité"],
    ];
    for (const [label, path, heading] of modules) {
      const link = sidebar.getByRole("link", { name: label, exact: true });
      await expect(link).toHaveAttribute("href", `${path}?dossierId=alpha`);
      await link.click();
      await expect(page).toHaveURL(`${path}?dossierId=alpha`);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
    }
    await page.getByRole("combobox", { name: "Cabinet", exact: true }).click();
    await page.getByRole("option", { name: "Cabinet B", exact: true }).click();
    await expect(sidebar.getByRole("link", { name: "Honoraires" })).toBeVisible();
    for (const [label] of modules) {
      await expect(
        sidebar.getByRole("link", { name: label, exact: true }),
      ).toHaveCount(0);
    }
  });

  test("notification clicks open the exact fiscal obligation, document, conversation, and task", async ({
    page,
  }) => {
    await mockWorkspace(page, {
      extraPermissions: [
        "notifications.view",
        "obligations.view",
        "client_portal.view",
        "tasks.view",
      ],
    });
    const dossierId = "beta";
    const notices = [
      {
        id: "n1",
        title: "Obligation en retard",
        body: "Beta SARL · Déclaration mensuelle · Échéance : 19/12/2024",
        target: { kind: "obligation", dossierId, id: "deadline", year: 2024 },
        readAtUtc: null,
      },
      {
        id: "n2",
        title: "Pièce client reçue",
        body: "Le document de novembre est disponible.",
        target: { kind: "document", dossierId, id: "document" },
        readAtUtc: null,
      },
      {
        id: "n3",
        title: "Nouveau message de Beta SARL",
        target: { kind: "conversation", dossierId },
        readAtUtc: null,
      },
      {
        id: "n4",
        title: "Nouvelle tâche affectée",
        target: { kind: "task", dossierId, id: "task" },
        readAtUtc: null,
      },
    ];
    const apiBase = "**/api/organizations/org-a";
    await page.route(`${apiBase}/notifications`, (route) =>
      route.fulfill({ json: notices }),
    );
    await page.route(`${apiBase}/notifications/*/read`, (route) =>
      route.fulfill({ json: {} }),
    );
    await page.route(
      `${apiBase}/dossiers/beta/obligations?year=2024`,
      (route) =>
        route.fulfill({
          json: [
            {
              id: "deadline",
              code: "MONTHLY",
              name: "Déclaration mensuelle",
              periodYear: 2024,
              periodMonth: 12,
              dueOn: "2024-12-19",
              isLate: true,
              status: "NON_COMMENCEE",
            },
          ],
        }),
    );
    await page.route(
      `${apiBase}/dossiers/beta/documents/document/preview`,
      (route) =>
        route.fulfill({
          json: {
            kind: "text",
            originalName: "novembre.txt",
            content: "Pièce de novembre",
          },
        }),
    );
    await page.route(`${apiBase}/dossiers/beta/tasks/task`, (route) =>
      route.fulfill({
        json: {
          id: "task",
          dossierId,
          title: "Vérifier novembre",
          status: "A_FAIRE",
          priority: "NORMALE",
          dueOn: "2024-12-19",
          checklist: [],
          checklistCompleted: 0,
          checklistTotal: 0,
        },
      }),
    );
    await page.goto("/documents?dossierId=alpha");
    const open = async (title: string, id: string) => {
      await page
        .getByRole("button", { name: "Notifications", exact: true })
        .click();
      const notice = page.getByRole("menuitem", { name: new RegExp(title) });
      const read = page.waitForRequest(
        (req) =>
          req.url().endsWith(`/notifications/${id}/read`) &&
          req.method() === "PATCH",
      );
      await notice.click();
      await read;
      await expect(
        page.getByRole("menuitem", { name: new RegExp(title) }),
      ).not.toBeVisible();
    };
    await open("Obligation en retard", "n1");
    await expect(page).toHaveURL(
      /obligations\?dossierId=beta&obligationId=deadline&year=2024/,
    );
    await expect(page.locator("#obligation-deadline")).toContainText(
      "Déclaration mensuelle",
    );
    await open("Pièce client reçue", "n2");
    await expect(page.getByRole("dialog")).toContainText("Pièce de novembre");
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await open("Nouveau message de Beta SARL", "n3");
    await expect(page).toHaveURL(/dossiers\/beta\?espace=messages/);
    await expect(
      page.getByText("Messages du portail client", { exact: true }),
    ).toBeVisible();
    await open("Nouvelle tâche affectée", "n4");
    await expect(page.getByRole("dialog")).toContainText("Vérifier novembre");
  });

  test("assistant uses the global selection and one cached dossier list", async ({
    page,
  }) => {
    const requests = await mockWorkspace(page);
    await page.goto("/documents?dossierId=alpha");
    await expect(
      page.getByRole("combobox", { name: "Dossier client" }),
    ).toHaveValue("Alpha SARL");
    await page
      .getByRole("button", { name: "Ouvrir l’Assistant Fiscora", exact: true })
      .click();
    const assistant = page.getByRole("dialog", { name: "Assistant Fiscora" });
    await assistant.getByRole("combobox", { name: "Dossier client" }).click();
    await page.getByRole("option", { name: "Beta SARL", exact: true }).click();
    await expect(
      page.getByRole("combobox", { name: "Dossier client" }).first(),
    ).toHaveValue("Beta SARL");
    await expect(
      page.getByRole("heading", { name: "Beta SARL", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/dossierId=beta/);
    expect(
      requests.filter((path) => path === "/api/organizations/org-a/dossiers"),
    ).toHaveLength(1);
  });

  test("explicit deep links override remembered selection", async ({
    page,
  }) => {
    await mockWorkspace(page);
    await page.goto("/documents?dossierId=alpha");
    await chooseGlobal(page, "Beta SARL");
    await page.goto("/documents?dossierId=alpha&sourceDocumentId=source");
    await expect(
      page.getByRole("combobox", { name: "Dossier client" }),
    ).toHaveValue("Alpha SARL");
    await chooseGlobal(page, "Beta SARL");
    await expect(page).toHaveURL(/sourceDocumentId=source/);
  });

  test("switching cabinets never requests the previous cabinet's dossier", async ({
    page,
  }) => {
    const requests = await mockWorkspace(page);
    await page.goto("/documents?dossierId=beta");
    await expect(
      page.getByRole("combobox", { name: "Dossier client" }),
    ).toHaveValue("Beta SARL");
    await page.getByRole("combobox", { name: "Cabinet", exact: true }).click();
    await page.getByRole("option", { name: "Cabinet B", exact: true }).click();
    await expect(
      page.getByRole("combobox", { name: "Dossier client" }),
    ).toHaveValue("Gamma SARL");
    expect(requests.some((path) => path.includes("/org-b/dossiers/beta"))).toBe(
      false,
    );
    await page.getByRole("combobox", { name: "Cabinet", exact: true }).click();
    await page.getByRole("option", { name: "Cabinet A", exact: true }).click();
    await expect(
      page.getByRole("combobox", { name: "Dossier client" }),
    ).toHaveValue("Beta SARL");
    expect(
      requests.some((path) => path.includes("/org-a/dossiers/gamma")),
    ).toBe(false);
  });

  test("a late assistant response does not leak into another dossier conversation", async ({
    page,
  }) => {
    await mockWorkspace(page);
    let release: () => void = () => undefined;
    const responseGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/organizations/*/assistant/ask", async (route) => {
      await responseGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "answer",
          answer: "Réponse pour Alpha",
          citations: [],
          actions: [],
        }),
      });
    });
    await page.goto("/assistant?dossierId=alpha");
    await page
      .getByRole("textbox", { name: "Votre question" })
      .fill("Total des factures ?");
    const request = page.waitForRequest((req) =>
      req.url().endsWith("/assistant/ask"),
    );
    await page.getByRole("button", { name: "Envoyer", exact: true }).click();
    await request;
    await chooseGlobal(page, "Beta SARL");
    const response = page.waitForResponse((res) =>
      res.url().endsWith("/assistant/ask"),
    );
    release();
    await response;
    await expect(
      page.getByRole("textbox", { name: "Votre question" }),
    ).toBeEnabled();
    await expect(
      page.getByText("Réponse pour Alpha", { exact: true }),
    ).toHaveCount(0);
  });
});
