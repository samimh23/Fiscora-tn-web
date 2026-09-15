import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  AccountBalanceWalletOutlined,
  PostAddRounded,
  UndoRounded,
} from "@mui/icons-material";
import { api, ApiError } from "../../api/client";
import type {
  AccountingJournal,
  BusinessInvoice,
  LedgerAccount,
  ThirdParty,
  ThirdPartyPayment,
} from "../../types/api";
import { money, paymentStatusLabels, shortDate } from "./options";
import { useFeedback } from "../../feedback/useFeedback";
import { UnsavedChangesDialog } from "../../components/UnsavedChangesDialog";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";

type AllocationMap = Record<string, string>;
const isInstrumentMethod = (method: string) => {
  const normalized = method.trim().toLowerCase();
  return (
    normalized.includes("chèque") ||
    normalized.includes("cheque") ||
    normalized.includes("traite")
  );
};
const instrumentStatusLabels: Record<string, string> = {
  RECU: "Reçu",
  DEPOSE: "Déposé en banque",
  ENCAISSE: "Encaissé",
  IMPAYE: "Impayé",
};
const correctionTypeLabels: Record<string, string> = {
  ANNULATION_SAISIE: "Saisie annulée",
  REMBOURSEMENT: "Remboursé",
};

function PaymentDialog({
  open,
  onClose,
  organizationId,
  dossierId,
  parties,
  invoices,
  accounts,
  journals,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  dossierId: string;
  parties: ThirdParty[];
  invoices: BusinessInvoice[];
  accounts: LedgerAccount[];
  journals: AccountingJournal[];
}) {
  const queryClient = useQueryClient();
  const { showFeedback } = useFeedback();
  const today = new Date().toISOString().slice(0, 10);
  const [direction, setDirection] = useState<"ENCAISSEMENT" | "DECAISSEMENT">(
    "ENCAISSEMENT",
  );
  const [thirdPartyId, setThirdPartyId] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [method, setMethod] = useState("Virement");
  const [reference, setReference] = useState("");
  const [instrumentNumber, setInstrumentNumber] = useState("");
  const [instrumentBank, setInstrumentBank] = useState("");
  const [instrumentDueDate, setInstrumentDueDate] = useState("");
  const [journalId, setJournalId] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [thirdPartyAccountId, setThirdPartyAccountId] = useState("");
  const [allocations, setAllocations] = useState<AllocationMap>({});
  const [error, setError] = useState("");
  const receipt = direction === "ENCAISSEMENT";
  const availableParties = parties.filter(
    (party) =>
      party.type === "CLIENT_ET_FOURNISSEUR" ||
      (receipt ? party.type === "CLIENT" : party.type === "FOURNISSEUR"),
  );
  const openInvoices = invoices.filter(
    (invoice) =>
      invoice.kind === "FACTURE" &&
      invoice.status === "COMPTABILISEE" &&
      invoice.type === (receipt ? "VENTE" : "ACHAT") &&
      invoice.thirdPartyId === thirdPartyId &&
      Number(invoice.outstandingAmount) > 0,
  );
  const paymentJournals = journals.filter((journal) =>
    ["BANQUE", "CAISSE"].includes(journal.type),
  );
  const postingAccounts = accounts.filter(
    (account) => account.isActive && account.allowsPosting,
  );
  const total = useMemo(
    () =>
      Object.values(allocations).reduce(
        (sum, value) => sum + (Number(value) || 0),
        0,
      ),
    [allocations],
  );
  const changeDirection = (value: "ENCAISSEMENT" | "DECAISSEMENT") => {
    setDirection(value);
    setThirdPartyId("");
    setThirdPartyAccountId("");
    setAllocations({});
  };
  const changeParty = (id: string) => {
    const party = parties.find((entry) => entry.id === id);
    setThirdPartyId(id);
    setThirdPartyAccountId(
      party
        ? ((receipt ? party.receivableAccountId : party.payableAccountId) ?? "")
        : "",
    );
    setAllocations({});
  };
  const toggleInvoice = (invoice: BusinessInvoice, checked: boolean) =>
    setAllocations((current) => {
      const next = { ...current };
      if (checked) next[invoice.id] = invoice.outstandingAmount;
      else delete next[invoice.id];
      return next;
    });
  const mutation = useMutation({
    mutationFn: () =>
      api.post<ThirdPartyPayment>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/payments`,
        {
          thirdPartyId,
          direction,
          paymentDate,
          amount: total.toFixed(3),
          method: method.trim(),
          reference: reference.trim() || undefined,
          journalId,
          cashAccountId,
          thirdPartyAccountId,
          allocations: Object.entries(allocations).map(
            ([invoiceId, amount]) => ({ invoiceId, amount }),
          ),
          instrumentNumber: isInstrumentMethod(method)
            ? instrumentNumber.trim() || undefined
            : undefined,
          instrumentBank: isInstrumentMethod(method)
            ? instrumentBank.trim() || undefined
            : undefined,
          instrumentDueDate: isInstrumentMethod(method)
            ? instrumentDueDate || undefined
            : undefined,
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["third-party-payments", organizationId, dossierId],
      });
      onClose();
      showFeedback("Le règlement a été créé en brouillon.");
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Impossible d’enregistrer le règlement.",
      ),
  });
  const valid = Boolean(
    thirdPartyId &&
    paymentDate &&
    method.trim() &&
    journalId &&
    cashAccountId &&
    thirdPartyAccountId &&
    total > 0 &&
    Object.keys(allocations).length,
  );
  const isDirty = Boolean(
    direction !== "ENCAISSEMENT" ||
    thirdPartyId ||
    paymentDate !== today ||
    method !== "Virement" ||
    reference ||
    instrumentNumber ||
    instrumentBank ||
    instrumentDueDate ||
    journalId ||
    cashAccountId ||
    thirdPartyAccountId ||
    Object.keys(allocations).length,
  );
  const closeGuard = useUnsavedChangesGuard(
    open && isDirty && !mutation.isPending,
    onClose,
  );

  return (
    <>
      <Dialog
        open={open}
        onClose={mutation.isPending ? undefined : closeGuard.requestClose}
        fullWidth
        maxWidth="md"
      >
      <DialogTitle>Nouveau règlement</DialogTitle>
      <DialogContent
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 2,
          pt: "12px !important",
        }}
      >
        {error && (
          <Alert severity="error" sx={{ gridColumn: "1 / -1" }}>
            {error}
          </Alert>
        )}
        <TextField
          select
          label="Opération"
          value={direction}
          onChange={(event) =>
            changeDirection(event.target.value as typeof direction)
          }
        >
          <MenuItem value="ENCAISSEMENT">Encaissement client</MenuItem>
          <MenuItem value="DECAISSEMENT">Décaissement fournisseur</MenuItem>
        </TextField>
        <TextField
          select
          label={receipt ? "Client" : "Fournisseur"}
          value={thirdPartyId}
          onChange={(event) => changeParty(event.target.value)}
        >
          <MenuItem value="">Sélectionner…</MenuItem>
          {availableParties.map((party) => (
            <MenuItem key={party.id} value={party.id}>
              {party.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Date"
          type="date"
          value={paymentDate}
          onChange={(event) => setPaymentDate(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          select
          label="Mode"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
        >
          <MenuItem value="Virement">Virement</MenuItem>
          <MenuItem value="Chèque">Chèque</MenuItem>
          <MenuItem value="Espèces">Espèces</MenuItem>
          <MenuItem value="Traite">Traite</MenuItem>
          <MenuItem value="Carte bancaire">Carte bancaire</MenuItem>
        </TextField>
        <TextField
          label="Référence"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
        {isInstrumentMethod(method) && (
          <>
            <TextField
              label={`Numéro ${method.toLowerCase()}`}
              value={instrumentNumber}
              onChange={(event) => setInstrumentNumber(event.target.value)}
            />
            <TextField
              label="Banque tirée"
              value={instrumentBank}
              onChange={(event) => setInstrumentBank(event.target.value)}
            />
            <TextField
              label="Échéance / date de dépôt prévue"
              type="date"
              value={instrumentDueDate}
              onChange={(event) => setInstrumentDueDate(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </>
        )}
        <TextField
          select
          label="Journal banque / caisse"
          value={journalId}
          onChange={(event) => setJournalId(event.target.value)}
        >
          <MenuItem value="">Sélectionner…</MenuItem>
          {paymentJournals.map((journal) => (
            <MenuItem key={journal.id} value={journal.id}>
              {journal.code} — {journal.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Compte banque / caisse"
          value={cashAccountId}
          onChange={(event) => setCashAccountId(event.target.value)}
        >
          <MenuItem value="">Sélectionner…</MenuItem>
          {postingAccounts.map((account) => (
            <MenuItem key={account.id} value={account.id}>
              {account.code} — {account.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Compte tiers"
          value={thirdPartyAccountId}
          onChange={(event) => setThirdPartyAccountId(event.target.value)}
        >
          <MenuItem value="">Sélectionner…</MenuItem>
          {postingAccounts.map((account) => (
            <MenuItem key={account.id} value={account.id}>
              {account.code} — {account.name}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ gridColumn: "1 / -1", mt: 1 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>
            Affectation aux factures
          </Typography>
          {!thirdPartyId && (
            <Typography variant="body2" color="text.secondary">
              Sélectionnez d’abord un tiers.
            </Typography>
          )}
          {thirdPartyId && !openInvoices.length && (
            <Alert severity="info">
              Aucune facture comptabilisée avec un solde ouvert pour ce tiers.
            </Alert>
          )}
          <Stack spacing={1}>
            {openInvoices.map((invoice) => {
              const checked = allocations[invoice.id] !== undefined;
              return (
                <Card
                  key={invoice.id}
                  variant="outlined"
                  sx={{
                    px: 2,
                    py: 1.3,
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "minmax(220px, 1fr) 160px 150px",
                    },
                    gap: 1.5,
                    alignItems: "center",
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={checked}
                        onChange={(event) =>
                          toggleInvoice(invoice, event.target.checked)
                        }
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {invoice.number} — {shortDate(invoice.invoiceDate)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Net {money(invoice.netPayable)}
                        </Typography>
                      </Box>
                    }
                  />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Solde ouvert
                    </Typography>
                    <Typography sx={{ fontWeight: 700 }}>
                      {money(invoice.outstandingAmount)}
                    </Typography>
                  </Box>
                  <TextField
                    size="small"
                    label="Montant affecté"
                    value={allocations[invoice.id] ?? ""}
                    disabled={!checked}
                    onChange={(event) =>
                      setAllocations((current) => ({
                        ...current,
                        [invoice.id]: event.target.value,
                      }))
                    }
                  />
                </Card>
              );
            })}
          </Stack>
        </Box>
        <Card
          sx={{
            gridColumn: "1 / -1",
            p: 2.2,
            bgcolor: "primary.light",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography sx={{ fontWeight: 700 }}>
            Montant total du règlement
          </Typography>
          <Typography variant="h3" sx={{ color: "primary.dark" }}>
            {money(total)}
          </Typography>
        </Card>
      </DialogContent>
      <DialogActions>
        <Button onClick={closeGuard.requestClose}>Annuler</Button>
        <Button
          variant="contained"
          disabled={!valid || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Enregistrement…" : "Créer le règlement"}
        </Button>
      </DialogActions>
      </Dialog>
      <UnsavedChangesDialog guard={closeGuard} />
    </>
  );
}

export function PaymentsPanel({
  organizationId,
  dossierId,
  payments,
  parties,
  invoices,
  accounts,
  journals,
  loading,
  archived,
  canManage,
  canPost,
}: {
  organizationId: string;
  dossierId: string;
  payments: ThirdPartyPayment[];
  parties: ThirdParty[];
  invoices: BusinessInvoice[];
  accounts: LedgerAccount[];
  journals: AccountingJournal[];
  loading: boolean;
  archived: boolean;
  canManage: boolean;
  canPost: boolean;
}) {
  const queryClient = useQueryClient();
  const { showFeedback } = useFeedback();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [correctionFor, setCorrectionFor] =
    useState<ThirdPartyPayment | null>(null);
  const [correction, setCorrection] = useState({
    correctionType: "ANNULATION_SAISIE" as
      | "ANNULATION_SAISIE"
      | "REMBOURSEMENT",
    correctionDate: new Date().toISOString().slice(0, 10),
    reason: "",
  });
  const refreshPaymentData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["third-party-payments", organizationId, dossierId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["business-invoices", organizationId, dossierId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["third-parties", organizationId, dossierId],
      }),
      queryClient.invalidateQueries({ queryKey: ["bank-statements"] }),
      queryClient.invalidateQueries({ queryKey: ["bank-statement"] }),
    ]);
  };
  const post = useMutation({
    mutationFn: (payment: ThirdPartyPayment) =>
      api.post<ThirdPartyPayment>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/payments/${payment.id}/post`,
      ),
    onSuccess: async () => {
      setError("");
      showFeedback("Le règlement a été comptabilisé.");
      await refreshPaymentData();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Comptabilisation impossible.",
      ),
  });
  const instrumentAction = useMutation({
    mutationFn: ({
      payment,
      action,
    }: {
      payment: ThirdPartyPayment;
      action: "deposit" | "clear" | "reject";
    }) =>
      api.post<ThirdPartyPayment>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/payments/${payment.id}/instrument/${action}`,
      ),
    onSuccess: async () => {
      setError("");
      showFeedback("Le statut de l’effet a été mis à jour.");
      await refreshPaymentData();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Action impossible sur cet effet.",
      ),
  });
  const correct = useMutation({
    mutationFn: () =>
      api.post<ThirdPartyPayment>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/payments/${correctionFor?.id}/correct`,
        correction,
      ),
    onSuccess: async () => {
      const label =
        correction.correctionType === "REMBOURSEMENT"
          ? "Le remboursement a été enregistré."
          : "La saisie du règlement a été annulée.";
      setError("");
      showFeedback(label);
      setCorrectionFor(null);
      setCorrection({
        correctionType: "ANNULATION_SAISIE",
        correctionDate: new Date().toISOString().slice(0, 10),
        reason: "",
      });
      await refreshPaymentData();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : "La correction du règlement est impossible.",
      ),
  });
  const openCorrection = (payment: ThirdPartyPayment) => {
    setError("");
    setCorrectionFor(payment);
    setCorrection({
      correctionType: "ANNULATION_SAISIE",
      correctionDate: new Date().toISOString().slice(0, 10),
      reason: "",
    });
  };
  const correctionDirty = Boolean(
    correctionFor &&
      (correction.correctionType !== "ANNULATION_SAISIE" ||
        correction.correctionDate !== new Date().toISOString().slice(0, 10) ||
        correction.reason),
  );
  const correctionCloseGuard = useUnsavedChangesGuard(
    correctionDirty && !correct.isPending,
    () => setCorrectionFor(null),
  );
  const instruments = payments.filter(
    (payment) => payment.instrumentStatus && payment.status !== "ANNULE",
  );
  const columns: Array<{
    status: "RECU" | "DEPOSE" | "ENCAISSE" | "IMPAYE";
    next?: "deposit" | "clear";
    nextLabel?: string;
  }> = [
    { status: "RECU", next: "deposit", nextLabel: "Déposer en banque" },
    { status: "DEPOSE", next: "clear", nextLabel: "Marquer encaissé" },
    { status: "ENCAISSE" },
    { status: "IMPAYE" },
  ];
  return (
    <>
      {Boolean(instruments.length) && (
        <Card sx={{ mb: 2 }}>
          <Box sx={{ p: 2.5 }}>
            <Typography variant="h3">
              Portefeuille chèques &amp; traites
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Suivi Reçu → Déposé en banque → Encaissé ou Impayé.
            </Typography>
          </Box>
          <Box
            sx={{
              px: 2.5,
              pb: 2.5,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
              gap: 1.5,
            }}
          >
            {columns.map((column) => (
              <Box key={column.status}>
                <Chip
                  size="small"
                  label={`${instrumentStatusLabels[column.status]} (${instruments.filter((p) => p.instrumentStatus === column.status).length})`}
                  color={
                    column.status === "IMPAYE"
                      ? "error"
                      : column.status === "ENCAISSE"
                        ? "success"
                        : column.status === "DEPOSE"
                          ? "info"
                          : "default"
                  }
                  sx={{ mb: 1 }}
                />
                <Stack spacing={1}>
                  {instruments
                    .filter(
                      (payment) => payment.instrumentStatus === column.status,
                    )
                    .map((payment) => (
                      <Card key={payment.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Typography sx={{ fontWeight: 700 }}>
                          {payment.thirdParty.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {payment.method}
                          {payment.instrumentNumber
                            ? ` n°${payment.instrumentNumber}`
                            : ""}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {money(payment.amount)}
                        </Typography>
                        {payment.instrumentBank && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block" }}
                          >
                            {payment.instrumentBank}
                          </Typography>
                        )}
                        {payment.instrumentDueDate && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block" }}
                          >
                            Échéance {shortDate(payment.instrumentDueDate)}
                          </Typography>
                        )}
                        {canManage && !archived && column.next && (
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={instrumentAction.isPending}
                              onClick={() =>
                                instrumentAction.mutate({
                                  payment,
                                  action: column.next!,
                                })
                              }
                            >
                              {column.nextLabel}
                            </Button>
                            {column.status === "DEPOSE" && (
                              <Button
                                size="small"
                                color="error"
                                disabled={instrumentAction.isPending}
                                onClick={() =>
                                  instrumentAction.mutate({
                                    payment,
                                    action: "reject",
                                  })
                                }
                              >
                                Impayé
                              </Button>
                            )}
                          </Stack>
                        )}
                      </Card>
                    ))}
                </Stack>
              </Box>
            ))}
          </Box>
        </Card>
      )}
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
            <Typography variant="h3">
              Règlements clients et fournisseurs
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Encaissements, décaissements et lettrage des factures.
            </Typography>
          </Box>
          {canManage && !archived && (
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setOpen(true)}
            >
              Nouveau règlement
            </Button>
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
        {!loading && payments.length === 0 && (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <AccountBalanceWalletOutlined
              sx={{ fontSize: 46, color: "text.disabled" }}
            />
            <Typography sx={{ fontWeight: 700, mt: 1 }}>
              Aucun règlement
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Les règlements seront affectés aux factures comptabilisées.
            </Typography>
          </Box>
        )}
        {payments.map((payment) => (
          <Box
            key={payment.id}
            sx={{
              px: 3,
              py: 2.2,
              borderTop: "1px solid",
              borderColor: "divider",
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(230px, 1fr) 155px 180px auto",
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
                  {payment.thirdParty.name}
                </Typography>
                <Chip
                  size="small"
                  label={
                    payment.direction === "ENCAISSEMENT"
                      ? "Encaissement"
                      : "Décaissement"
                  }
                  color={
                    payment.direction === "ENCAISSEMENT" ? "success" : "warning"
                  }
                  variant="outlined"
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {shortDate(payment.paymentDate)} · {payment.method}
                {payment.reference ? ` · ${payment.reference}` : ""}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Montant
              </Typography>
              <Typography sx={{ fontWeight: 700 }}>
                {money(payment.amount)}
              </Typography>
            </Box>
            <Box>
              <Chip
                size="small"
                label={paymentStatusLabels[payment.status]}
                color={
                  payment.status === "COMPTABILISE" ? "success" : "warning"
                }
                variant="outlined"
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 0.5 }}
              >
                {payment.allocations.length} facture(s) affectée(s)
              </Typography>
              {payment.correctionType && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  {correctionTypeLabels[payment.correctionType]} le{" "}
                  {shortDate(payment.correctionDate)} ·{" "}
                  {payment.correctionReason}
                </Typography>
              )}
            </Box>
            <Stack
              direction="row"
              spacing={1}
              sx={{ justifyContent: { xs: "flex-start", md: "flex-end" } }}
            >
              {canPost && !archived && payment.status === "BROUILLON" && (
                <Button
                  size="small"
                  color="success"
                  variant="contained"
                  startIcon={<PostAddRounded />}
                  disabled={post.isPending}
                  onClick={() => post.mutate(payment)}
                >
                  Comptabiliser
                </Button>
              )}
              {canPost && !archived && payment.status !== "ANNULE" && (
                <Button
                  size="small"
                  color="warning"
                  startIcon={<UndoRounded />}
                  onClick={() => openCorrection(payment)}
                >
                  Corriger
                </Button>
              )}
            </Stack>
          </Box>
        ))}
      </Card>
      {open && (
        <PaymentDialog
          open={open}
          onClose={() => setOpen(false)}
          organizationId={organizationId}
          dossierId={dossierId}
          parties={parties}
          invoices={invoices}
          accounts={accounts}
          journals={journals}
        />
      )}
      <Dialog
        open={Boolean(correctionFor)}
        onClose={
          correct.isPending ? undefined : correctionCloseGuard.requestClose
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Corriger le règlement</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              Le règlement original de {money(correctionFor?.amount)} restera
              visible. Ses affectations seront retirées des factures et son
              écriture sera extournée si elle est comptabilisée. Tout
              rapprochement bancaire associé sera rouvert.
            </Alert>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              select
              label="Type de correction"
              value={correction.correctionType}
              onChange={(event) =>
                setCorrection({
                  ...correction,
                  correctionType: event.target.value as
                    | "ANNULATION_SAISIE"
                    | "REMBOURSEMENT",
                })
              }
            >
              <MenuItem value="ANNULATION_SAISIE">
                Annulation d’une saisie erronée
              </MenuItem>
              <MenuItem
                value="REMBOURSEMENT"
                disabled={correctionFor?.status === "BROUILLON"}
              >
                Remboursement au client ou par le fournisseur
              </MenuItem>
            </TextField>
            <TextField
              type="date"
              label="Date de correction"
              value={correction.correctionDate}
              onChange={(event) =>
                setCorrection({
                  ...correction,
                  correctionDate: event.target.value,
                })
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              multiline
              minRows={3}
              label="Motif obligatoire"
              value={correction.reason}
              onChange={(event) =>
                setCorrection({ ...correction, reason: event.target.value })
              }
              helperText="Précisez l’erreur ou la référence du remboursement pour la piste d’audit."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={correctionCloseGuard.requestClose}>Conserver</Button>
          <Button
            color="warning"
            variant="contained"
            disabled={
              !correction.correctionDate ||
              correction.reason.trim().length < 3 ||
              correct.isPending
            }
            onClick={() => correct.mutate()}
          >
            {correct.isPending ? "Correction…" : "Confirmer la correction"}
          </Button>
        </DialogActions>
      </Dialog>
      <UnsavedChangesDialog guard={correctionCloseGuard} />
    </>
  );
}
