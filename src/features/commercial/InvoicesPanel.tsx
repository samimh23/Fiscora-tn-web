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
import { InvoiceAiImports } from "./InvoiceAiImports";
import { DocumentExtractionReviewDialog } from "../operations/DocumentExtractionReviewDialog";
import type {
  AccountingJournal,
  AccountingDocument,
  BusinessInvoice,
  FiscalVatRate,
  FiscalWithholdingRate,
  LedgerAccount,
  ThirdParty,
  DocumentExtractionJob,
  DocumentExtractionReviewItem,
} from "../../types/api";
import {
  invoiceStatusLabels,
  money,
  settlementStatusLabels,
  shortDate,
} from "./options";

import {
  calculateInvoiceDraftLines,
  invoiceSeedFromExtraction,
  type DraftLine,
  type InvoiceDraftSeed,
} from "./invoice-extraction-seed";
export type { InvoiceDraftSeed } from "./invoice-extraction-seed";
type Form = {
  type: "ACHAT" | "VENTE";
  nature: "" | "BIENS" | "SERVICES" | "MIXTE";
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
  fodecAccountId: string;
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
  fodecRate: "",
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
  fodecAccountId: "",
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
          fodecAccountId: invoice.fodecAccountId ?? "",
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
            fodecRate: line.fodecRate ?? "",
          })),
        }
      : draftSeed
        ? {
            ...emptyForm(),
            type: draftSeed.type,
            nature: draftSeed.nature ?? "",
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
            thirdPartyTaxIdentifier: draftSeed.thirdPartyTaxIdentifier ?? "",
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
              )?.id ??
              "",
            sourceCommercialDocumentId:
              draftSeed.sourceCommercialDocumentId ?? "",
            sourceDocumentId: draftSeed.sourceDocumentId ?? "",
            currencyCode: draftSeed.currencyCode ?? "TND",
            stampDuty: draftSeed.stampDuty ?? "",
            vatAccountId: draftSeed.vatAccountId ?? "",
            stampAccountId: draftSeed.stampAccountId ?? "",
            exciseAccountId: draftSeed.exciseAccountId ?? "",
            fodecAccountId: draftSeed.fodecAccountId ?? "",
            notes: draftSeed.notes,
            lines: draftSeed.lines,
          }
        : emptyForm(),
  );
  const [error, setError] = useState("");
  const [autoCreatedParty, setAutoCreatedParty] = useState<ThirdParty | null>(
    null,
  );
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
      Number(item.netPayable) - Number(item.creditedAmount) > 0,
  );
  const selectedParty =
    parties.find((party) => party.id === form.thirdPartyId) ??
    (autoCreatedParty?.id === form.thirdPartyId ? autoCreatedParty : undefined);
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
    () => calculateInvoiceDraftLines(form.lines),
    [form.lines],
  );
  const changeType = (type: Form["type"]) => {
    if (type === form.type) return;
    setAutoCreatedParty(null);
    const seed = invoiceSeedFromExtraction(
      draftSeed?.extractionData ?? {},
      form.sourceDocumentId,
      parties,
      accounts,
      journals,
      type,
    );
    setForm((current) => ({
      ...current,
      type,
      thirdPartyId: seed.thirdPartyId,
      thirdPartyName: seed.thirdPartyName ?? "",
      thirdPartyTaxIdentifier: seed.thirdPartyTaxIdentifier ?? "",
      originalInvoiceId: "",
      journalId: seed.journalId ?? "",
      thirdPartyAccountId: seed.thirdPartyAccountId ?? "",
      vatAccountId: seed.vatAccountId ?? "",
      lines: current.lines.map((line, index) => ({
        ...line,
        accountId: draftSeed?.extractionData
          ? (seed.lines[index]?.accountId ?? "")
          : "",
      })),
    }));
  };
  const selectParty = (id: string) => {
    const party = parties.find((entry) => entry.id === id);
    setAutoCreatedParty(null);
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
      let linkedParty = selectedParty;
      if (!linkedParty && form.sourceDocumentId) {
        linkedParty = await api.post<ThirdParty>(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/third-parties`,
          {
            type: form.type === "VENTE" ? "CLIENT" : "FOURNISSEUR",
            name: form.thirdPartyName.trim(),
            taxIdentifier: form.thirdPartyTaxIdentifier.trim() || undefined,
            ...(form.type === "VENTE"
              ? { receivableAccountId: form.thirdPartyAccountId }
              : { payableAccountId: form.thirdPartyAccountId }),
          },
        );
        setAutoCreatedParty(linkedParty);
        setForm((current) => ({
          ...current,
          thirdPartyId: linkedParty?.id ?? "",
          thirdPartyName: linkedParty?.name ?? current.thirdPartyName,
          thirdPartyTaxIdentifier:
            linkedParty?.taxIdentifier ?? current.thirdPartyTaxIdentifier,
        }));
      }
      const body = {
        type: form.type,
        nature: form.nature,
        kind: form.kind,
        number: form.number.trim(),
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        thirdPartyId: linkedParty?.id,
        originalInvoiceId:
          form.kind === "AVOIR"
            ? form.originalInvoiceId || undefined
            : undefined,
        thirdPartyName: linkedParty?.name ?? form.thirdPartyName.trim(),
        thirdPartyTaxIdentifier:
          linkedParty?.taxIdentifier ||
          form.thirdPartyTaxIdentifier.trim() ||
          undefined,
        journalId: form.journalId,
        thirdPartyAccountId: form.thirdPartyAccountId,
        vatAccountId: form.vatAccountId || undefined,
        stampAccountId: form.stampAccountId || undefined,
        exciseAccountId: form.exciseAccountId || undefined,
        fodecAccountId: form.fodecAccountId || undefined,
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
          fodecRate: line.fodecRate || undefined,
        })),
      };
      const base = `/api/organizations/${organizationId}/dossiers/${dossierId}/business-invoices`;
      const saved = invoice
        ? await api.put<BusinessInvoice>(`${base}/${invoice.id}`, body)
        : await api.post<BusinessInvoice>(base, body);
      if (
        !invoice &&
        form.sourceDocumentId &&
        draftSeed?.extractionData &&
        !draftSeed.extractionReviewed
      ) {
        // Saving a business draft must not rewrite printed document totals or
        // turn a TTC-to-HT display conversion into a correction of the source.
        const correctedData = {
          ...draftSeed.extractionData,
          document_type: form.kind === "AVOIR" ? "credit_note" : "invoice",
          supplier: {
            ...recordValue(draftSeed.extractionData.supplier),
            name: linkedParty?.name ?? form.thirdPartyName.trim(),
            tax_id:
              linkedParty?.taxIdentifier ||
              form.thirdPartyTaxIdentifier.trim() ||
              null,
          },
          document_number: form.number.trim(),
          issue_date: form.invoiceDate,
          currency: form.currencyCode,
          stamp_tax: form.stampDuty || draftSeed.extractionData.stamp_tax,
          line_items: form.lines.map((line, index) => {
            const originalLines = draftSeed.extractionData!.line_items;
            const original = recordValue(
              Array.isArray(originalLines) ? originalLines[index] : undefined,
            );
            const initial = draftSeed.lines[index];
            const priceUnchanged = initial?.unitPrice === line.unitPrice;
            const discountUnchanged =
              initial?.discountRate === line.discountRate;
            const amountsUnchanged =
              priceUnchanged &&
              discountUnchanged &&
              initial?.quantity === line.quantity;
            return {
              ...original,
              description: line.description.trim(),
              quantity: line.quantity,
              unit_price: priceUnchanged
                ? (original.unit_price ?? null)
                : line.unitPrice,
              unit_price_basis: priceUnchanged
                ? (original.unit_price_basis ?? "HT")
                : "HT",
              discount_rate: discountUnchanged
                ? (original.discount_rate ?? null)
                : line.discountRate,
              tax_rate:
                initial?.vatRate === line.vatRate
                  ? (original.tax_rate ?? null)
                  : line.vatRate,
              line_total: amountsUnchanged
                ? (original.line_total ?? null)
                : calculateInvoiceDraftLines([line]).net.toFixed(3),
              line_total_basis: amountsUnchanged
                ? (original.line_total_basis ?? "HT")
                : "HT",
            };
          }),
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
          queryKey: ["third-parties", organizationId, dossierId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dossier-documents", organizationId, dossierId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["document-extraction-reviews", organizationId, dossierId],
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
    form.nature &&
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
        {draftSeed?.vatInferenceNotice && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {draftSeed.vatInferenceNotice}
          </Alert>
        )}
        {draftSeed?.extractionNotice && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {draftSeed.extractionNotice}
          </Alert>
        )}
        {form.sourceDocumentId && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Données préremplies par l’IA. « Enregistrer le brouillon » créera
            une vraie facture métier liée à la pièce originale ; vérifiez les
            comptes proposés et confirmez la nature (biens, services ou mixte)
            avant de continuer. Une proposition IA reste modifiable.
          </Alert>
        )}
        {form.sourceDocumentId &&
          !form.thirdPartyId &&
          Boolean(form.thirdPartyName.trim()) && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Le tiers « {form.thirdPartyName.trim()} » n’existe pas encore. Il
              sera créé et lié automatiquement à cette facture lors de
              l’enregistrement du brouillon.
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
            required
            value={form.nature}
            onChange={(event) =>
              set("nature", event.target.value as Form["nature"])
            }
            helperText={
              !form.nature
                ? "Choisissez la nature d’après la facture originale"
                : draftSeed?.nature && form.nature === draftSeed.nature
                  ? "Proposition IA — vérifiez-la ; vous pouvez la modifier"
                  : "Détermine les contrôles fiscaux"
            }
          >
            <MenuItem value="" disabled>
              Choisir la nature
            </MenuItem>
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
              label={
                form.type === "VENTE" ? "Nom du client" : "Nom du fournisseur"
              }
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
                label: `${item.number} — ${item.thirdPartyName} — montant créditable ${money(Number(item.netPayable) - Number(item.creditedAmount))}`,
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
                    md: "2fr 2fr .8fr 1fr 1fr 1fr .8fr .8fr auto",
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
                  {line.vatCode === "" &&
                    !["0.00000", "0.07000", "0.13000", "0.19000"].includes(
                      line.vatRate,
                    ) && (
                      <MenuItem value={`manual:${line.vatRate}`}>
                        {(Number(line.vatRate) * 100).toFixed(3)} % (déduit de
                        la TVA totale)
                      </MenuItem>
                    )}
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
                <TextField
                  size="small"
                  label="FODEC"
                  value={line.fodecRate ?? ""}
                  onChange={(event) =>
                    updateLine(index, "fodecRate", event.target.value)
                  }
                  helperText="Taux, ex. 0.01"
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
          <SearchableSelect
            label="Compte FODEC"
            value={form.fodecAccountId}
            onChange={(value) => set("fodecAccountId", value)}
            options={postingAccounts.map((account) => ({
              value: account.id,
              label: `${account.code} — ${account.name}`,
            }))}
            helperText="Requis si une ligne comporte du FODEC ; distinct du droit de consommation"
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
            {calculation.fodec !== 0 && (
              <Box>
                <Typography variant="caption">FODEC</Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  {money(calculation.fodec)}
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
                {money(
                  calculation.net +
                    calculation.excise +
                    calculation.fodec +
                    calculation.vat,
                )}
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
  sourceDocumentId,
  onSourceDocumentConsumed,
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
  sourceDocumentId?: string | null;
  onSourceDocumentConsumed?: () => void;
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
  const [reviewTarget, setReviewTarget] =
    useState<DocumentExtractionReviewItem | null>(null);
  const [filter, setFilter] = useState("TOUTES");
  const [error, setError] = useState("");
  const [matchingInvoice, setMatchingInvoice] =
    useState<BusinessInvoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] =
    useState<BusinessInvoice | null>(null);
  const [preparedSourceDocumentId, setPreparedSourceDocumentId] = useState("");
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
  const sourceExtraction = useQuery({
    queryKey: [
      "invoice-source-extraction",
      organizationId,
      dossierId,
      sourceDocumentId,
    ],
    queryFn: () =>
      api.get<DocumentExtractionJob>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${sourceDocumentId}/extraction`,
      ),
    enabled: Boolean(sourceDocumentId),
    retry: false,
  });
  useEffect(() => {
    if (!sourceDocumentId) {
      setPreparedSourceDocumentId("");
      return;
    }
    if (
      preparedSourceDocumentId === sourceDocumentId ||
      loading ||
      !sourceExtraction.data?.normalizedData
    )
      return;
    setPreparedSourceDocumentId(sourceDocumentId);
    const existing = invoices.find(
      (invoice) => invoice.sourceDocumentId === sourceDocumentId,
    );
    if (existing) {
      setError(`La facture ${existing.number} est déjà liée à ce document.`);
      onSourceDocumentConsumed?.();
      return;
    }
    const data = sourceExtraction.data.normalizedData;
    if (
      !["invoice", "credit_note", "receipt"].includes(
        String(data.document_type),
      )
    ) {
      setError("Le document validé n’est pas une facture.");
      onSourceDocumentConsumed?.();
      return;
    }
    setError("");
    setSelected(null);
    setAiDraftSeed({
      ...invoiceSeedFromExtraction(
        data,
        sourceDocumentId,
        parties,
        accounts,
        journals,
      ),
      extractionReviewed: sourceExtraction.data.status === "VALIDEE",
    });
    setDialogOpen(true);
    onSourceDocumentConsumed?.();
  }, [
    accounts,
    invoices,
    journals,
    loading,
    onSourceDocumentConsumed,
    parties,
    preparedSourceDocumentId,
    sourceDocumentId,
    sourceExtraction.data,
  ]);
  useEffect(() => {
    if (!sourceDocumentId || !sourceExtraction.isError) return;
    setError("Impossible de charger les données validées de cette facture.");
    onSourceDocumentConsumed?.();
  }, [onSourceDocumentConsumed, sourceDocumentId, sourceExtraction.isError]);
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
  const deleteInvoice = useMutation({
    mutationFn: (invoice: BusinessInvoice) =>
      api.delete<void>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/business-invoices/${invoice.id}`,
      ),
    onSuccess: async () => {
      setInvoiceToDelete(null);
      setError("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["business-invoices", organizationId, dossierId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dossier-documents", organizationId, dossierId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["commercial-documents", organizationId, dossierId],
        }),
      ]);
    },
    onError: (reason) => {
      setInvoiceToDelete(null);
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Impossible de supprimer ce brouillon.",
      );
    },
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
      void queryClient.invalidateQueries({
        queryKey: ["dossier-documents", organizationId, dossierId],
      });
    },
    onError: (reason) =>
      setScanError(
        reason instanceof ApiError || reason instanceof Error
          ? reason.message
          : "Impossible de lancer la lecture IA.",
      ),
  });
  const reviewAiExtraction = useMutation({
    mutationFn: async (document: AccountingDocument) => {
      const job = await api.get<DocumentExtractionJob>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${document.id}/extraction`,
      );
      if (job.status !== "A_REVOIR" || !job.normalizedData)
        throw new Error(
          "Cette extraction n’est plus en attente de vérification. Actualisez les imports IA.",
        );
      return { ...job, document };
    },
    onSuccess: (target) => {
      setError("");
      setScanError("");
      setScanOpen(false);
      setScanDocument(null);
      setScanFile(null);
      setReviewTarget(target);
    },
    onError: (reason) => {
      const message =
        reason instanceof Error
          ? reason.message
          : "Impossible d’ouvrir la vérification.";
      setError(message);
      setScanError(message);
    },
  });
  const prepareAiInvoice = useMutation({
    mutationFn: async (documentId: string) => {
      if (invoices.some((invoice) => invoice.sourceDocumentId === documentId))
        throw new Error("Une facture est déjà liée à ce document.");
      const job = await api.get<DocumentExtractionJob>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${documentId}/extraction`,
      );
      if (job.status !== "VALIDEE" || !job.normalizedData)
        throw new Error(
          "Vérifiez et confirmez les données extraites avant de préparer la facture.",
        );
      const mappedData = job.normalizedData;
      if (
        !["invoice", "credit_note", "receipt"].includes(
          String(mappedData.document_type),
        )
      )
        throw new Error("Le document détecté n’est pas une facture.");
      return {
        ...invoiceSeedFromExtraction(
          mappedData,
          documentId,
          parties,
          accounts,
          journals,
        ),
        extractionReviewed: true,
      };
    },
    onSuccess: (seed) => {
      setError("");
      setScanError("");
      setScanOpen(false);
      setScanFile(null);
      setScanDocument(null);
      setSelected(null);
      setAiDraftSeed(seed);
      setDialogOpen(true);
    },
    onError: (reason) => {
      const message =
        reason instanceof Error
          ? reason.message
          : "Impossible de préparer la facture.";
      setScanError(message);
      setError(message);
    },
  });
  const closeScan = () => {
    if (
      uploadForExtraction.isPending ||
      prepareAiInvoice.isPending ||
      reviewAiExtraction.isPending
    )
      return;
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
        <InvoiceAiImports
          organizationId={organizationId}
          dossierId={dossierId}
          invoices={invoices}
          canPrepare={canManage && !archived && !loading}
          preparing={prepareAiInvoice.isPending || reviewAiExtraction.isPending}
          onPrepare={(documentId) => prepareAiInvoice.mutate(documentId)}
          onReview={(document) => reviewAiExtraction.mutate(document)}
        />
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
              Aucune facture enregistrée
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
                {Number(invoice.outstandingAmount) < 0
                  ? "Crédit à rembourser"
                  : "Solde"}
              </Typography>
              <Typography
                sx={{
                  fontWeight: 700,
                  color:
                    Number(invoice.outstandingAmount) !== 0
                      ? "warning.dark"
                      : "success.dark",
                }}
              >
                {money(Math.abs(Number(invoice.outstandingAmount)))}
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
                <>
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
                </>
              )}
              {canManage &&
                !archived &&
                ["BROUILLON", "VALIDEE"].includes(invoice.status) && (
                  <Tooltip
                    title={
                      invoice.status === "VALIDEE"
                        ? "Supprimer la facture validée et son écriture brouillon"
                        : "Supprimer le brouillon"
                    }
                  >
                    <IconButton
                      color="error"
                      onClick={() => setInvoiceToDelete(invoice)}
                    >
                      <DeleteOutlineRounded />
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
      {reviewTarget && (
        <DocumentExtractionReviewDialog
          key={`${organizationId}:${dossierId}:${reviewTarget.id}`}
          organizationId={organizationId}
          dossierId={dossierId}
          target={reviewTarget}
          onClose={() => setReviewTarget(null)}
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
                Lecture terminée. Cliquez sur « Vérifier les données » pour
                comparer les valeurs avec la pièce originale et les confirmer.
                Vous pourrez ensuite préparer la facture.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={closeScan}
            disabled={
              uploadForExtraction.isPending ||
              prepareAiInvoice.isPending ||
              reviewAiExtraction.isPending
            }
          >
            {scanDocument ? "Continuer en arrière-plan" : "Annuler"}
          </Button>
          {!scanDocument ? (
            <Button
              variant="contained"
              disabled={!scanFile || uploadForExtraction.isPending}
              onClick={() => uploadForExtraction.mutate()}
            >
              {uploadForExtraction.isPending ? "Envoi…" : "Lire avec l’IA"}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={
                !["A_REVOIR", "VALIDEE"].includes(scanJob.data?.status ?? "") ||
                prepareAiInvoice.isPending ||
                reviewAiExtraction.isPending
              }
              onClick={() =>
                scanJob.data?.status === "VALIDEE"
                  ? prepareAiInvoice.mutate(scanDocument.id)
                  : reviewAiExtraction.mutate(scanDocument)
              }
            >
              {prepareAiInvoice.isPending || reviewAiExtraction.isPending
                ? "Chargement…"
                : scanJob.data?.status === "VALIDEE"
                  ? "Préparer la facture"
                  : "Vérifier les données"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(invoiceToDelete)}
        onClose={
          deleteInvoice.isPending ? undefined : () => setInvoiceToDelete(null)
        }
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {invoiceToDelete?.status === "VALIDEE"
            ? "Supprimer la facture validée ?"
            : "Supprimer le brouillon ?"}
        </DialogTitle>
        <DialogContent>
          <Typography>
            La facture {invoiceToDelete?.number} sera supprimée. Le document
            source restera dans la collecte afin de pouvoir recréer la facture.
          </Typography>
          {invoiceToDelete?.status === "VALIDEE" && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Son écriture comptable encore en brouillon sera également
              supprimée. Aucune écriture comptabilisée ne sera effacée.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={deleteInvoice.isPending}
            onClick={() => setInvoiceToDelete(null)}
          >
            Annuler
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteInvoice.isPending}
            onClick={() => {
              if (invoiceToDelete) deleteInvoice.mutate(invoiceToDelete);
            }}
          >
            {deleteInvoice.isPending ? "Suppression…" : "Supprimer"}
          </Button>
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
