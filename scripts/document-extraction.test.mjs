import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/features/operations/options.ts", import.meta.url),
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
const { documentCategories, supportsDocumentExtraction } =
  context.module.exports;

test("only invoice and bank categories enable extraction", () => {
  for (const category of documentCategories) {
    assert.equal(
      supportsDocumentExtraction(category.value),
      ["FACTURES_ACHATS", "FACTURES_VENTES", "RELEVES_BANCAIRES"].includes(
        category.value,
      ),
    );
  }
  assert.equal(supportsDocumentExtraction("UNKNOWN"), false);
});

test("upload and reread screens enforce category eligibility", () => {
  const panel = readFileSync(
    new URL(
      "../src/features/operations/DossierDocumentsPanel.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const review = readFileSync(
    new URL(
      "../src/features/operations/DocumentExtractionReviewDialog.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    panel,
    /scanIntent && !supportsDocumentExtraction\(uploadCategory\)/,
  );
  assert.match(panel, /supportsDocumentExtraction\(document.category\)/);
  assert.match(
    panel,
    /!scanIntent \|\| supportsDocumentExtraction\(item.value\)/,
  );
  assert.match(
    review,
    /!supportsDocumentExtraction\(reviewTarget.document.category\)/,
  );
});
