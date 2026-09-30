import type {
  AccountingJournal,
  BusinessInvoiceLine,
  LedgerAccount,
  ThirdParty,
} from "../../types/api";

export type DraftLine = Pick<
  BusinessInvoiceLine,
  "accountId" | "description" | "quantity" | "unitPrice" | "discountRate"
> & {
  vatCode: string;
  vatRate: string;
  exciseRate: string;
  fodecRate?: string;
};
export interface InvoiceDraftSeed {
  sourceCommercialDocumentId?: string;
  sourceDocumentId?: string;
  type: "ACHAT" | "VENTE";
  nature?: "BIENS" | "SERVICES" | "MIXTE";
  number: string;
  invoiceDate: string;
  thirdPartyId: string;
  thirdPartyName?: string;
  thirdPartyTaxIdentifier?: string;
  currencyCode?: string;
  stampDuty?: string;
  journalId?: string;
  thirdPartyAccountId?: string;
  vatAccountId?: string;
  stampAccountId?: string;
  exciseAccountId?: string;
  fodecAccountId?: string;
  extractionData?: Record<string, unknown>;
  vatInferenceNotice?: string;
  extractionNotice?: string;
  notes: string;
  lines: DraftLine[];
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): DraftLine => ({
  accountId: "",
  description: "",
  quantity: "1.000",
  unitPrice: "",
  discountRate: "0.00000",
  vatCode: "",
  vatRate: "0.00000",
  exciseRate: "",
  fodecRate: "",
});

const recordValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const printedNumber = (value: unknown, fallback = ""): string => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).replace(/\s/g, "").replace(",", ".");
};

const normalizedRate = (value: unknown): string => {
  const raw = printedNumber(value).replace("%", "");
  const number = Number(raw);
  if (!Number.isFinite(number)) return "0.00000";
  return (number > 1 ? number / 100 : number).toFixed(5);
};

const extractedNumber = (value: unknown): number => {
  const printed = printedNumber(value);
  return printed ? Number(printed) : Number.NaN;
};

const hasExtractedValue = (value: unknown) =>
  value !== null && value !== undefined && String(value).trim() !== "";

const lineVatBase = (line: DraftLine) => {
  const quantity = Number(line.quantity) || 0;
  const unitPrice = Number(line.unitPrice) || 0;
  const discountRate = Number(line.discountRate) || 0;
  const exciseRate = Number(line.exciseRate) || 0;
  return (
    quantity *
    unitPrice *
    (1 - discountRate) *
    (1 + exciseRate + (Number(line.fodecRate) || 0))
  );
};

export function calculateInvoiceDraftLines(lines: DraftLine[]) {
  const round = (value: number) =>
    (Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 1000)) /
    1000;
  return lines.reduce(
    (total, line) => {
      const beforeDiscount = round(
        (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
      );
      const net = round(
        beforeDiscount -
          round(beforeDiscount * (Number(line.discountRate) || 0)),
      );
      const excise = round(net * (Number(line.exciseRate) || 0));
      const fodec = round(net * (Number(line.fodecRate) || 0));
      const vat = round((net + excise + fodec) * (Number(line.vatRate) || 0));
      return {
        net: round(total.net + net),
        excise: round(total.excise + excise),
        fodec: round(total.fodec + fodec),
        vat: round(total.vat + vat),
      };
    },
    { net: 0, excise: 0, fodec: 0, vat: 0 },
  );
}

export function invoiceSeedFromExtraction(
  data: Record<string, unknown>,
  documentId: string,
  parties: ThirdParty[],
  accounts: LedgerAccount[],
  journals: AccountingJournal[],
): InvoiceDraftSeed {
  const supplier = recordValue(data.supplier);
  const supplierName = String(supplier.name ?? "").trim();
  const supplierTaxId = String(supplier.tax_id ?? "").trim();
  const comparable = (value: string) =>
    value.toLocaleLowerCase("fr").replace(/[^a-z0-9]/g, "");
  const party = parties.find(
    (candidate) =>
      (supplierTaxId && candidate.taxIdentifier === supplierTaxId) ||
      (supplierName && comparable(candidate.name) === comparable(supplierName)),
  );
  const posting = accounts.filter(
    (account) => account.isActive && account.allowsPosting,
  );
  const account = (...codes: string[]) => {
    for (const code of codes) {
      const exact = posting.find((item) => item.code === code);
      if (exact) return exact;
    }
    for (const code of codes) {
      const child = posting.find((item) => item.code.startsWith(code));
      if (child) return child;
    }
    return undefined;
  };
  const purchaseAccount =
    account("607", "606", "604") ??
    posting.find((item) => item.type === "Expense");
  const supplierAccount =
    account("4011", "401") ??
    posting.find(
      (item) => item.type === "Liability" && item.normalBalance === "Credit",
    );
  const vatAccount =
    account("43666", "4366") ??
    posting.find(
      (item) => item.code.startsWith("436") && item.normalBalance === "Debit",
    );
  const stampAccount =
    account("665") ??
    posting.find(
      (item) => item.type === "Expense" && item.code.startsWith("66"),
    );
  const lineItems = Array.isArray(data.line_items)
    ? data.line_items.map(recordValue)
    : [];
  const declaredGrossSubtotal = extractedNumber(data.gross_subtotal_excl_tax);
  const declaredDiscountAmount = extractedNumber(data.global_discount_amount);
  const declaredDiscountRate =
    data.global_discount_rate == null
      ? Number.NaN
      : Number(normalizedRate(data.global_discount_rate));
  const declaredSubtotal = extractedNumber(data.subtotal_excl_tax);
  const tax = extractedNumber(data.tax_amount);
  const fodec = extractedNumber(data.fodec_amount);
  const stamp = extractedNumber(data.stamp_tax);
  const total = extractedNumber(data.total_incl_tax);
  const derivedSubtotal =
    Number.isFinite(total) && Number.isFinite(tax)
      ? total -
        tax -
        (Number.isFinite(fodec) ? fodec : 0) -
        (Number.isFinite(stamp) ? stamp : 0)
      : declaredSubtotal;
  const subtotalFromDiscount =
    Number.isFinite(declaredGrossSubtotal) &&
    Number.isFinite(declaredDiscountAmount)
      ? declaredGrossSubtotal - declaredDiscountAmount
      : Number.isFinite(declaredGrossSubtotal) &&
          Number.isFinite(declaredDiscountRate)
        ? declaredGrossSubtotal * (1 - declaredDiscountRate)
        : Number.NaN;
  const subtotal = Number.isFinite(declaredGrossSubtotal)
    ? Number.isFinite(declaredSubtotal)
      ? declaredSubtotal
      : Number.isFinite(subtotalFromDiscount)
        ? subtotalFromDiscount
        : derivedSubtotal
    : Number.isFinite(declaredSubtotal)
      ? declaredSubtotal
      : derivedSubtotal;
  const grossSubtotal = Number.isFinite(declaredGrossSubtotal)
    ? declaredGrossSubtotal
    : Number.isFinite(declaredDiscountAmount) && Number.isFinite(subtotal)
      ? subtotal + declaredDiscountAmount
      : subtotal;
  const discountAmount = Number.isFinite(declaredDiscountAmount)
    ? declaredDiscountAmount
    : 0;
  const globalDiscountRate =
    Number.isFinite(declaredDiscountRate) && declaredDiscountRate > 0
      ? declaredDiscountRate
      : Number.isFinite(grossSubtotal) && grossSubtotal > 0
        ? discountAmount / grossSubtotal
        : 0;
  const fodecRate =
    Number.isFinite(subtotal) && subtotal > 0 && Number.isFinite(fodec)
      ? (fodec / subtotal).toFixed(5)
      : "";
  const notices: string[] = [];
  if (Number.isFinite(fodec) && fodec !== 0)
    notices.push(
      "Le FODEC total a été réparti au prorata de la base HT. Vérifiez les lignes concernées et leur taux ; il ne s’agit pas d’un droit de consommation.",
    );
  const preparedLines: DraftLine[] = lineItems.length
    ? lineItems.map((line) => {
        const quantity = printedNumber(line.quantity, "1.000");
        const total = extractedNumber(line.line_total);
        const lineDiscountRate =
          1 -
          (1 - Number(normalizedRate(line.discount_rate ?? 0))) *
            (1 - globalDiscountRate);
        let unitPrice = printedNumber(line.unit_price);
        const basis = String(line.unit_price_basis ?? "HT").toUpperCase();
        const vatRate = normalizedRate(line.tax_rate);
        if (
          !unitPrice &&
          Number.isFinite(total) &&
          Number(quantity) &&
          Number(normalizedRate(line.discount_rate ?? 0)) < 1
        ) {
          const totalBasis = String(
            line.line_total_basis ?? "HT",
          ).toUpperCase();
          const factor =
            totalBasis === "TTC"
              ? (1 + Number(vatRate)) * (1 + (Number(fodecRate) || 0))
              : 1;
          if (totalBasis === "TTC" && !hasExtractedValue(line.tax_rate)) {
            notices.push(
              "Un montant de ligne TTC ne peut pas être converti en HT sans son taux de TVA. Renseignez le PU HT.",
            );
          } else {
            unitPrice = (
              total /
              Number(quantity) /
              factor /
              (1 - Number(normalizedRate(line.discount_rate ?? 0)))
            ).toFixed(3);
            notices.push(
              "Un prix unitaire absent a été calculé depuis le montant de ligne ; vérifiez-le.",
            );
          }
        } else if (basis === "TTC" && unitPrice) {
          if (!hasExtractedValue(line.tax_rate)) {
            unitPrice = "";
            notices.push(
              "Un prix TTC ne peut pas être converti en HT sans son taux de TVA. Renseignez le PU HT.",
            );
          } else {
            unitPrice = (
              Number(unitPrice) /
              (1 + Number(vatRate)) /
              (1 + (Number(fodecRate) || 0))
            ).toFixed(3);
            notices.push(
              "Les prix imprimés TTC ont été convertis en PU HT ; vérifiez les arrondis.",
            );
          }
        }
        return {
          accountId:
            (line.item_nature === "SERVICES"
              ? account("604", "606")
              : line.item_nature === "BIENS"
                ? account("607", "606")
                : purchaseAccount
            )?.id ?? "",
          description: String(line.description ?? "Article extrait par IA"),
          quantity,
          unitPrice,
          discountRate: Number.isFinite(lineDiscountRate)
            ? lineDiscountRate.toFixed(5)
            : "0.00000",
          vatCode: "",
          vatRate,
          exciseRate: "",
          fodecRate,
        };
      })
    : [
        {
          ...emptyLine(),
          accountId: purchaseAccount?.id ?? "",
          description: "Facture extraite par IA",
          unitPrice: Number.isFinite(grossSubtotal)
            ? grossSubtotal.toFixed(3)
            : printedNumber(data.subtotal_excl_tax),
          discountRate: Number.isFinite(globalDiscountRate)
            ? globalDiscountRate.toFixed(5)
            : "0.00000",
          vatRate: "0.00000",
          exciseRate: "",
          fodecRate,
        },
      ];

  const missingVatIndexes = preparedLines.flatMap((_, index) => {
    const sourceLine = lineItems[index];
    return !sourceLine || !hasExtractedValue(sourceLine.tax_rate)
      ? [index]
      : [];
  });
  const knownVat = preparedLines.reduce((sum, line, index) => {
    if (missingVatIndexes.includes(index)) return sum;
    return sum + lineVatBase(line) * (Number(line.vatRate) || 0);
  }, 0);
  const missingVatBase = missingVatIndexes.reduce(
    (sum, index) => sum + lineVatBase(preparedLines[index]),
    0,
  );
  const inferredVatRate =
    Number.isFinite(tax) && tax > knownVat && missingVatBase > 0
      ? (tax - knownVat) / missingVatBase
      : Number.NaN;
  const canInferVat =
    Number.isFinite(inferredVatRate) &&
    inferredVatRate > 0 &&
    inferredVatRate <= 1;
  const lines = preparedLines.map((line, index) =>
    canInferVat && missingVatIndexes.includes(index)
      ? { ...line, vatRate: inferredVatRate.toFixed(5) }
      : line,
  );
  const calculatedHt = calculateInvoiceDraftLines(lines).net;
  if (
    Number.isFinite(declaredSubtotal) &&
    Number.isFinite(calculatedHt) &&
    Math.abs(calculatedHt - declaredSubtotal) >= 0.0005
  ) {
    notices.push(
      `La somme des lignes HT (${calculatedHt.toFixed(3)}) diffère du total HT imprimé (${declaredSubtotal.toFixed(3)}). Les prix ont été conservés : vérifiez l’écart, sans modifier automatiquement les lignes.`,
    );
  }

  return {
    sourceDocumentId: documentId,
    type: "ACHAT",
    nature:
      data.invoice_nature === "BIENS" ||
      data.invoice_nature === "SERVICES" ||
      data.invoice_nature === "MIXTE"
        ? data.invoice_nature
        : undefined,
    number: String(data.document_number ?? ""),
    invoiceDate: String(data.issue_date ?? today()),
    thirdPartyId: party?.id ?? "",
    thirdPartyName: party?.name ?? supplierName,
    thirdPartyTaxIdentifier: party?.taxIdentifier ?? supplierTaxId,
    currencyCode: String(data.currency ?? "TND")
      .slice(0, 3)
      .toUpperCase(),
    stampDuty: printedNumber(data.stamp_tax),
    journalId: journals.find((journal) => journal.type === "ACHATS")?.id,
    thirdPartyAccountId: party?.payableAccountId ?? supplierAccount?.id,
    vatAccountId: vatAccount?.id,
    stampAccountId: stampAccount?.id,
    exciseAccountId: account("43668", "437")?.id,
    fodecAccountId: posting.find((item) => /FODEC/i.test(item.name))?.id,
    extractionData: data,
    extractionNotice: [...new Set(notices)].join(" ") || undefined,
    vatInferenceNotice: canInferVat
      ? `Le taux de TVA absent de ${missingVatIndexes.length === 1 ? "la ligne" : `${missingVatIndexes.length} lignes`} a été déduit du montant total de TVA (${(inferredVatRate * 100).toFixed(3)} %). Vérifiez ce taux avant d’enregistrer.`
      : undefined,
    notes: "Créée depuis une extraction IA — document source conservé.",
    lines,
  };
}
