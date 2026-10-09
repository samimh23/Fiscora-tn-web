import { expect, test, type Page } from "@playwright/test";

async function mockDocuments(
  page: Page,
  canUpload: boolean,
  options: {
    canValidate?: boolean;
    inbox?: boolean;
    approvedBank?: boolean;
  } = {},
) {
  const user = {
    id: "test",
    email: "test@example.invalid",
    fullName: "Test",
    isPlatformAdmin: false,
    mfaEnabled: false,
  };
  const organization = {
    id: "org",
    name: "Cabinet test",
    slug: "test",
    role: "Comptable",
    permissions: [
      "dossiers.view",
      "documents.view",
      ...(canUpload ? ["documents.upload"] : []),
      ...(options.canValidate ? ["documents.validate"] : []),
    ],
  };
  const dossier = {
    id: "alpha",
    legalName: "Collecte SARL",
    status: "ACTIF",
    legalForm: "SARL",
    taxRegime: "REEL",
    isVatSubject: true,
    tags: [],
  };
  const documents = [
    {
      id: "old-email",
      dossierId: "alpha",
      originalName: "ancienne-facture.pdf",
      category: "FACTURES_ACHATS",
      mimeType: "application/pdf",
      sizeBytes: "100",
      periodYear: 2026,
      periodMonth: 10,
      createdAtUtc: "2026-10-01T10:00:00Z",
      processingStatus: "A_TRAITER",
      extractionStatus: "NON_DEMANDEE",
      malwareScanStatus: "SAIN",
      ingestionSource: "EMAIL",
      sourceEmail: "client@example.invalid",
      uploadedBy: { type: "EMAIL", name: "Client" },
    },
  ];
  if (options.inbox) {
    documents[0].category = "BOITE_RECEPTION";
    documents[0].uploadedBy = { type: "CLIENT", name: "Client" };
  }
  if (options.approvedBank) {
    documents[0].category = "RELEVES_BANCAIRES";
    documents[0].extractionStatus = "VALIDEE";
  }
  const extractionRequests: unknown[] = [];
  let uploads = 0;
  const inboundRequests: string[] = [];
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
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith("/api/")) {
      await route.continue();
      return;
    }
    let body: unknown = [];
    if (path.includes("/email-ingestion")) inboundRequests.push(path);
    if (path === "/api/auth/me")
      body = { ...user, organizations: [organization] };
    else if (path.endsWith("/dossiers"))
      body = { items: [dossier], total: 1, page: 1, pageSize: 100 };
    else if (path.endsWith("/dossiers/alpha")) body = dossier;
    else if (path.endsWith("/documents") && request.method() === "POST") {
      uploads += 1;
      const uploaded = {
        ...documents[0],
        id: "manual",
        originalName: "nouvelle-facture.png",
        mimeType: "image/png",
        ingestionSource: "UPLOAD",
        sourceEmail: "",
        uploadedBy: { type: "CABINET", name: "Test" },
      };
      documents.push(uploaded);
      body = uploaded;
    } else if (path.endsWith("/documents")) body = documents;
    else if (path.endsWith("/extraction") && request.method() === "POST") {
      const payload = request.postDataJSON();
      extractionRequests.push(payload);
      documents[0].category = payload.category ?? documents[0].category;
      documents[0].extractionStatus = "EN_ATTENTE";
      body = { id: "job", documentId: documents[0].id, status: "EN_ATTENTE" };
    } else if (path.endsWith("/extraction"))
      body = {
        id: "job",
        documentId: documents[0].id,
        document: documents[0],
        status: "VALIDEE",
        validationIssues: [],
        normalizedData: {
          document_type: "bank_statement",
          bank_statement: {
            opening_balance: "5000.000",
            closing_balance: "5224.800",
            transactions: [],
          },
        },
      };
    else if (path.endsWith("/preview"))
      body = {
        kind: "image",
        originalName: documents[0].originalName,
        url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1kAAAAASUVORK5CYII=",
      };
    else if (path.endsWith("/work-sessions/active")) body = null;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return { uploads: () => uploads, inboundRequests, extractionRequests };
}

test("client inbox document can be categorized and read without uploading it again", async ({
  page,
}) => {
  const state = await mockDocuments(page, true, {
    canValidate: true,
    inbox: true,
  });
  await page.goto("/documents?dossierId=alpha");
  await page
    .getByRole("button", { name: "Lire avec l’IA", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Lire la pièce avec l’IA" });
  await expect(
    dialog.getByRole("button", { name: "Lire avec l’IA", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("combobox", { name: "Type de pièce" }).click();
  await page
    .getByRole("option", { name: "Factures d’achats", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Lire avec l’IA", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  expect(state.extractionRequests).toEqual([{ category: "FACTURES_ACHATS" }]);
  expect(state.uploads()).toBe(0);
});

test("approved bank source is classified and saved comparison is read-only", async ({
  page,
}) => {
  const state = await mockDocuments(page, true, {
    canValidate: true,
    approvedBank: true,
  });
  await page.goto("/documents?dossierId=alpha");
  await expect(
    page.getByText("Classé · Importé en banque", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Terminer le classement" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Lire avec l’IA", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Original + résultats", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: /Original et résultats enregistrés/,
  });
  await expect(dialog.getByRole("img")).toBeVisible();
  await expect(dialog.getByLabel("Solde final", { exact: true })).toHaveValue(
    "5224.800",
  );
  await expect(
    dialog.getByLabel("Solde final", { exact: true }),
  ).toHaveAttribute("readonly", "");
  await expect(
    dialog.getByRole("button", { name: "Confirmer ces données" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await page
    .getByRole("button", { name: "Original + résultats", exact: true })
    .click();
  await expect(dialog.getByRole("img")).toBeVisible();
  expect(state.extractionRequests).toEqual([]);
});

for (const canUpload of [true, false]) {
  test(`document collection has no inbound-email UI or requests (upload=${canUpload})`, async ({
    page,
  }) => {
    const state = await mockDocuments(page, canUpload);
    await page.goto("/documents?dossierId=alpha");
    await expect(
      page.getByRole("heading", { name: "Collecter et préparer les pièces" }),
    ).toBeVisible();
    await expect(
      page.getByText("Recevoir les factures par e-mail", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Adresse dédiée à ce dossier", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/e-mail\(s\) à classer/)).toHaveCount(0);
    await expect(
      page.getByText("ancienne-facture.pdf", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Reçu par e-mail", { exact: true }),
    ).toBeVisible();
    if (canUpload) {
      await page
        .getByRole("button", { name: "Déposer un document", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.locator('input[type="file"]').setInputFiles({
        name: "nouvelle-facture.png",
        mimeType: "image/png",
        buffer: Buffer.from("test"),
      });
      await dialog
        .getByRole("button", { name: "Ajouter au dossier", exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByText("nouvelle-facture.png", { exact: true }),
      ).toBeVisible();
      expect(state.uploads()).toBe(1);
    } else {
      await expect(
        page.getByRole("button", { name: "Déposer un document", exact: true }),
      ).toHaveCount(0);
    }
    expect(state.inboundRequests).toEqual([]);
  });
}
