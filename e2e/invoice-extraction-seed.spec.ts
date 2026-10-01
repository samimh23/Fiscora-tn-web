import { expect, test } from "@playwright/test";
import type {
  AccountingJournal,
  LedgerAccount,
  ThirdParty,
} from "../src/types/api";
import {
  calculateInvoiceDraftLines,
  invoiceSeedFromExtraction,
} from "../src/features/commercial/invoice-extraction-seed";

const seed = (data: Record<string, unknown>) =>
  invoiceSeedFromExtraction(data, "document", [], [], []);

const accountFixtures = [
  "604",
  "607",
  "705",
  "707",
  "4011",
  "411",
  "43666",
  "436711",
  "665",
].map((code) => ({
  id: code,
  code,
  name: code,
  dossierId: "dossier",
  description: null,
  type: code.startsWith("7") ? "Revenue" : "Expense",
  normalBalance: "Debit",
  parentAccountId: null,
  allowsPosting: true,
  isActive: true,
})) satisfies LedgerAccount[];
const journalFixtures = [
  { id: "AC", code: "AC", name: "Achats", type: "ACHATS", isActive: true },
  { id: "VT", code: "VT", name: "Ventes", type: "VENTES", isActive: true },
] satisfies AccountingJournal[];

for (const type of ["ACHAT", "VENTE"] as const) {
  test(`selects direction-specific party, journal, VAT and mixed line accounts: ${type}`, () => {
    const result = invoiceSeedFromExtraction(
      {
        supplier: { name: "Supplier", tax_id: "SUP" },
        customer: { name: "Customer", tax_id: "CLI" },
        invoice_nature: "MIXTE",
        line_items: [
          { item_nature: "SERVICES", unit_price: "100", quantity: "1" },
          { item_nature: "BIENS", unit_price: "200", quantity: "1" },
        ],
      },
      "document",
      [],
      accountFixtures,
      journalFixtures,
      type,
    );
    expect(result.type).toBe(type);
    expect(result.thirdPartyName).toBe(
      type === "VENTE" ? "Customer" : "Supplier",
    );
    expect(result.thirdPartyTaxIdentifier).toBe(
      type === "VENTE" ? "CLI" : "SUP",
    );
    expect(result.thirdPartyAccountId).toBe(type === "VENTE" ? "411" : "4011");
    expect(result.journalId).toBe(type === "VENTE" ? "VT" : "AC");
    expect(result.vatAccountId).toBe(type === "VENTE" ? "436711" : "43666");
    expect(result.lines.map((line) => line.accountId)).toEqual(
      type === "VENTE" ? ["705", "707"] : ["604", "607"],
    );
  });
}
test("uses invoice service nature when line nature is absent", () => {
  const result = invoiceSeedFromExtraction(
    { invoice_nature: "SERVICES", line_items: [{ unit_price: "100" }] },
    "document",
    [],
    accountFixtures,
    journalFixtures,
    "VENTE",
  );
  expect(result.lines[0].accountId).toBe("705");
  const headerOnly = invoiceSeedFromExtraction(
    { invoice_nature: "SERVICES", subtotal_excl_tax: "100" },
    "document",
    [],
    accountFixtures,
    journalFixtures,
    "VENTE",
  );
  expect(headerOnly.lines[0].accountId).toBe("705");
});
test("does not fall back to unrelated tax or liability accounts", () => {
  const result = invoiceSeedFromExtraction(
    {},
    "document",
    [],
    accountFixtures.filter((account) =>
      ["4011", "43666"].includes(account.code),
    ),
    journalFixtures,
    "VENTE",
  );
  expect(result.thirdPartyAccountId).toBeUndefined();
  expect(result.vatAccountId).toBeUndefined();
  expect(result.lines[0].accountId).toBe("");
});
test("matches only an active party of the appropriate type", () => {
  const party = {
    id: "supplier",
    name: "Same Name",
    taxIdentifier: "MF",
    type: "FOURNISSEUR",
    isActive: true,
  } as ThirdParty;
  const customer = {
    ...party,
    id: "customer",
    type: "CLIENT",
    receivableAccountId: "411",
  } as ThirdParty;
  const result = invoiceSeedFromExtraction(
    { customer: { name: "Same Name", tax_id: "MF" } },
    "doc",
    [party, customer],
    accountFixtures,
    journalFixtures,
    "VENTE",
  );
  expect(result.thirdPartyId).toBe("customer");
});

for (const nature of ["BIENS", "SERVICES", "MIXTE"]) {
  test(`prefills a valid AI nature suggestion: ${nature}`, () => {
    expect(seed({ invoice_nature: nature }).nature).toBe(nature);
  });
}

test("keeps manual selection for missing or uncertain AI nature", () => {
  for (const invoice_nature of [undefined, null, "INDETERMINE", "invalid"])
    expect(seed({ invoice_nature }).nature).toBeUndefined();
});

test("TOPNET preserves signed printed HT prices and flags the millime discrepancy", () => {
  const result = seed({
    document_number: "20261966543",
    issue_date: "2026-05-26",
    supplier: { name: "TOPNET" },
    subtotal_excl_tax: "55,434",
    tax_amount: "3,880",
    stamp_tax: "1,000",
    total_incl_tax: "60,314",
    line_items: [
      {
        description: "SMART FIBRE 20M",
        quantity: "1",
        unit_price: "-38,941",
        unit_price_basis: "HT",
        tax_rate: "7",
      },
      {
        description: "SMART FIBRE 50M Nv",
        quantity: "1",
        unit_price: "94,374",
        unit_price_basis: "HT",
        tax_rate: "7",
      },
    ],
  });
  expect(result.lines.map((line) => line.unitPrice)).toEqual([
    "-38.941",
    "94.374",
  ]);
  expect(result.lines.map((line) => line.discountRate)).toEqual([
    "0.00000",
    "0.00000",
  ]);
  expect(result.lines.map((line) => line.exciseRate)).toEqual(["", ""]);
  expect(result.nature).toBeUndefined();
  expect(calculateInvoiceDraftLines(result.lines)).toEqual({
    net: 55.433,
    vat: 3.88,
    excise: 0,
    fodec: 0,
  });
  expect(result.extractionNotice).toContain("55.433");
  expect(result.extractionNotice).toContain("55.434");
});

test("keeps HT prices even when the extracted header total is wrong", () => {
  const result = seed({
    subtotal_excl_tax: "1000",
    line_items: [
      {
        quantity: "2",
        unit_price: "10.500",
        unit_price_basis: "HT",
        tax_rate: "19",
      },
    ],
  });
  expect(result.lines[0].unitPrice).toBe("10.500");
  expect(result.extractionNotice).toContain("diffère");
});

test("converts explicitly TTC prices to HT without treating stamp as a discount", () => {
  const result = seed({
    gross_subtotal_excl_tax: "504,361",
    subtotal_excl_tax: "503,361",
    stamp_tax: "1,000",
    tax_amount: "95,639",
    total_incl_tax: "600,000",
    line_items: [
      {
        quantity: "1",
        unit_price: "599,000",
        unit_price_basis: "TTC",
        tax_rate: "19",
      },
    ],
  });
  expect(result.lines[0].unitPrice).toBe("503.361");
  expect(result.lines[0].discountRate).toBe("0.00000");
  expect(result.extractionNotice).toContain("convertis");
});

test("does not invent a VAT rate to convert a TTC price", () => {
  const result = seed({
    line_items: [{ quantity: "1", unit_price: "119", unit_price_basis: "TTC" }],
  });
  expect(result.lines[0].unitPrice).toBe("");
  expect(result.extractionNotice).toContain("sans son taux de TVA");
});

test("does not invent a zero price from a missing line total", () => {
  expect(seed({ line_items: [{ quantity: "1" }] }).lines[0].unitPrice).toBe("");
  expect(
    seed({
      line_items: [
        { quantity: "1", line_total: "119", line_total_basis: "TTC" },
      ],
    }).lines[0].unitPrice,
  ).toBe("");
});

test("only applies global discounts when explicitly extracted", () => {
  const result = seed({
    gross_subtotal_excl_tax: "100",
    subtotal_excl_tax: "90",
    global_discount_amount: "10",
    line_items: [
      {
        quantity: "1",
        unit_price: "100",
        unit_price_basis: "HT",
        tax_rate: "19",
        discount_rate: "0",
      },
    ],
  });
  expect(result.lines[0].unitPrice).toBe("100");
  expect(result.lines[0].discountRate).toBe("0.10000");
});

for (const suggestedNature of [undefined, "SERVICES", "INDETERMINE"]) {
  test(`AI invoice form confirms nature and preserves signed prices (${suggestedNature ?? "legacy"})`, async ({
    page,
  }) => {
    page.on("pageerror", (error) =>
      console.error("Invoice browser error:", error.message),
    );
    const user = {
      id: "user",
      fullName: "Test",
      email: "test@example.invalid",
      mfaEnabled: false,
    };
    const organizations = [
      {
        id: "org",
        name: "Cabinet test",
        slug: "test",
        role: "Administrateur",
        permissions: [
          "dossiers.view",
          "business_invoices.view",
          "business_invoices.manage",
          "third_parties.view",
          "accounting.view",
          "chart_of_accounts.view",
          "fiscal_settings.view",
        ],
      },
    ];
    const dossier = {
      id: "dossier",
      legalName: "Dossier test",
      status: "ACTIVE",
      legalForm: "SARL",
      isVatSubject: true,
      tags: [],
    };
    const data = {
      document_type: "invoice",
      invoice_nature: suggestedNature,
      document_number: "20261966543",
      issue_date: "2026-05-26",
      supplier: { name: "TOPNET" },
      customer: { name: "ATLAS" },
      subtotal_excl_tax: "55.434",
      tax_amount: "3.880",
      stamp_tax: "1.000",
      total_incl_tax: "60.314",
      amount_due: "60.314",
      line_items: [
        {
          description: "SMART FIBRE 20M",
          quantity: "1",
          unit_price: "-38.941",
          unit_price_basis: "HT",
          tax_rate: "7",
        },
        {
          description: "SMART FIBRE 50M Nv",
          quantity: "1",
          unit_price: "94.374",
          unit_price_basis: "HT",
          tax_rate: "7",
        },
      ],
    };
    const accounts = [
      "604",
      "607",
      "705",
      "411",
      "436711",
      "4011",
      "43666",
      "665",
    ].map((code) => ({
      id: code,
      code,
      name: code,
      isActive: true,
      allowsPosting: true,
      type: code === "4011" ? "Liability" : "Expense",
      normalBalance: "Debit",
    }));
    let invoiceBody: Record<string, unknown> | undefined;
    let reviewBody: Record<string, unknown> | undefined;
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
      else if (path.endsWith("/ledger-accounts")) body = accounts;
      else if (path.endsWith("/journals"))
        body = [
          {
            id: "journal",
            code: "AC",
            name: "Achats",
            type: "ACHATS",
            isActive: true,
          },
          {
            id: "sales-journal",
            code: "VT",
            name: "Ventes",
            type: "VENTES",
            isActive: true,
          },
        ];
      else if (path.endsWith("/third-parties"))
        body = [
          {
            id: "topnet",
            name: "TOPNET",
            type: "FOURNISSEUR",
            isActive: true,
            payableAccountId: "4011",
          },
          {
            id: "atlas",
            name: "ATLAS",
            type: "CLIENT",
            isActive: true,
            receivableAccountId: "411",
          },
        ];
      else if (path.endsWith("/extraction")) body = { normalizedData: data };
      else if (
        path.endsWith("/business-invoices") &&
        route.request().method() === "POST"
      ) {
        invoiceBody = route.request().postDataJSON();
        body = { ...invoiceBody, id: "invoice", status: "BROUILLON" };
      } else if (path.endsWith("/extraction/review")) {
        reviewBody = route.request().postDataJSON();
        body = {};
      } else if (path.endsWith("/work-sessions/active")) body = null;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await page.goto("/factures?dossierId=dossier&sourceDocumentId=document");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByLabel("PU HT", { exact: true }).nth(0),
    ).toHaveValue("-38.941");
    await expect(
      dialog.getByLabel("PU HT", { exact: true }).nth(1),
    ).toHaveValue("94.374");
    await expect(dialog.getByText(/La somme des lignes HT/)).toBeVisible();
    const save = dialog.getByRole("button", {
      name: "Enregistrer le brouillon",
    });
    if (suggestedNature === "SERVICES") {
      await expect(save).toBeEnabled();
      await expect(
        dialog.getByRole("combobox", { name: "Nature", exact: true }),
      ).toContainText("Services");
      await expect(
        dialog.getByText(/Proposition IA — vérifiez-la/),
      ).toBeVisible();
      // An AI suggestion remains editable, not a locked decision.
      await dialog
        .getByRole("combobox", { name: "Nature", exact: true })
        .click();
      await page.getByRole("option", { name: "Biens", exact: true }).click();
    } else {
      await expect(save).toBeDisabled();
    }
    await dialog.getByRole("combobox", { name: "Nature", exact: true }).click();
    await page.getByRole("option", { name: "Services", exact: true }).click();
    await expect(save).toBeEnabled();
    if (suggestedNature === "SERVICES") {
      await dialog.getByRole("combobox", { name: "Flux", exact: true }).click();
      await page.getByRole("option", { name: "Vente", exact: true }).click();
      await expect(
        dialog.getByRole("combobox", { name: "Compte tiers", exact: true }),
      ).toHaveValue(/411/);
      await expect(
        dialog.getByRole("combobox", { name: "Compte TVA", exact: true }),
      ).toHaveValue(/436711/);
      await expect(
        dialog.getByRole("combobox", { name: "Client", exact: true }),
      ).toHaveValue(/ATLAS/);
      await expect(
        dialog.getByLabel("PU HT", { exact: true }).nth(0),
      ).toHaveValue("-38.941");
      await dialog.getByRole("combobox", { name: "Flux", exact: true }).click();
      await page.getByRole("option", { name: "Achat", exact: true }).click();
      await expect(
        dialog.getByRole("combobox", { name: "Compte TVA", exact: true }),
      ).toHaveValue(/43666/);
    }
    await save.click();
    await expect(dialog).toBeHidden();
    expect(invoiceBody?.nature).toBe("SERVICES");
    expect(invoiceBody?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ unitPrice: "-38.941" }),
        expect.objectContaining({ unitPrice: "94.374" }),
      ]),
    );
    expect(reviewBody?.correctedData).toMatchObject({
      subtotal_excl_tax: "55.434",
      total_incl_tax: "60.314",
      amount_due: "60.314",
    });
  });
}
