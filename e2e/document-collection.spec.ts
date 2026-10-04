import { expect, test, type Page } from "@playwright/test";

async function mockDocuments(page: Page, canUpload: boolean) {
  const user = {
    id: "test", email: "test@example.invalid", fullName: "Test",
    isPlatformAdmin: false, mfaEnabled: false,
  };
  const organization = {
    id: "org", name: "Cabinet test", slug: "test", role: "Comptable",
    permissions: ["dossiers.view", "documents.view", ...(canUpload ? ["documents.upload"] : [])],
  };
  const dossier = {
    id: "alpha", legalName: "Collecte SARL", status: "ACTIF",
    legalForm: "SARL", taxRegime: "REEL", isVatSubject: true, tags: [],
  };
  const documents = [{
    id: "old-email", dossierId: "alpha", originalName: "ancienne-facture.pdf",
    category: "FACTURES_ACHATS", mimeType: "application/pdf", sizeBytes: "100",
    periodYear: 2026, periodMonth: 10, createdAtUtc: "2026-10-01T10:00:00Z",
    processingStatus: "A_TRAITER", extractionStatus: "NON_DEMANDEE",
    malwareScanStatus: "SAIN", ingestionSource: "EMAIL",
    sourceEmail: "client@example.invalid", uploadedBy: { type: "EMAIL", name: "Client" },
  }];
  let uploads = 0;
  const inboundRequests: string[] = [];
  await page.addInitScript(({ user, organization }) => {
    sessionStorage.setItem("compta-tn.session", JSON.stringify({
      accessToken: "mock", refreshToken: "mock", accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z",
      user, organizations: [organization],
    }));
    localStorage.setItem("compta-tn.organization", organization.id);
  }, { user, organization });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith("/api/")) { await route.continue(); return; }
    let body: unknown = [];
    if (path.includes("/email-ingestion")) inboundRequests.push(path);
    if (path === "/api/auth/me") body = { ...user, organizations: [organization] };
    else if (path.endsWith("/dossiers")) body = { items: [dossier], total: 1, page: 1, pageSize: 100 };
    else if (path.endsWith("/dossiers/alpha")) body = dossier;
    else if (path.endsWith("/documents") && request.method() === "POST") {
      uploads += 1;
      const uploaded = {
        ...documents[0], id: "manual", originalName: "nouvelle-facture.png",
        mimeType: "image/png", ingestionSource: "UPLOAD", sourceEmail: "",
        uploadedBy: { type: "CABINET", name: "Test" },
      };
      documents.push(uploaded);
      body = uploaded;
    } else if (path.endsWith("/documents")) body = documents;
    else if (path.endsWith("/work-sessions/active")) body = null;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return { uploads: () => uploads, inboundRequests };
}

for (const canUpload of [true, false]) {
  test(`document collection has no inbound-email UI or requests (upload=${canUpload})`, async ({ page }) => {
    const state = await mockDocuments(page, canUpload);
    await page.goto("/documents?dossierId=alpha");
    await expect(page.getByRole("heading", { name: "Collecter et préparer les pièces" })).toBeVisible();
    await expect(page.getByText("Recevoir les factures par e-mail", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Adresse dédiée à ce dossier", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/e-mail\(s\) à classer/)).toHaveCount(0);
    await expect(page.getByText("ancienne-facture.pdf", { exact: true })).toBeVisible();
    await expect(page.getByText("Reçu par e-mail", { exact: true })).toBeVisible();
    if (canUpload) {
      await page.getByRole("button", { name: "Déposer un document", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator('input[type="file"]').setInputFiles({
        name: "nouvelle-facture.png", mimeType: "image/png", buffer: Buffer.from("test"),
      });
      await dialog.getByRole("button", { name: "Ajouter au dossier", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText("nouvelle-facture.png", { exact: true })).toBeVisible();
      expect(state.uploads()).toBe(1);
    } else {
      await expect(page.getByRole("button", { name: "Déposer un document", exact: true })).toHaveCount(0);
    }
    expect(state.inboundRequests).toEqual([]);
  });
}
