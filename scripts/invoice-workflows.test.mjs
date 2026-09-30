import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const source = readFileSync(
  new URL(
    "../src/features/commercial/invoice-extraction-seed.ts",
    import.meta.url,
  ),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const context = { module: { exports: {} }, exports: {} };
context.exports = context.module.exports;
vm.runInNewContext(code, context);
const { invoiceSeedFromExtraction, calculateInvoiceDraftLines } =
  context.module.exports;
const accounts = [
  {
    id: "goods",
    code: "607",
    name: "Achats",
    isActive: true,
    allowsPosting: true,
  },
  {
    id: "services",
    code: "604",
    name: "Services",
    isActive: true,
    allowsPosting: true,
  },
  {
    id: "fodec",
    code: "4371",
    name: "FODEC",
    isActive: true,
    allowsPosting: true,
  },
  {
    id: "excise",
    code: "43668",
    name: "Consommation",
    isActive: true,
    allowsPosting: true,
  },
];

test("AI FODEC keeps its own rate and account, never excise", () => {
  const seed = invoiceSeedFromExtraction(
    {
      subtotal_excl_tax: "100.000",
      fodec_amount: "1.000",
      tax_amount: "19.190",
      line_items: [
        {
          description: "Produit",
          quantity: "1",
          unit_price: "100.000",
          unit_price_basis: "HT",
          tax_rate: "19",
          item_nature: "BIENS",
        },
      ],
    },
    "doc",
    [],
    accounts,
    [],
  );
  assert.equal(seed.lines[0].fodecRate, "0.01000");
  assert.equal(seed.lines[0].exciseRate, "");
  assert.equal(seed.fodecAccountId, "fodec");
  const totals = calculateInvoiceDraftLines(seed.lines);
  assert.equal(totals.net, 100);
  assert.equal(totals.fodec, 1);
  assert.equal(totals.excise, 0);
  assert.equal(totals.vat, 19.19);
  assert.match(seed.extractionNotice, /Vérifiez les lignes/);
});
test("a mixed invoice proposes a service account for a service line", () => {
  const seed = invoiceSeedFromExtraction(
    {
      invoice_nature: "MIXTE",
      line_items: [
        {
          item_nature: "BIENS",
          unit_price: "10",
          quantity: "1",
          tax_rate: "19",
        },
        {
          item_nature: "SERVICES",
          unit_price: "20",
          quantity: "1",
          tax_rate: "19",
        },
      ],
    },
    "doc",
    [],
    accounts,
    [],
  );
  assert.equal(seed.nature, "MIXTE");
  assert.equal(seed.lines[0].accountId, "goods");
  assert.equal(seed.lines[1].accountId, "services");
});
test("draft calculation agrees with separate FODEC and excise VAT base", () => {
  const totals = calculateInvoiceDraftLines([
    {
      quantity: "1",
      unitPrice: "100",
      discountRate: "0",
      exciseRate: "0.1",
      fodecRate: "0.01",
      vatRate: "0.19",
    },
  ]);
  assert.equal(totals.net + totals.excise + totals.fodec + totals.vat, 132.09);
});
test("an absent dedicated FODEC account needs a human selection", () => {
  const seed = invoiceSeedFromExtraction(
    { subtotal_excl_tax: "100", fodec_amount: "1" },
    "doc",
    [],
    accounts.filter((a) => a.id !== "fodec"),
    [],
  );
  assert.equal(seed.fodecAccountId, undefined);
});
