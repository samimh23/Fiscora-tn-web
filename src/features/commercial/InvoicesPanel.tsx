import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  AutoAwesomeRounded,
  CheckCircleOutlineRounded,
  DeleteOutlineRounded,
  EditOutlined,
  PostAddRounded,
  ReceiptLongOutlined,
} from "@mui/icons-material";
import { api, ApiError, downloadApiFile } from "../../api/client";
import { SearchableSelect } from "../../components/SearchableSelect";
import type {
  AccountingJournal,
  AccountingDocument,
  BusinessInvoice,
  BusinessInvoiceLine,
  FiscalVatRate,
  FiscalWithholdingRate,
  LedgerAccount,
  ThirdParty,
  DocumentExtractionJob,
} from "../../types/api";
import {
  invoiceStatusLabels,
  money,
  settlementStatusLabels,
  shortDate,
} from "./options";

type DraftLine = Pick<
  BusinessInvoiceLine,
  "accountId" | "description" | "quantity" | "unitPrice" | "discountRate"
> & { vatCode: string; vatRate: string; exciseRate: string };
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
  extractionData?: Record<string, unknown>;
  notes: string;
  lines: DraftLine[];
}
type Form = {
  type: "ACHAT" | "VENTE";
  nature: "BIENS" | "SERVICES" | "MIXTE";
  kind: "FACTURE" | "AVOIR";
  number: string;
  invoiceDate: string;
  dueDate: string;
  thirdPartyId: string;
  thirdPartyName: string;
  thirdPartyTaxIdentifier: string;
  originalInvoiceId: string;
  journalId: string;
  thirdPartyAccountId: string;
  vatAccountId: string;
  stampAccountId: string;
  exciseAccountId: string;
  withholdingAccountId: string;
  vatSuspensionCertificateId: string;
  currencyCode: string;
  exchangeRate: string;
  stampDuty: string;
  withholdingNature: string;
  withholdingBase: string;
  sourceCommercialDocumentId: string;
  sourceDocumentId: string;
  notes: string;
  lines: DraftLine[];
};
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): DraftLine => ({
  accountId: "",
  description: "",
  quantity: "1.000",
  unitPrice: "",
  discountRate: "0.00000",
  vatCode: "",
  vatRate: "0.19000",
  exciseRate: "",
});
const emptyForm = (): Form => ({
  type: "VENTE",
  nature: "SERVICES",
  kind: "FACTURE",
  number: "",
  invoiceDate: today(),
  dueDate: "",
  thirdPartyId: "",
  thirdPartyName: "",
  thirdPartyTaxIdentifier: "",
  originalInvoiceId: "",
  journalId: "",
  thirdPartyAccountId: "",
  vatAccountId: "",
  stampAccountId: "",
  exciseAccountId: "",
  withholdingAccountId: "",
  vatSuspensionCertificateId: "",
  currencyCode: "TND",
  exchangeRate: "",
  stampDuty: "",
  withholdingNature: "",
  withholdingBase: "",
  sourceCommercialDocumentId: "",
  sourceDocumentId: "",
  notes: "",
  lines: [emptyLine()],
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

function invoiceSeedFromExtraction(
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
  const declaredSubtotal = Number(printedNumber(data.subtotal_excl_tax));
  const tax = Number(printedNumber(data.tax_amount));
  const fodec = Number(printedNumber(data.fodec_amount));
  const stamp = Number(printedNumber(data.stamp_tax));
  const total = Number(printedNumber(data.total_incl_tax));
  const components =
    (Number.isFinite(declaredSubtotal) ? declaredSubtotal : 0) +
    (Number.isFinite(tax) ? tax : 0) +
    (Number.isFinite(fodec) ? fodec : 0) +
    (Number.isFinite(stamp) ? stamp : 0);
  const derivedSubtotal =
    Number.isFinite(total) && Number.isFinite(tax)
      ? total - tax - (Number.isFinite(fodec) ? fodec : 0) -
        (Number.isFinite(stamp) ? stamp : 0)
      : declaredSubtotal;
  // Some Tunisian invoices label a stamp-inclusive amount as "Total HT" or
  // print line prices TTC. Prefer the arithmetically coherent net amount.
  const subtotal =
    Number.isFinite(total) && Math.abs(components - total) > 0.02
      ? derivedSubtotal
      : declaredSubtotal;
  const fodecRate =
    Number.isFinite(subtotal) && subtotal > 0 && Number.isFinite(fodec)
      ? (fodec / subtotal).toFixed(5)
      : "";
  const lineWeights = lineItems.map((line) => {
    const quantity = Number(printedNumber(line.quantity, "1")) || 1;
    const printedTotal = Number(printedNumber(line.line_total));
    const printedUnit = Number(printedNumber(line.unit_price));
    return Number.isFinite(printedTotal) && printedTotal > 0
      ? printedTotal
      : Number.isFinite(printedUnit)
        ? printedUnit * quantity
        : 0;
  });
  const totalWeight = lineWeights.reduce((sum, value) => sum + value, 0);
  const lines = lineItems.length
    ? lineItems.map((line, index) => {
        const quantity = printedNumber(line.quantity, "1.000");
        const total = Number(printedNumber(line.line_total));
        const allocatedNet =
          Number.isFinite(subtotal) && totalWeight > 0
            ? (subtotal * lineWeights[index]) / totalWeight
            : Number.NaN;
        const unitPrice = Number.isFinite(allocatedNet) && Number(quantity)
          ? (allocatedNet / Number(quantity)).toFixed(3)
          : printedNumber(
              line.unit_price,
              Number.isFinite(total) && Number(quantity)
                ? String(total / Number(quantity))
                : "",
            );
        return {
          accountId: purchaseAccount?.id ?? "",
          description: String(line.description ?? "Article extrait par IA"),
          quantity,
          unitPrice,
          discountRate: "0.00000",
          vatCode: "",
          vatRate: normalizedRate(line.tax_rate),
          exciseRate: fodecRate,
        };
      })
    : [
        {
          ...emptyLine(),
          accountId: purchaseAccount?.id ?? "",
          description: "Facture extraite par IA",
          unitPrice: Number.isFinite(subtotal)
            ? subtotal.toFixed(3)
            : printedNumber(data.subtotal_excl_tax),
        },
      ];

  return {
    sourceDocumentId: documentId,
    type: "ACHAT",
    nature: "BIENS",
    number: String(data.document_number ?? ""),
    invoiceDate: String(data.issue_date ?? today()),
    thirdPartyId: party?.id ?? "",
    thirdPartyName: party?.name ?? supplierName,
    thirdPartyTaxIdentifier: party?.taxIdentifier ?? supplierTaxId,
    currencyCode: String(data.currency ?? "TND").slice(0, 3).toUpperCase(),
    stampDuty: printedNumber(data.stamp_tax),
    journalId: journals.find((journal) => journal.type === "ACHATS")?.id,
    thirdPartyAccountId:
      party?.payableAccountId ?? supplierAccount?.id,
    vatAccountId: vatAccount?.id,
    stampAccountId: stampAccount?.id,
    exciseAccountId: account("43668", "437")?.id,
    extractionData: data,
    notes: "Créée depuis une extraction IA — document source conservé.",
    lines,
  };
}

function statusColor(
  status: BusinessInvoice["status"],
): "default" | "warning" | "primary" | "success" {
  if (status === "BROUILLON") return "warning";
  if (status === "VALIDEE") return "primary";
  if (status === "COMPTABILISEE") return "success";
  return "default";
}

function InvoiceDialog({
  open,
  onClose,
  organizationId,
  dossierId,
  invoice,
  draftSeed,
  invoices,
  parties,
  accounts,
  journals,
  vatRates,
  withholdingRates,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  dossierId: string;
  invoice: BusinessInvoice | null;
  draftSeed?: InvoiceDraftSeed | null;
  invoices: BusinessInvoice[];
  parties: ThirdParty[];
  accounts: LedgerAccount[];
  journals: AccountingJournal[];
  vatRates: FiscalVatRate[];
  withholdingRates: FiscalWithholdingRate[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() =>
    invoice
      ? {
          type: invoice.type,
          nature: invoice.nature ?? "MIXTE",
          kind: invoice.kind,
          number: invoice.number,
          invoiceDate: invoice.invoiceDate,
          dueDate: invoice.dueDate ?? "",
          thirdPartyId: invoice.thirdPartyId ?? "",
          thirdPartyName: invoice.thirdPartyName,
          thirdPartyTaxIdentifier: invoice.thirdPartyTaxIdentifier ?? "",
          originalInvoiceId: invoice.originalInvoiceId ?? "",
          journalId: invoice.journalId,
          thirdPartyAccountId: invoice.thirdPartyAccountId,
          vatAccountId: invoice.vatAccountId ?? "",
          stampAccountId: invoice.stampAccountId ?? "",
          exciseAccountId: invoice.exciseAccountId ?? "",
          withholdingAccountId: invoice.withholdingAccountId ?? "",
          vatSuspensionCertificateId: invoice.vatSuspensionCertificateId ?? "",
          currencyCode: invoice.currencyCode ?? "TND",
          exchangeRate:
            invoice.currencyCode && invoice.currencyCode !== "TND"
              ? invoice.exchangeRate
              : "",
          stampDuty: invoice.stampDuty,
          withholdingNature: "",
          withholdingBase: invoice.withholdingBase,
          sourceCommercialDocumentId: invoice.sourceCommercialDocumentId ?? "",
          sourceDocumentId: invoice.sourceDocumentId ?? "",
          notes: invoice.notes ?? "",
          lines: invoice.lines.map((line) => ({
            accountId: line.accountId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountRate: line.discountRate,
            vatCode: line.vatCode ?? "",
            vatRate: line.vatRate,
            exciseRate: line.exciseRate ?? "",
          })),
        }
      : draftSeed
        ? {
            ...emptyForm(),
            type: draftSeed.type,
            nature: draftSeed.nature ?? "MIXTE",
            number: draftSeed.number,
            invoiceDate: draftSeed.invoiceDate,
            dueDate: new Date(
              new Date(`${draftSeed.invoiceDate}T12:00:00`).getTime() +
                30 * 86400000,
            )
              .toISOString()
              .slice(0, 10),
            thirdPartyId: draftSeed.thirdPartyId,
            thirdPartyName: draftSeed.thirdPartyName ?? "",
            thirdPartyTaxIdentifier:
              draftSeed.thirdPartyTaxIdentifier ?? "",
            thirdPartyAccountId:
              draftSeed.thirdPartyAccountId ??
              parties.find((party) => party.id === draftSeed.thirdPartyId)?.[
                draftSeed.type === "VENTE"
                  ? "receivableAccountId"
                  : "payableAccountId"
              ] ??
              "",
            journalId:
              draftSeed.journalId ??
              journals.find(
                (journal) =>
                  journal.type ===
                  (draftSeed.type === "VENTE" ? "VENTES" : "ACHATS"),
              )?.id ?? "",
            sourceCommercialDocumentId:
              draftSeed.sourceCommercialDocumentId ?? "",
            sourceDocumentId: draftSeed.sourceDocumentId ?? "",
            currencyCode: draftSeed.currencyCode ?? "TND",
            stampDuty: draftSeed.stampDuty ?? "",
            vatAccountId: draftSeed.vatAccountId ?? "",
            stampAccountId: draftSeed.stampAccountId ?? "",
            exciseAccountId: draftSeed.exciseAccountId ?? "",
            notes: draftSeed.notes,
            lines: draftSeed.lines,
          }
        : emptyForm(),
  );
  const [error, setError] = useState("");
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const postingAccounts = accounts.filter(
    (account) => account.isActive && account.allowsPosting,
  );
  const availableParties = parties.filter(
    (party) =>
      party.type === "CLIENT_ET_FOURNISSEUR" ||
      (form.type === "VENTE"
        ? party.type === "CLIENT"
        : party.type === "FOURNISSEUR"),
  );
  const availableJournals = journals.filter(
    (journal) => journal.type === (form.type === "VENTE" ? "VENTES" : "ACHATS"),
  );
  const originals = invoices.filter(
    (item) =>
      item.type === form.type &&
      item.kind === "FACTURE" &&
      item.status === "COMPTABILISEE" &&
      Number(item.outstandingAmount) > 0,
  );
  const selectedParty = parties.find((party) => party.id === form.thirdPartyId);
  const applicableVatRates = vatRates.filter(
    (rate) =>
      rate.effectiveFrom <= form.invoiceDate &&
      (!rate.effectiveTo || rate.effectiveTo >= form.invoiceDate),
  );
  const applicableWithholdingRates = withholdingRates.filter(
    (rate) =>
      rate.effectiveFrom <= form.invoiceDate &&
      (!rate.effectiveTo || rate.effectiveTo >= form.invoiceDate),
  );
  const { data: vatSuspensionCertificates = [] } = useQuery({
    queryKey: ["vat-suspension-certificates", organizationId, dossierId],
    queryFn: () =>
      api.get<
        Array<{
          id: string;
          number: string;
          currentStatus: string;
          remainingBase: string;
        }>
      >(
        `/api/organizations/${organizationId}/foreign-trade/dossiers/${dossierId}/certificates`,
      ),
    enabled: form.type === "ACHAT",
  });
  const calculation = useMemo(
    () =>
      form.lines.reduce(
        (total, line) => {
          const quantity = Number(line.quantity) || 0;
          const price = Number(line.unitPrice) || 0;
          const discount = Number(line.discountRate) || 0;
          const net = quantity * price * (1 - discount);
          const excise = net * (Number(line.exciseRate) || 0);
          const vat = (net + excise) * (Number(line.vatRate) || 0);
          return {
            net: total.net + net,
            excise: total.excise + excise,
            vat: total.vat + vat,
          };
        },
        { net: 0, excise: 0, vat: 0 },
      ),
    [form.lines],
  );
  const changeType = (type: Form["type"]) =>
    setForm((current) => ({
      ...current,
      type,
      thirdPartyId: "",
      thirdPartyName: "",
      thirdPartyTaxIdentifier: "",
      originalInvoiceId: "",
      journalId: "",
      thirdPartyAccountId: "",
    }));
  const selectParty = (id: string) => {
    const party = parties.find((entry) => entry.id === id);
    setForm((current) => ({
      ...current,
      thirdPartyId: id,
      thirdPartyName: party?.name ?? "",
      thirdPartyTaxIdentifier: party?.taxIdentifier ?? "",
      thirdPartyAccountId: party
        ? ((current.type === "VENTE"
            ? party.receivableAccountId
            : party.payableAccountId) ?? "")
        : "",
    }));
  };
  const updateLine = (index: number, key: keyof DraftLine, value: string) =>
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, position) =>
        position === index ? { ...line, [key]: value } : line,
      ),
    }));
  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedParty && !form.thirdPartyName.trim())
        throw new Error("Renseignez le client ou fournisseur.");
      const body = {
        type: form.type,
        nature: form.nature,
        kind: form.kind,
        number: form.number.trim(),
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        thirdPartyId: form.thirdPartyId || undefined,
        originalInvoiceId:
          form.kind === "AVOIR"
            ? form.originalInvoiceId || undefined
            : undefined,
        thirdPartyName: selectedParty?.name ?? form.thirdPartyName.trim(),
        thirdPartyTaxIdentifier:
          selectedParty?.taxIdentifier ||
          form.thirdPartyTaxIdentifier.trim() ||
          undefined,
        journalId: form.journalId,
        thirdPartyAccountId: form.thirdPartyAccountId,
        vatAccountId: form.vatAccountId || undefined,
        stampAccountId: form.stampAccountId || undefined,
        exciseAccountId: form.exciseAccountId || undefined,
        withholdingAccountId: form.withholdingAccountId || undefined,
        vatSuspensionCertificateId:
          form.type === "ACHAT"
            ? form.vatSuspensionCertificateId || undefined
            : undefined,
        currencyCode:
          form.currencyCode !== "TND" ? form.currencyCode : undefined,
        exchangeRate:
          form.currencyCode !== "TND"
            ? form.exchangeRate || undefined
            : undefined,
        stampDuty: form.stampDuty || undefined,
        withholdingNature: form.withholdingNature.trim() || undefined,
        withholdingBase: form.withholdingBase || undefined,
        sourceCommercialDocumentId:
          form.sourceCommercialDocumentId || undefined,
        sourceDocumentId: form.sourceDocumentId || undefined,
        notes: form.notes.trim() || undefined,
        lines: form.lines.map((line) => ({
          accountId: line.accountId,
          description: line.description.trim(),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountRate: line.discountRate,
          vatCode: line.vatCode || undefined,
          vatRate: line.vatCode ? undefined : line.vatRate || undefined,
          exciseRate: line.exciseRate || undefined,
        })),
      };
      const base = `/api/organizations/${organizationId}/dossiers/${dossierId}/business-invoices`;
      const saved = invoice
        ? await api.put<BusinessInvoice>(`${base}/${invoice.id}`, body)
        : await api.post<BusinessInvoice>(base, body);
      if (
        !invoice &&
        form.sourceDocumentId &&
        draftSeed?.extractionData
      ) {
        const stamp = Number(form.stampDuty) || 0;
        const correctedData = {
          ...draftSeed.extractionData,
          document_type:
            form.kind === "AVOIR" ? "credit_note" : "invoice",
          supplier: {
            ...recordValue(draftSeed.extractionData.supplier),
            name: selectedParty?.name ?? form.thirdPartyName.trim(),
            tax_id:
              selectedParty?.taxIdentifier ||
              form.thirdPartyTaxIdentifier.trim() ||
              null,
          },
          document_number: form.number.trim(),
          issue_date: form.invoiceDate,
          currency: form.currencyCode,
          subtotal_excl_tax: calculation.net.toFixed(3),
          tax_amount: calculation.vat.toFixed(3),
          fodec_amount: calculation.excise.toFixed(3),
          stamp_tax: stamp.toFixed(3),
          other_taxes: [],
          total_incl_tax: (
            calculation.net +
            calculation.excise +
            calculation.vat +
            stamp
          ).toFixed(3),
          amount_due: (
            calculation.net +
            calculation.excise +
            calculation.vat +
            stamp
          ).toFixed(3),
          line_items: form.lines.map((line) => ({
            description: line.description.trim(),
            quantity: line.quantity,
            unit_price: line.unitPrice,
            tax_rate: line.vatRate,
            line_total: (
              (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)
            ).toFixed(3),
          })),
        };
        await api
          .patch(
            `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${form.sourceDocumentId}/extraction/review`,
            {
              decision: "APPROUVER",
              correctedData,
              comment:
                "Extraction approuvée lors de la création de la facture métier",
            },
          )
          // The business invoice is already safely created at this point. If
          // classification refresh fails, keep the invoice and leave the
          // source document visible in Collecte for a later review.
          .catch(() => undefined);
      }
      return saved;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["business-invoices", organizationId, dossierId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dossier-documents", organizationId, dossierId],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "document-extraction-reviews",
            organizationId,
            dossierId,
          ],
        }),
      ]);
      onClose();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : reason instanceof Error
            ? reason.message
            : "Impossible d’enregistrer la facture.",
      ),
  });
  const valid = Boolean(
    form.number.trim() &&
    form.invoiceDate &&
    (form.thirdPartyId || form.thirdPartyName.trim()) &&
    form.journalId &&
    form.thirdPartyAccountId &&
    form.lines.length &&
    form.lines.every(
      (line) => line.accountId && line.description.trim() && line.unitPrice,
    ) &&
    (form.currencyCode === "TND" || form.exchangeRate),
  );

  return (
    <Dialog
      open={open}
      onClose={mutation.isPending ? undefined : onClose}
      fullWidth
      maxWidth="lg"
    >
      <DialogTitle>
        {invoice ? `Modifier ${invoice.number}` : "Nouvelle facture ou avoir"}
      </DialogTitle>
      <DialogContent sx={{ pt: "12px !important" }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {form.sourceDocumentId && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Données préremplies par l’IA. « Enregistrer le brouillon » créera
            une vraie facture métier liée à la pièce originale ; vérifiez les
            comptes proposés avant de continuer.
          </Alert>
        )}
        {form.vatSuspensionCertificateId && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Mention légale obligatoire sur la facture fournisseur : « Achat en
            suspension de TVA — attestation n°{" "}
            {
              vatSuspensionCertificates.find(
                (item) => item.id === form.vatSuspensionCertificateId,
              )?.number
            }{" "}
            »
          </Alert>
        )}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(4, 1fr)",
            },
            gap: 2,
          }}
        >
          <TextField
            select
            label="Flux"
            value={form.type}
            onChange={(event) => changeType(event.target.value as Form["type"])}
          >
            <MenuItem value="VENTE">Vente</MenuItem>
            <MenuItem value="ACHAT">Achat</MenuItem>
          </TextField>
          <TextField
            select
            label="Nature"
            value={form.nature}
            onChange={(event) =>
              set("nature", event.target.value as Form["nature"])
            }
            helperText={
              form.type === "VENTE" &&
              form.invoiceDate >= "2026-01-01" &&
              form.nature !== "BIENS"
                ? "Services inclus dans le champ e-facture depuis 2026 (art. 53)"
                : "Détermine les contrôles fiscaux et TTN"
            }
          >
            <MenuItem value="BIENS">Biens</MenuItem>
            <MenuItem value="SERVICES">Services</MenuItem>
            <MenuItem value="MIXTE">Biens et services</MenuItem>
          </TextField>
          <TextField
            select
            label="Document"
            value={form.kind}
            onChange={(event) =>
              set("kind", event.target.value as Form["kind"])
            }
          >
            <MenuItem value="FACTURE">Facture</MenuItem>
            <MenuItem value="AVOIR">Avoir</MenuItem>
          </TextField>
          <TextField
            label="Numéro"
            value={form.number}
            onChange={(event) => set("number", event.target.value)}
            required
          />
          <TextField
            label="Date"
            type="date"
            value={form.invoiceDate}
            onChange={(event) => set("invoiceDate", event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            required
          />
          <TextField
            label="Échéance"
            type="date"
            value={form.dueDate}
            onChange={(event) => set("dueDate", event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <SearchableSelect
            label={form.type === "VENTE" ? "Client" : "Fournisseur"}
            value={form.thirdPartyId}
            onChange={selectParty}
            options={availableParties.map((party) => ({
              value: party.id,
              label: party.name,
            }))}
            helperText={
              form.thirdPartyId
                ? "Tiers existant lié à la facture"
                : "Optionnel : choisissez un tiers existant ou saisissez son nom"
            }
          />
          {!form.thirdPartyId && (
            <TextField
              label={form.type === "VENTE" ? "Nom du client" : "Nom du fournisseur"}
              value={form.thirdPartyName}
              onChange={(event) => set("thirdPartyName", event.target.value)}
              required
            />
          )}
          {!form.thirdPartyId && (
            <TextField
              label="Matricule fiscal du tiers"
              value={form.thirdPartyTaxIdentifier}
              onChange={(event) =>
                set("thirdPartyTaxIdentifier", event.target.value)
              }
            />
          )}
          <SearchableSelect
            label="Journal"
            value={form.journalId}
            onChange={(value) => set("journalId", value)}
            options={availableJournals.map((journal) => ({
              value: journal.id,
              label: `${journal.code} — ${journal.name}`,
            }))}
            required
          />
          <SearchableSelect
            label="Compte tiers"
            value={form.thirdPartyAccountId}
            onChange={(value) => set("thirdPartyAccountId", value)}
            options={postingAccounts.map((account) => ({
              value: account.id,
              label: `${account.code} — ${account.name}`,
            }))}
            required
          />
          {form.kind === "AVOIR" && (
            <SearchableSelect
              label="Facture d’origine"
              value={form.originalInvoiceId}
              onChange={(value) => set("originalInvoiceId", value)}
              options={originals.map((item) => ({
                value: item.id,
                label: `${item.number} — ${item.thirdPartyName} — solde ${money(item.outstandingAmount)}`,
              }))}
              required
              sx={{ gridColumn: { md: "span 2" } }}
            />
          )}
        </Box>

        <Divider sx={{ my: 3 }}>
          <Chip label="Lignes comptables" />
        </Divider>
        <Stack spacing={1.5}>
          {form.lines.map((line, index) => (
            <Card key={index} variant="outlined" sx={{ p: 2 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "2fr 2fr .8fr 1fr 1fr 1fr .8fr auto",
                  },
                  gap: 1.5,
                  alignItems: "center",
                }}
              >
                <SearchableSelect
                  size="small"
                  label="Compte"
                  value={line.accountId}
                  onChange={(value) => updateLine(index, "accountId", value)}
                  options={postingAccounts.map((account) => ({
                    value: account.id,
                    label: `${account.code} — ${account.name}`,
                  }))}
                />
                <TextField
                  size="small"
                  label="Description"
                  value={line.description}
                  onChange={(event) =>
                    updateLine(index, "description", event.target.value)
                  }
                />
                <TextField
                  size="small"
                  label="Qté"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(index, "quantity", event.target.value)
                  }
                />
                <TextField
                  size="small"
                  label="PU HT"
                  value={line.unitPrice}
                  onChange={(event) =>
                    updateLine(index, "unitPrice", event.target.value)
                  }
                />
                <TextField
                  select
                  size="small"
                  label="Remise"
                  value={line.discountRate}
                  onChange={(event) =>
                    updateLine(index, "discountRate", event.target.value)
                  }
                >
                  <MenuItem value="0.00000">0 %</MenuItem>
                  <MenuItem value="0.05000">5 %</MenuItem>
                  <MenuItem value="0.10000">10 %</MenuItem>
                </TextField>
                <TextField
                  select
                  size="small"
                  label="TVA"
                  value={line.vatCode || `manual:${line.vatRate}`}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value.startsWith("manual:")) {
                      updateLine(index, "vatCode", "");
                      updateLine(index, "vatRate", value.slice(7));
                    } else {
                      const configured = applicableVatRates.find(
                        (rate) => rate.code === value,
                      );
                      updateLine(index, "vatCode", value);
                      if (configured)
                        updateLine(index, "vatRate", configured.rate);
                    }
                  }}
                >
                  <MenuItem value="manual:0.00000">Exonéré / 0 %</MenuItem>
                  {applicableVatRates.map((rate) => (
                    <MenuItem key={rate.id} value={rate.code}>
                      {rate.label} — {(Number(rate.rate) * 100).toFixed(0)} %
                    </MenuItem>
                  ))}
                  <MenuItem value="manual:0.07000">7 % (manuel)</MenuItem>
                  <MenuItem value="manual:0.13000">13 % (manuel)</MenuItem>
                  <MenuItem value="manual:0.19000">19 % (manuel)</MenuItem>
                </TextField>
                <TextField
                  size="small"
                  label="Droit conso."
                  value={line.exciseRate}
                  onChange={(event) =>
                    updateLine(index, "exciseRate", event.target.value)
                  }
                  helperText="Taux, ex. 0.10"
                />
                <Tooltip title="Supprimer la ligne">
                  <span>
                    <IconButton
                      color="error"
                      disabled={form.lines.length === 1}
                      onClick={() =>
                        set(
                          "lines",
                          form.lines.filter(
                            (_, position) => position !== index,
                          ),
                        )
                      }
                    >
                      <DeleteOutlineRounded />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </Card>
          ))}
        </Stack>
        <Button
          startIcon={<AddRounded />}
          sx={{ mt: 1 }}
          onClick={() => set("lines", [...form.lines, emptyLine()])}
        >
          Ajouter une ligne
        </Button>

        <Divider sx={{ my: 3 }}>
          <Chip label="Devise" />
        </Divider>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
            gap: 2,
          }}
        >
          <TextField
            select
            label="Devise de la facture"
            value={form.currencyCode}
            onChange={(event) => set("currencyCode", event.target.value)}
            helperText="Les lignes sont saisies dans cette devise puis converties en TND"
          >
            <MenuItem value="TND">TND</MenuItem>
            <MenuItem value="EUR">EUR</MenuItem>
            <MenuItem value="USD">USD</MenuItem>
            <MenuItem value="GBP">GBP</MenuItem>
          </TextField>
          {form.currencyCode !== "TND" && (
            <TextField
              label={`1 ${form.currencyCode} = ? TND`}
              value={form.exchangeRate}
              onChange={(event) => set("exchangeRate", event.target.value)}
              helperText="Taux de change appliqué à toute la facture"
            />
          )}
        </Box>

        <Divider sx={{ my: 3 }}>
          <Chip label="Taxes et retenue" />
        </Divider>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(4, 1fr)",
            },
            gap: 2,
          }}
        >
          <SearchableSelect
            label="Compte TVA"
            value={form.vatAccountId}
            onChange={(value) => set("vatAccountId", value)}
            options={postingAccounts.map((account) => ({
              value: account.id,
              label: `${account.code} — ${account.name}`,
            }))}
          />
          <SearchableSelect
            label="Compte timbre"
            value={form.stampAccountId}
            onChange={(value) => set("stampAccountId", value)}
            options={postingAccounts.map((account) => ({
              value: account.id,
              label: `${account.code} — ${account.name}`,
            }))}
          />
          <TextField
            label="Timbre manuel (TND)"
            value={form.stampDuty}
            onChange={(event) => set("stampDuty", event.target.value)}
            helperText="Vide = taux officiel configuré"
          />
          <SearchableSelect
            label="Compte droit de consommation"
            value={form.exciseAccountId}
            onChange={(value) => set("exciseAccountId", value)}
            options={postingAccounts.map((account) => ({
              value: account.id,
              label: `${account.code} — ${account.name}`,
            }))}
            helperText="Requis si un taux est saisi sur une ligne"
          />
          <TextField
            select
            label="Nature de retenue"
            value={form.withholdingNature}
            onChange={(event) => set("withholdingNature", event.target.value)}
            helperText="Taux officiel applicable à la date"
          >
            <MenuItem value="">Aucune retenue</MenuItem>
            {applicableWithholdingRates.map((rate) => (
              <MenuItem key={rate.id} value={rate.natureCode}>
                {rate.label} —{" "}
                {(Number(rate.rate) * 100).toLocaleString("fr-TN")} %
              </MenuItem>
            ))}
          </TextField>
          {form.withholdingNature && (
            <>
              <TextField
                label="Base de retenue"
                value={form.withholdingBase}
                onChange={(event) => set("withholdingBase", event.target.value)}
                helperText="Vide = total HT"
              />
              <SearchableSelect
                label="Compte retenue"
                value={form.withholdingAccountId}
                onChange={(value) => set("withholdingAccountId", value)}
                options={postingAccounts.map((account) => ({
                  value: account.id,
                  label: `${account.code} — ${account.name}`,
                }))}
              />
            </>
          )}
          {form.type === "ACHAT" && (
            <SearchableSelect
              label="Attestation de suspension de TVA"
              value={form.vatSuspensionCertificateId}
              onChange={(value) => set("vatSuspensionCertificateId", value)}
              options={vatSuspensionCertificates
                .filter((item) => item.currentStatus === "ACTIVE")
                .map((item) => ({
                  value: item.id,
                  label: `${item.number} — restant ${item.remainingBase} TND`,
                }))}
              helperText="Achat effectué sans TVA au titre d’une attestation détenue par le dossier"
            />
          )}
          <TextField
            label="Notes"
            multiline
            minRows={2}
            value={form.notes}
            onChange={(event) => set("notes", event.target.value)}
            sx={{ gridColumn: { sm: "span 2" } }}
          />
        </Box>
        <Card
          variant="outlined"
          sx={{ mt: 3, p: 2.5, bgcolor: "primary.light" }}
        >
          <Stack
            direction="row"
            spacing={4}
            useFlexGap
            sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}
          >
            <Box>
              <Typography variant="caption">Total HT estimé</Typography>
              <Typography sx={{ fontWeight: 700 }}>
                {money(calculation.net)}
              </Typography>
            </Box>
            {calculation.excise > 0 && (
              <Box>
                <Typography variant="caption">Droit de consommation</Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  {money(calculation.excise)}
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption">TVA estimée</Typography>
              <Typography sx={{ fontWeight: 700 }}>
                {money(calculation.vat)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">TTC estimé hors timbre</Typography>
              <Typography sx={{ fontWeight: 700, color: "primary.dark" }}>
                {money(calculation.net + calculation.excise + calculation.vat)}
              </Typography>
            </Box>
          </Stack>
          {form.currencyCode !== "TND" && form.exchangeRate && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", textAlign: "right", mt: 1 }}
            >
              Montants convertis en TND au taux 1 {form.currencyCode} ={" "}
              {form.exchangeRate} TND — les lignes ont été saisies en{" "}
              {form.currencyCode}.
            </Typography>
          )}
        </Card>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          disabled={
            !valid ||
            mutation.isPending ||
            (form.kind === "AVOIR" && !form.originalInvoiceId)
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Enregistrement…" : "Enregistrer le brouillon"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function InvoicesPanel({
  organizationId,
  dossierId,
  invoices,
  parties,
  accounts,
  journals,
  vatRates,
  withholdingRates,
  loading,
  archived,
  canManage,
  canScan,
  canValidate,
  canPost,
  draftSeed,
  onDraftSeedConsumed,
}: {
  organizationId: string;
  dossierId: string;
  invoices: BusinessInvoice[];
  parties: ThirdParty[];
  accounts: LedgerAccount[];
  journals: AccountingJournal[];
  vatRates: FiscalVatRate[];
  withholdingRates: FiscalWithholdingRate[];
  loading: boolean;
  archived: boolean;
  canManage: boolean;
  canScan: boolean;
  canValidate: boolean;
  canPost: boolean;
  draftSeed?: InvoiceDraftSeed | null;
  onDraftSeedConsumed?: () => void;
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<BusinessInvoice | null>(null);
  const [aiDraftSeed, setAiDraftSeed] = useState<InvoiceDraftSeed | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanDocument, setScanDocument] = useState<AccountingDocument | null>(
    null,
  );
  const [scanError, setScanError] = useState("");
  const [filter, setFilter] = useState("TOUTES");
  const [error, setError] = useState("");
  const [matchingInvoice, setMatchingInvoice] =
    useState<BusinessInvoice | null>(null);
  const matchResult = useQuery({
    queryKey: ["invoice-match", organizationId, dossierId, matchingInvoice?.id],
    queryFn: () =>
      api.get<{
        receiptNumber: string;
        invoiceNumber: string;
        hasDiscrepancies: boolean;
        lines: Array<{
          accountCode: string;
          description: string;
          receiptQuantity: string;
          invoiceQuantity: string;
          receiptUnitPrice: string;
          invoiceUnitPrice: string;
          status:
            | "OK"
            | "ECART_QUANTITE"
            | "ECART_PRIX"
            | "ABSENT_FACTURE"
            | "ABSENT_RECEPTION";
        }>;
      }>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/business-invoices/${matchingInvoice?.id}/match`,
      ),
    enabled: Boolean(matchingInvoice),
  });
  const matchStatusLabels: Record<string, string> = {
    OK: "Conforme",
    ECART_QUANTITE: "Écart de quantité",
    ECART_PRIX: "Écart de prix",
    ABSENT_FACTURE: "Absent de la facture",
    ABSENT_RECEPTION: "Absent du bon de réception",
  };
  useEffect(() => {
    if (!draftSeed) return;
    setSelected(null);
    setDialogOpen(true);
  }, [draftSeed]);
  const activeDraftSeed = aiDraftSeed ?? draftSeed ?? null;
  const closeDialog = () => {
    setDialogOpen(false);
    if (aiDraftSeed) setAiDraftSeed(null);
    else onDraftSeedConsumed?.();
  };
  const filtered = invoices.filter(
    (invoice) => filter === "TOUTES" || invoice.type === filter,
  );
  const action = useMutation({
    mutationFn: ({
      type,
      invoice,
    }: {
      type: "validate" | "post";
      invoice: BusinessInvoice;
    }) =>
      api.post<BusinessInvoice>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/business-invoices/${invoice.id}/${type}`,
      ),
    onSuccess: async () => {
      setError("");
      await queryClient.invalidateQueries({
        queryKey: ["business-invoices", organizationId, dossierId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["third-parties", organizationId, dossierId],
      });
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError ? reason.message : "Action impossible.",
      ),
  });
  const scanJob = useQuery({
    queryKey: [
      "invoice-ai-extraction",
      organizationId,
      dossierId,
      scanDocument?.id,
    ],
    queryFn: () =>
      api.get<DocumentExtractionJob>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${scanDocument!.id}/extraction`,
      ),
    enabled: Boolean(scanDocument),
    refetchInterval: (query) =>
      ["EN_ATTENTE", "EN_COURS"].includes(query.state.data?.status ?? "")
        ? 2500
        : false,
    retry: false,
  });
  const uploadForExtraction = useMutation({
    mutationFn: async () => {
      if (!scanFile) throw new Error("Choisissez une image ou un PDF.");
      if (scanFile.size > 20 * 1024 * 1024)
        throw new Error("Le fichier ne doit pas dépasser 20 Mo.");
      const data = new FormData();
      data.append("file", scanFile);
      data.append("category", "FACTURES_ACHATS");
      data.append("periodYear", String(new Date().getFullYear()));
      data.append("periodMonth", String(new Date().getMonth() + 1));
      data.append("isClientVisible", "false");
      const document = await api.upload<AccountingDocument>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents`,
        data,
      );
      await api.post(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${document.id}/extraction`,
      );
      return document;
    },
    onSuccess: (document) => {
      setScanError("");
      setScanDocument(document);
    },
    onError: (reason) =>
      setScanError(
        reason instanceof ApiError || reason instanceof Error
          ? reason.message
          : "Impossible de lancer la lecture IA.",
      ),
  });
  const prepareAiInvoice = useMutation({
    mutationFn: async () => {
      if (!scanDocument || !scanJob.data?.normalizedData)
        throw new Error("Les données extraites ne sont pas disponibles.");
      if (
        !["invoice", "credit_note", "receipt"].includes(
          String(scanJob.data.normalizedData.document_type),
        )
      )
        throw new Error("Le document détecté n’est pas une facture.");
      return invoiceSeedFromExtraction(
        scanJob.data.normalizedData,
        scanDocument.id,
        parties,
        accounts,
        journals,
      );
    },
    onSuccess: (seed) => {
      setScanOpen(false);
      setScanFile(null);
      setScanDocument(null);
      setSelected(null);
      setAiDraftSeed(seed);
      setDialogOpen(true);
    },
    onError: (reason) =>
      setScanError(
        reason instanceof ApiError || reason instanceof Error
          ? reason.message
          : "Impossible de préparer la facture.",
      ),
  });
  const closeScan = () => {
    if (uploadForExtraction.isPending || prepareAiInvoice.isPending) return;
    setScanOpen(false);
    setScanFile(null);
    setScanDocument(null);
    setScanError("");
  };

  return (
    <>
      <Card>
        <Box
          sx={{
            p: 2.5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box>
            <Typography variant="h3">Factures d’achat et de vente</Typography>
            <Typography variant="body2" color="text.secondary">
              TVA, retenues, validation et génération automatique des écritures.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <TextField
              select
              size="small"
              label="Flux"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="TOUTES">Toutes</MenuItem>
              <MenuItem value="VENTE">Ventes</MenuItem>
              <MenuItem value="ACHAT">Achats</MenuItem>
            </TextField>
            {canManage && !archived && (
              <>
                {canScan && (
                  <Button
                    variant="outlined"
                    startIcon={<AutoAwesomeRounded />}
                    onClick={() => setScanOpen(true)}
                  >
                    Scanner par IA
                  </Button>
                )}
                <Button
                  variant="contained"
                  startIcon={<AddRounded />}
                  onClick={() => {
                    setSelected(null);
                    setDialogOpen(true);
                  }}
                >
                  Nouvelle facture
                </Button>
              </>
            )}
          </Stack>
        </Box>
        {error && (
          <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading && (
          <Box sx={{ p: 2.5 }}>
            <Skeleton height={90} />
            <Skeleton height={90} />
          </Box>
        )}
        {!loading && filtered.length === 0 && (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <ReceiptLongOutlined
              sx={{ fontSize: 46, color: "text.disabled" }}
            />
            <Typography sx={{ fontWeight: 700, mt: 1 }}>
              Aucune facture
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Créez la première facture d’achat ou de vente de ce dossier.
            </Typography>
          </Box>
        )}
        {filtered.map((invoice) => (
          <Box
            key={invoice.id}
            sx={{
              px: 3,
              py: 2.2,
              borderTop: "1px solid",
              borderColor: "divider",
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(250px, 1fr) 125px 150px 155px auto",
              },
              gap: 2,
              alignItems: "center",
            }}
          >
            <Box>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", flexWrap: "wrap" }}
              >
                <Typography sx={{ fontWeight: 700 }}>
                  {invoice.kind === "AVOIR" ? "Avoir" : "Facture"}{" "}
                  {invoice.number}
                </Typography>
                <Chip
                  size="small"
                  label={invoice.type === "VENTE" ? "Vente" : "Achat"}
                  color={invoice.type === "VENTE" ? "success" : "info"}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={
                    invoice.nature === "BIENS"
                      ? "Biens"
                      : invoice.nature === "SERVICES"
                        ? "Services"
                        : "Mixte"
                  }
                />
              </Stack>
              <Typography variant="body2">{invoice.thirdPartyName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {shortDate(invoice.invoiceDate)} · échéance{" "}
                {shortDate(invoice.dueDate)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Net à payer
              </Typography>
              <Typography sx={{ fontWeight: 700 }}>
                {money(invoice.netPayable)}
              </Typography>
            </Box>
            <Stack spacing={0.5}>
              <Chip
                size="small"
                label={invoiceStatusLabels[invoice.status]}
                color={statusColor(invoice.status)}
                variant="outlined"
              />
              <Chip
                size="small"
                label={settlementStatusLabels[invoice.settlementStatus]}
                color={
                  invoice.settlementStatus === "REGLEE" ? "success" : "default"
                }
                variant="outlined"
              />
            </Stack>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Solde
              </Typography>
              <Typography
                sx={{
                  fontWeight: 700,
                  color:
                    Number(invoice.outstandingAmount) > 0
                      ? "warning.dark"
                      : "success.dark",
                }}
              >
                {money(invoice.outstandingAmount)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                TVA {money(invoice.vatAmount)}
              </Typography>
            </Box>
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ justifyContent: { lg: "flex-end" }, flexWrap: "wrap" }}
            >
              {canManage && !archived && invoice.status === "BROUILLON" && (
                <Tooltip title="Modifier">
                  <IconButton
                    onClick={() => {
                      setSelected(invoice);
                      setDialogOpen(true);
                    }}
                  >
                    <EditOutlined />
                  </IconButton>
                </Tooltip>
              )}
              {canValidate && !archived && invoice.status === "BROUILLON" && (
                <Button
                  size="small"
                  startIcon={<CheckCircleOutlineRounded />}
                  onClick={() => action.mutate({ type: "validate", invoice })}
                >
                  Valider
                </Button>
              )}
              {canPost && !archived && invoice.status === "VALIDEE" && (
                <Button
                  size="small"
                  color="success"
                  variant="contained"
                  startIcon={<PostAddRounded />}
                  onClick={() => action.mutate({ type: "post", invoice })}
                >
                  Comptabiliser
                </Button>
              )}
              {invoice.type === "ACHAT" &&
                invoice.sourceCommercialDocumentId && (
                  <Button
                    size="small"
                    onClick={() => setMatchingInvoice(invoice)}
                  >
                    Vérifier BR
                  </Button>
                )}
              {invoice.type === "ACHAT" &&
                Number(invoice.withholdingAmount) > 0 && (
                  <Button
                    size="small"
                    onClick={() =>
                      downloadApiFile(
                        `/api/organizations/${organizationId}/dossiers/${dossierId}/business-invoices/${invoice.id}/withholding-certificate`,
                        `certificat-retenue-${invoice.number}.pdf`,
                      ).catch((reason) =>
                        setError(
                          reason instanceof Error
                            ? reason.message
                            : "Impossible de générer le certificat.",
                        ),
                      )
                    }
                  >
                    Certificat RS
                  </Button>
                )}
            </Stack>
          </Box>
        ))}
      </Card>
      {dialogOpen && (
        <InvoiceDialog
          key={
            selected?.id ??
            activeDraftSeed?.sourceDocumentId ??
            activeDraftSeed?.sourceCommercialDocumentId ??
            "new"
          }
          open={dialogOpen}
          onClose={closeDialog}
          organizationId={organizationId}
          dossierId={dossierId}
          invoice={selected}
          draftSeed={activeDraftSeed}
          invoices={invoices}
          parties={parties}
          accounts={accounts}
          journals={journals}
          vatRates={vatRates}
          withholdingRates={withholdingRates}
        />
      )}
      <Dialog open={scanOpen} onClose={closeScan} fullWidth maxWidth="sm">
        <DialogTitle>Scanner une facture avec l’IA</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              La pièce reste attachée au dossier. Après lecture, vous vérifiez
              les données comptables avant de créer le brouillon de facture.
            </Alert>
            {scanError && <Alert severity="error">{scanError}</Alert>}
            {!scanDocument && (
              <Button variant="outlined" component="label">
                {scanFile ? scanFile.name : "Choisir une image ou un PDF"}
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(event) => {
                    setScanFile(event.target.files?.[0] ?? null);
                    setScanError("");
                  }}
                />
              </Button>
            )}
            {scanDocument &&
              ["EN_ATTENTE", "EN_COURS"].includes(
                scanJob.data?.status ?? "EN_ATTENTE",
              ) && (
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center" }}
                >
                  <CircularProgress size={22} />
                  <Typography>
                    L’IA lit la facture… Cette étape peut prendre quelques
                    instants.
                  </Typography>
                </Stack>
              )}
            {scanJob.isError && (
              <Alert severity="error">
                Impossible de lire l’état de l’extraction.
              </Alert>
            )}
            {scanJob.data?.status === "ECHEC" && (
              <Alert severity="error">
                {scanJob.data.lastError || "La lecture IA a échoué."}
              </Alert>
            )}
            {scanJob.data?.status === "A_REVOIR" && (
              <Alert severity="success">
                Lecture terminée. Cliquez sur « Préparer la facture » : les
                champs, lignes et taxes seront préremplis et resteront
                modifiables avant création.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeScan}>Annuler</Button>
          {!scanDocument ? (
            <Button
              variant="contained"
              disabled={!scanFile || uploadForExtraction.isPending}
              onClick={() => uploadForExtraction.mutate()}
            >
              {uploadForExtraction.isPending
                ? "Envoi…"
                : "Lire avec l’IA"}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={
                scanJob.data?.status !== "A_REVOIR" ||
                prepareAiInvoice.isPending
              }
              onClick={() => prepareAiInvoice.mutate()}
            >
              {prepareAiInvoice.isPending
                ? "Préparation…"
                : "Préparer la facture"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(matchingInvoice)}
        onClose={() => setMatchingInvoice(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Rapprochement bon de réception — facture {matchingInvoice?.number}
        </DialogTitle>
        <DialogContent>
          {matchResult.isLoading && <Skeleton height={120} />}
          {matchResult.isError && (
            <Alert severity="error">
              Impossible de charger le rapprochement.
            </Alert>
          )}
          {matchResult.data && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert
                severity={
                  matchResult.data.hasDiscrepancies ? "warning" : "success"
                }
              >
                {matchResult.data.hasDiscrepancies
                  ? "Des écarts ont été détectés entre le bon de réception et la facture."
                  : "Aucun écart : la facture correspond au bon de réception."}{" "}
                Bon de réception {matchResult.data.receiptNumber}.
              </Alert>
              <Box sx={{ overflowX: "auto" }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 100px 110px 110px 170px",
                    gap: 1.5,
                    px: 1,
                    py: 1,
                    bgcolor: "background.default",
                  }}
                >
                  <Typography variant="caption">Article</Typography>
                  <Typography variant="caption">Qté BR</Typography>
                  <Typography variant="caption">Qté facture</Typography>
                  <Typography variant="caption">PU BR</Typography>
                  <Typography variant="caption">PU facture</Typography>
                  <Typography variant="caption">Statut</Typography>
                </Box>
                {matchResult.data.lines.map((line, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr 100px 100px 110px 110px 170px",
                      gap: 1.5,
                      px: 1,
                      py: 1,
                      borderTop: "1px solid",
                      borderColor: "divider",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body2">
                      {line.accountCode} — {line.description}
                    </Typography>
                    <Typography variant="body2">
                      {line.receiptQuantity}
                    </Typography>
                    <Typography variant="body2">
                      {line.invoiceQuantity}
                    </Typography>
                    <Typography variant="body2">
                      {line.receiptUnitPrice}
                    </Typography>
                    <Typography variant="body2">
                      {line.invoiceUnitPrice}
                    </Typography>
                    <Chip
                      size="small"
                      label={matchStatusLabels[line.status]}
                      color={line.status === "OK" ? "success" : "warning"}
                      variant="outlined"
                    />
                  </Box>
                ))}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMatchingInvoice(null)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
