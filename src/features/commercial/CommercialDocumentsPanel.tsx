import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
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
  ArrowForwardRounded,
  CancelOutlined,
  CheckCircleOutlineRounded,
  DeleteOutlineRounded,
  DescriptionOutlined,
  EditOutlined,
  ReceiptLongOutlined,
} from "@mui/icons-material";
import { api, ApiError } from "../../api/client";
import type {
  CommercialDocument,
  CommercialDocumentLine,
  FiscalVatRate,
  LedgerAccount,
  ThirdParty,
} from "../../types/api";
import { money, shortDate } from "./options";
import type { InvoiceDraftSeed } from "./InvoicesPanel";

type Direction = CommercialDocument["direction"];
type Kind = CommercialDocument["kind"];
type DraftLine = Pick<
  CommercialDocumentLine,
  "description" | "quantity" | "unitPrice" | "discountRate"
> & {
  accountId: string;
  vatCode: string;
  vatRate: string;
};
type Form = {
  direction: Direction;
  kind: Kind;
  number: string;
  issueDate: string;
  validUntil: string;
  thirdPartyId: string;
  currencyCode: string;
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
});
const emptyForm = (): Form => ({
  direction: "VENTE",
  kind: "DEVIS",
  number: "",
  issueDate: today(),
  validUntil: "",
  thirdPartyId: "",
  currencyCode: "TND",
  notes: "",
  lines: [emptyLine()],
});

const kindLabels: Record<Kind, string> = {
  DEVIS: "Devis",
  COMMANDE: "Commande",
  BON_LIVRAISON: "Bon de livraison",
  BON_RECEPTION: "Bon de réception",
};
const statusLabels: Record<CommercialDocument["status"], string> = {
  BROUILLON: "Brouillon",
  CONFIRME: "Confirmé",
  CONVERTI: "Converti",
  ANNULE: "Annulé",
};
const allowedKinds: Record<Direction, Kind[]> = {
  VENTE: ["DEVIS", "COMMANDE", "BON_LIVRAISON"],
  ACHAT: ["COMMANDE", "BON_RECEPTION"],
};
const nextKind = (document: CommercialDocument): Kind | null => {
  if (document.direction === "VENTE" && document.kind === "DEVIS")
    return "COMMANDE";
  if (document.direction === "VENTE" && document.kind === "COMMANDE")
    return "BON_LIVRAISON";
  if (document.direction === "ACHAT" && document.kind === "COMMANDE")
    return "BON_RECEPTION";
  return null;
};
const numberPrefix: Record<Kind, string> = {
  DEVIS: "DEV",
  COMMANDE: "CMD",
  BON_LIVRAISON: "BL",
  BON_RECEPTION: "BR",
};

function DocumentDialog({
  open,
  onClose,
  organizationId,
  dossierId,
  document,
  parties,
  accounts,
  vatRates,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  dossierId: string;
  document: CommercialDocument | null;
  parties: ThirdParty[];
  accounts: LedgerAccount[];
  vatRates: FiscalVatRate[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() =>
    document
      ? {
          direction: document.direction,
          kind: document.kind,
          number: document.number,
          issueDate: document.issueDate,
          validUntil: document.validUntil ?? "",
          thirdPartyId: document.thirdPartyId,
          currencyCode: document.currencyCode,
          notes: document.notes ?? "",
          lines: document.lines.map((line) => ({
            accountId: line.accountId ?? "",
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountRate: line.discountRate,
            vatCode: line.vatCode ?? "",
            vatRate: line.vatRate,
          })),
        }
      : emptyForm(),
  );
  const [error, setError] = useState("");
  const postingAccounts = accounts.filter(
    (account) => account.isActive && account.allowsPosting,
  );
  const partiesForDirection = parties.filter(
    (party) =>
      party.type === "CLIENT_ET_FOURNISSEUR" ||
      (form.direction === "VENTE"
        ? party.type === "CLIENT"
        : party.type === "FOURNISSEUR"),
  );
  const applicableVatRates = vatRates.filter(
    (rate) =>
      rate.effectiveFrom <= form.issueDate &&
      (!rate.effectiveTo || rate.effectiveTo >= form.issueDate),
  );
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const changeDirection = (direction: Direction) =>
    setForm((current) => ({
      ...current,
      direction,
      kind: direction === "VENTE" ? "DEVIS" : "COMMANDE",
      thirdPartyId: "",
    }));
  const updateLine = (index: number, key: keyof DraftLine, value: string) =>
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, position) =>
        position === index ? { ...line, [key]: value } : line,
      ),
    }));
  const calculation = useMemo(
    () =>
      form.lines.reduce(
        (total, line) => {
          const net =
            (Number(line.quantity) || 0) *
            (Number(line.unitPrice) || 0) *
            (1 - (Number(line.discountRate) || 0));
          return {
            net: total.net + net,
            vat: total.vat + net * (Number(line.vatRate) || 0),
          };
        },
        { net: 0, vat: 0 },
      ),
    [form.lines],
  );
  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        number: form.number.trim(),
        validUntil: form.validUntil || undefined,
        currencyCode: form.currencyCode.toUpperCase(),
        notes: form.notes.trim() || undefined,
        lines: form.lines.map((line) => ({
          accountId: line.accountId || undefined,
          description: line.description.trim(),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountRate: line.discountRate,
          vatCode: line.vatCode || undefined,
          vatRate: line.vatCode ? undefined : line.vatRate,
        })),
      };
      const base = `/api/organizations/${organizationId}/dossiers/${dossierId}/commercial-documents`;
      return document
        ? api.put<CommercialDocument>(`${base}/${document.id}`, body)
        : api.post<CommercialDocument>(base, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["commercial-documents", organizationId, dossierId],
      });
      onClose();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Impossible d’enregistrer le document.",
      ),
  });
  const valid =
    Boolean(
      form.number.trim() &&
      form.issueDate &&
      form.thirdPartyId &&
      form.currencyCode.length === 3,
    ) &&
    form.lines.every(
      (line) =>
        line.description.trim() &&
        line.unitPrice.trim() !== "" &&
        Number(line.unitPrice) >= 0,
    );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        {document
          ? `Modifier ${document.number}`
          : "Nouveau document commercial"}
      </DialogTitle>
      <DialogContent sx={{ pt: "12px !important" }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
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
            value={form.direction}
            onChange={(event) =>
              changeDirection(event.target.value as Direction)
            }
          >
            <MenuItem value="VENTE">Vente</MenuItem>
            <MenuItem value="ACHAT">Achat</MenuItem>
          </TextField>
          <TextField
            select
            label="Document"
            value={form.kind}
            onChange={(event) => set("kind", event.target.value as Kind)}
          >
            {allowedKinds[form.direction].map((kind) => (
              <MenuItem key={kind} value={kind}>
                {kindLabels[kind]}
              </MenuItem>
            ))}
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
            value={form.issueDate}
            onChange={(event) => set("issueDate", event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            required
          />
          <TextField
            label="Valable jusqu’au"
            type="date"
            value={form.validUntil}
            onChange={(event) => set("validUntil", event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            select
            label={form.direction === "VENTE" ? "Client" : "Fournisseur"}
            value={form.thirdPartyId}
            onChange={(event) => set("thirdPartyId", event.target.value)}
            required
          >
            <MenuItem value="">Sélectionner…</MenuItem>
            {partiesForDirection.map((party) => (
              <MenuItem key={party.id} value={party.id}>
                {party.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Devise"
            value={form.currencyCode}
            onChange={(event) =>
              set("currencyCode", event.target.value.toUpperCase())
            }
            slotProps={{ htmlInput: { maxLength: 3 } }}
          />
          <TextField
            label="Notes"
            value={form.notes}
            onChange={(event) => set("notes", event.target.value)}
          />
        </Box>

        <Divider sx={{ my: 3 }}>
          <Chip label="Articles et services" />
        </Divider>
        <Stack spacing={1.5}>
          {form.lines.map((line, index) => (
            <Card key={index} variant="outlined" sx={{ p: 2 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "1.4fr 2fr .7fr 1fr 1fr 1fr auto",
                  },
                  gap: 1.5,
                  alignItems: "center",
                }}
              >
                <TextField
                  select
                  size="small"
                  label="Compte (facultatif)"
                  value={line.accountId}
                  onChange={(event) =>
                    updateLine(index, "accountId", event.target.value)
                  }
                >
                  <MenuItem value="">À choisir à la facture</MenuItem>
                  {postingAccounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.code} — {account.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="Désignation"
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
                  <MenuItem value="manual:0.00000">0 %</MenuItem>
                  {applicableVatRates.map((rate) => (
                    <MenuItem key={rate.id} value={rate.code}>
                      {rate.label} — {(Number(rate.rate) * 100).toFixed(0)} %
                    </MenuItem>
                  ))}
                  <MenuItem value="manual:0.07000">7 %</MenuItem>
                  <MenuItem value="manual:0.13000">13 %</MenuItem>
                  <MenuItem value="manual:0.19000">19 %</MenuItem>
                </TextField>
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
        <Card variant="outlined" sx={{ mt: 3, p: 2, bgcolor: "grey.50" }}>
          <Stack
            direction="row"
            spacing={4}
            useFlexGap
            sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}
          >
            <Box>
              <Typography variant="caption">Total HT</Typography>
              <Typography sx={{ fontWeight: 800 }}>
                {money(calculation.net)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">TVA</Typography>
              <Typography sx={{ fontWeight: 800 }}>
                {money(calculation.vat)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">Total TTC</Typography>
              <Typography sx={{ fontWeight: 900, color: "primary.main" }}>
                {money(calculation.net + calculation.vat)}
              </Typography>
            </Box>
          </Stack>
        </Card>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          disabled={!valid || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Enregistrer le brouillon
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function CommercialDocumentsPanel({
  organizationId,
  dossierId,
  documents,
  parties,
  accounts,
  vatRates,
  loading,
  archived,
  canManage,
  onPrepareInvoice,
}: {
  organizationId: string;
  dossierId: string;
  documents: CommercialDocument[];
  parties: ThirdParty[];
  accounts: LedgerAccount[];
  vatRates: FiscalVatRate[];
  loading: boolean;
  archived: boolean;
  canManage: boolean;
  onPrepareInvoice: (seed: InvoiceDraftSeed) => void;
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<CommercialDocument | null>(null);
  const [direction, setDirection] = useState<"TOUS" | Direction>("TOUS");
  const [error, setError] = useState("");
  const filtered = documents.filter(
    (document) => direction === "TOUS" || document.direction === direction,
  );
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["commercial-documents", organizationId, dossierId],
    });
  const action = useMutation({
    mutationFn: ({
      document,
      type,
    }: {
      document: CommercialDocument;
      type: "confirm" | "cancel";
    }) =>
      api.post<CommercialDocument>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/commercial-documents/${document.id}/${type}`,
      ),
    onSuccess: async () => {
      setError("");
      await refresh();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError ? reason.message : "Action impossible.",
      ),
  });
  const convert = useMutation({
    mutationFn: ({
      document,
      targetKind,
    }: {
      document: CommercialDocument;
      targetKind: Kind;
    }) =>
      api.post<CommercialDocument>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/commercial-documents/${document.id}/convert`,
        {
          targetKind,
          number: `${numberPrefix[targetKind]}-${document.number}`,
          issueDate: today(),
        },
      ),
    onSuccess: async () => {
      setError("");
      await refresh();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError ? reason.message : "Conversion impossible.",
      ),
  });
  const prepareInvoice = (document: CommercialDocument) =>
    onPrepareInvoice({
      sourceCommercialDocumentId: document.id,
      type: document.direction,
      number: `FAC-${document.number}`,
      invoiceDate: today(),
      thirdPartyId: document.thirdPartyId,
      lines: document.lines.map((line) => ({
        accountId: line.accountId ?? "",
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountRate: line.discountRate,
        vatCode: line.vatCode ?? "",
        vatRate: line.vatRate,
      })),
      notes: `Créée depuis ${kindLabels[document.kind]} ${document.number}`,
    });

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
            <Typography variant="h3" sx={{ fontSize: 24 }}>
              Cycle commercial
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Devis, commandes et livraisons convertis sans ressaisie.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <TextField
              select
              size="small"
              label="Flux"
              value={direction}
              onChange={(event) =>
                setDirection(event.target.value as "TOUS" | Direction)
              }
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="TOUS">Tous</MenuItem>
              <MenuItem value="VENTE">Ventes</MenuItem>
              <MenuItem value="ACHAT">Achats</MenuItem>
            </TextField>
            {canManage && !archived && (
              <Button
                variant="contained"
                startIcon={<AddRounded />}
                onClick={() => {
                  setSelected(null);
                  setDialogOpen(true);
                }}
              >
                Nouveau document
              </Button>
            )}
          </Stack>
        </Box>
        <Box
          sx={{
            mx: 2.5,
            mb: 2,
            p: 1.5,
            bgcolor: "grey.50",
            borderRadius: 1,
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          {["Devis", "Commande", "Livraison", "Facture", "Paiement"].map(
            (label, index, items) => (
              <Stack
                key={label}
                direction="row"
                spacing={1}
                sx={{ alignItems: "center" }}
              >
                <Chip
                  size="small"
                  label={`${index + 1}. ${label}`}
                  color={index < 3 ? "primary" : "default"}
                  variant={index === 0 ? "filled" : "outlined"}
                />
                {index < items.length - 1 && (
                  <ArrowForwardRounded
                    sx={{ fontSize: 17, color: "text.disabled" }}
                  />
                )}
              </Stack>
            ),
          )}
        </Box>
        {error && (
          <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading && (
          <Box sx={{ p: 2.5 }}>
            <Skeleton height={80} />
            <Skeleton height={80} />
          </Box>
        )}
        {!loading && !filtered.length && (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <DescriptionOutlined
              sx={{ fontSize: 46, color: "text.disabled" }}
            />
            <Typography sx={{ fontWeight: 800, mt: 1 }}>
              Aucun document commercial
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Commencez par un devis client ou une commande fournisseur.
            </Typography>
          </Box>
        )}
        {filtered.map((document) => {
          const target = nextKind(document);
          const finalDocument =
            document.kind === "BON_LIVRAISON" ||
            document.kind === "BON_RECEPTION";
          return (
            <Box
              key={document.id}
              sx={{
                px: 3,
                py: 2,
                borderTop: "1px solid",
                borderColor: "divider",
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  lg: "minmax(260px, 1fr) 150px 130px auto",
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
                  <Typography sx={{ fontWeight: 900 }}>
                    {kindLabels[document.kind]} {document.number}
                  </Typography>
                  <Chip
                    size="small"
                    label={document.direction === "VENTE" ? "Vente" : "Achat"}
                    color={document.direction === "VENTE" ? "success" : "info"}
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={statusLabels[document.status]}
                    color={
                      document.status === "CONFIRME"
                        ? "success"
                        : document.status === "BROUILLON"
                          ? "warning"
                          : "default"
                    }
                  />
                </Stack>
                <Typography variant="body2">
                  {document.thirdParty.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {shortDate(document.issueDate)}
                  {document.sourceDocumentId
                    ? " · issu d’un document précédent"
                    : ""}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total TTC
                </Typography>
                <Typography sx={{ fontWeight: 900 }}>
                  {money(document.grossAmount)} {document.currencyCode}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  TVA
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  {money(document.vatAmount)}
                </Typography>
              </Box>
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ justifyContent: { lg: "flex-end" }, flexWrap: "wrap" }}
              >
                {canManage && !archived && document.status === "BROUILLON" && (
                  <>
                    <Tooltip title="Modifier">
                      <IconButton
                        onClick={() => {
                          setSelected(document);
                          setDialogOpen(true);
                        }}
                      >
                        <EditOutlined />
                      </IconButton>
                    </Tooltip>
                    <Button
                      size="small"
                      startIcon={<CheckCircleOutlineRounded />}
                      onClick={() =>
                        action.mutate({ document, type: "confirm" })
                      }
                    >
                      Confirmer
                    </Button>
                  </>
                )}
                {canManage &&
                  !archived &&
                  document.status === "CONFIRME" &&
                  target && (
                    <Button
                      size="small"
                      variant="outlined"
                      endIcon={<ArrowForwardRounded />}
                      onClick={() =>
                        convert.mutate({ document, targetKind: target })
                      }
                    >
                      Créer {kindLabels[target].toLowerCase()}
                    </Button>
                  )}
                {canManage &&
                  !archived &&
                  document.status === "CONFIRME" &&
                  finalDocument && (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<ReceiptLongOutlined />}
                      onClick={() => prepareInvoice(document)}
                    >
                      Préparer la facture
                    </Button>
                  )}
                {canManage &&
                  !archived &&
                  ["BROUILLON", "CONFIRME"].includes(document.status) && (
                    <Tooltip title="Annuler">
                      <IconButton
                        color="error"
                        onClick={() =>
                          action.mutate({ document, type: "cancel" })
                        }
                      >
                        <CancelOutlined />
                      </IconButton>
                    </Tooltip>
                  )}
              </Stack>
            </Box>
          );
        })}
      </Card>
      {dialogOpen && (
        <DocumentDialog
          key={selected?.id ?? "new"}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          organizationId={organizationId}
          dossierId={dossierId}
          document={selected}
          parties={parties}
          accounts={accounts}
          vatRates={vatRates}
        />
      )}
    </>
  );
}
