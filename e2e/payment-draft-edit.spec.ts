import { expect, test, type Page } from "@playwright/test";

// Reproduce the user's month/day/year native browser date controls.
test.use({ locale: "en-US" });

async function mockWorkspace(
  page: Page,
  options: { status?: string; manage?: boolean; updateError?: boolean } = {},
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
        "payments.view",
        "accounting.view",
        "accounting.post",
        "chart_of_accounts.view",
        ...(options.manage === false ? [] : ["payments.manage"]),
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
  let payment = {
    id: "payment",
    paymentDate: "2027-09-18",
    reference: "DEC-SEP-001",
    amount: "700.000",
    direction: "DECAISSEMENT",
    method: "Virement",
    status: options.status ?? "BROUILLON",
    thirdParty: { id: "supplier", name: "Carthage test" },
    allocations: [{ invoiceId: "invoice", amount: "700.000" }],
  };
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
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
    let status = 200;
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
    else if (path.endsWith("/payments/payment") && request.method() === "PUT") {
      const payload = request.postDataJSON();
      writes.push({ path, body: payload });
      if (options.updateError) {
        status = 409;
        body = { message: "La période est clôturée." };
      } else {
        payment = { ...payment, ...payload };
        body = payment;
      }
    } else if (path.endsWith("/payments/payment/correct")) {
      const payload = request.postDataJSON();
      writes.push({ path, body: payload });
      payment = { ...payment, status: "ANNULE" };
      body = payment;
    } else if (path.endsWith("/payments"))
      body = path.includes("/alpha/") ? [payment] : [];
    else if (path.endsWith("/work-sessions/active")) body = null;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return { writes, payment: () => payment };
}

test("a draft date can be corrected without swapping month/day or creating another payment", async ({
  page,
}) => {
  const mock = await mockWorkspace(page);
  await page.goto("/factures?dossierId=alpha");
  await expect(
    page.getByText("18/09/2027 · Virement · DEC-SEP-001", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Modifier le règlement non comptabilisé",
  });
  await expect(dialog.getByLabel("Date du règlement")).toHaveValue(
    "2027-09-18",
  );
  await dialog.getByLabel("Date du règlement").fill("2026-09-18");
  await expect(
    dialog.getByText("Date retenue : 18 septembre 2026", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Référence", { exact: true })
    .fill("DEC-SEP-001-CORRIGE");
  await dialog
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click();
  await expect(dialog).toBeHidden();
  expect(mock.writes).toEqual([
    {
      path: "/api/organizations/org/dossiers/alpha/payments/payment",
      body: { paymentDate: "2026-09-18", reference: "DEC-SEP-001-CORRIGE" },
    },
  ]);
  expect(mock.payment().amount).toBe("700.000");
  expect(mock.payment().status).toBe("BROUILLON");
  await page.reload();
  await expect(
    page.getByText("18/09/2026 · Virement · DEC-SEP-001-CORRIGE", {
      exact: true,
    }),
  ).toBeVisible();
});

test("posted payments and viewers do not have draft editing controls", async ({
  page,
}) => {
  await mockWorkspace(page, { status: "COMPTABILISE" });
  await page.goto("/factures?dossierId=alpha");
  await expect(page.getByText("Carthage test", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Modifier", exact: true }),
  ).toHaveCount(0);
});

test("draft editing requires payment management permission", async ({
  page,
}) => {
  await mockWorkspace(page, { manage: false });
  await page.goto("/factures?dossierId=alpha");
  await expect(page.getByText("Carthage test", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Modifier", exact: true }),
  ).toHaveCount(0);
});

test("failed updates retain the entered date and show the backend explanation", async ({
  page,
}) => {
  await mockWorkspace(page, { updateError: true });
  await page.goto("/factures?dossierId=alpha");
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Modifier le règlement non comptabilisé",
  });
  await dialog.getByLabel("Date du règlement").fill("2026-09-18");
  await dialog
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click();
  await expect(dialog.getByText("La période est clôturée.")).toBeVisible();
  await expect(dialog.getByLabel("Date du règlement")).toHaveValue(
    "2026-09-18",
  );
});

test("closing a modified draft requires confirmation and does not save", async ({
  page,
}) => {
  const mock = await mockWorkspace(page);
  await page.goto("/factures?dossierId=alpha");
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Modifier le règlement non comptabilisé",
  });
  await dialog.getByLabel("Date du règlement").fill("2026-09-18");
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  await page.getByRole("button", { name: "Quitter sans enregistrer" }).click();
  await expect(dialog).toBeHidden();
  expect(mock.writes).toHaveLength(0);
});

test("a future draft can be cancelled with an earlier correction date", async ({
  page,
}) => {
  const mock = await mockWorkspace(page);
  await page.goto("/factures?dossierId=alpha");
  await page.getByRole("button", { name: "Corriger", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Corriger le règlement",
    exact: true,
  });
  await dialog.getByLabel("Date de correction").fill("2026-10-01");
  await expect(
    dialog.getByText("Date retenue : 1 octobre 2026", { exact: true }),
  ).toBeVisible();
  await dialog.getByLabel("Motif obligatoire").fill("Année saisie par erreur");
  await dialog.getByRole("button", { name: "Confirmer la correction" }).click();
  await expect(dialog).toBeHidden();
  expect(mock.writes[0].body).toMatchObject({
    correctionDate: "2026-10-01",
    correctionType: "ANNULATION_SAISIE",
  });
  expect(mock.payment().status).toBe("ANNULE");
});
