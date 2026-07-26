import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  AccountBalanceOutlined,
  AddRounded,
  AutoAwesomeRounded,
  CheckCircleOutlineRounded,
  CloudUploadOutlined,
  DownloadOutlined,
  LinkRounded,
  PostAddRounded,
  ReceiptLongOutlined,
} from "@mui/icons-material";
import { api, ApiError } from "../../api/client";
import type {
  AccountingJournal,
  BankAccount,
  BankStatement,
  BankTransaction,
  JournalEntry,
  LedgerAccount,
  ThirdPartyPayment,
} from "../../types/api";
import { money, shortDate } from "../accounting/options";

const statementLabels: Record<string, string> = {
  IMPORTE: "Importé",
  PARTIELLEMENT_RAPPROCHE: "Partiellement rapproché",
  PRET_A_VALIDER: "Prêt à valider",
  RAPPROCHE: "Rapproché",
};
const transactionLabels: Record<string, string> = {
  NON_RAPPROCHEE: "À rapprocher",
  ECRITURE_BROUILLON: "Écriture à comptabiliser",
  RAPPROCHEE: "Rapprochée",
};
const matchLabels: Record<string, string> = {
  AUTOMATIQUE: "Automatique",
  REGLEMENT: "Règlement",
  ECRITURE: "Écriture",
  ECRITURE_GENEREE: "Écriture générée",
};
const statusColor = (
  status: string,
): "warning" | "primary" | "success" | "default" =>
  status === "RAPPROCHE" ||
  status === "RAPPROCHEE" ||
  status === "PRET_A_VALIDER"
    ? "success"
    : status === "PARTIELLEMENT_RAPPROCHE" || status === "ECRITURE_BROUILLON"
      ? "primary"
      : "warning";

function BankAccountDialog({
  open,
  onClose,
  organizationId,
  dossierId,
  accounts,
  journals,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  dossierId: string;
  accounts: LedgerAccount[];
  journals: AccountingJournal[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [ledgerAccountId, setLedgerAccountId] = useState("");
  const [journalId, setJournalId] = useState("");
  const [currency, setCurrency] = useState("TND");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      api.post<BankAccount>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/bank-reconciliation/accounts`,
        {
          name: name.trim(),
          bankName: bankName.trim(),
          iban: iban.trim() || undefined,
          ledgerAccountId,
          journalId,
          currency,
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["bank-accounts", organizationId, dossierId],
      });
      onClose();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Impossible de créer ce compte bancaire.",
      ),
  });
  return (
    <Dialog
      open={open}
      onClose={mutation.isPending ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Nouveau compte bancaire</DialogTitle>
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
          label="Nom interne"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Compte principal TND"
        />
        <TextField
          label="Banque"
          value={bankName}
          onChange={(event) => setBankName(event.target.value)}
          placeholder="BIAT, BNA…"
        />
        <TextField
          label="IBAN / RIB"
          value={iban}
          onChange={(event) => setIban(event.target.value)}
          sx={{ gridColumn: "1 / -1" }}
        />
        <TextField
          select
          label="Compte comptable banque"
          value={ledgerAccountId}
          onChange={(event) => setLedgerAccountId(event.target.value)}
        >
          <MenuItem value="">Sélectionner…</MenuItem>
          {accounts
            .filter((account) => account.isActive && account.allowsPosting)
            .map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {account.code} — {account.name}
              </MenuItem>
            ))}
        </TextField>
        <TextField
          select
          label="Journal de banque"
          value={journalId}
          onChange={(event) => setJournalId(event.target.value)}
        >
          <MenuItem value="">Sélectionner…</MenuItem>
          {journals
            .filter((journal) => journal.type === "BANQUE")
            .map((journal) => (
              <MenuItem key={journal.id} value={journal.id}>
                {journal.code} — {journal.name}
              </MenuItem>
            ))}
        </TextField>
        <TextField
          select
          label="Devise"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
        >
          <MenuItem value="TND">TND</MenuItem>
          <MenuItem value="EUR">EUR</MenuItem>
          <MenuItem value="USD">USD</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          disabled={
            !name.trim() ||
            !bankName.trim() ||
            !ledgerAccountId ||
            !journalId ||
            mutation.isPending
          }
          onClick={() => mutation.mutate()}
        >
          Créer
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ImportDialog({
  open,
  onClose,
  organizationId,
  dossierId,
  bankAccounts,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  dossierId: string;
  bankAccounts: BankAccount[];
}) {
  const queryClient = useQueryClient();
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState(first);
  const [periodEnd, setPeriodEnd] = useState(last);
  const [openingBalance, setOpeningBalance] = useState("0.000");
  const [closingBalance, setClosingBalance] = useState("0.000");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      const body = new FormData();
      body.append("bankAccountId", bankAccountId);
      body.append("periodStart", periodStart);
      body.append("periodEnd", periodEnd);
      body.append("openingBalance", openingBalance);
      body.append("closingBalance", closingBalance);
      if (file) body.append("file", file);
      return api.upload<BankStatement>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/bank-reconciliation/statements/import`,
        body,
      );
    },
    onSuccess: async (statement) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["bank-statements", organizationId, dossierId],
        }),
        queryClient.setQueryData(
          ["bank-statement", organizationId, dossierId, statement.id],
          statement,
        ),
      ]);
      onClose();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError ? reason.message : "Import impossible.",
      ),
  });
  const downloadTemplate = () => {
    const content = [
      "Date;Libellé;Référence;Débit;Crédit;Solde",
      "01/01/2026;Exemple virement;REF-001;;1000,000;1000,000",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "modele-releve-bancaire.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Dialog
      open={open}
      onClose={mutation.isPending ? undefined : onClose}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>Importer un relevé bancaire</DialogTitle>
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
          label="Compte bancaire"
          value={bankAccountId}
          onChange={(event) => setBankAccountId(event.target.value)}
          sx={{ gridColumn: "1 / -1" }}
        >
          {bankAccounts.map((account) => (
            <MenuItem key={account.id} value={account.id}>
              {account.name} — {account.bankName}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Début de période"
          type="date"
          value={periodStart}
          onChange={(event) => setPeriodStart(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Fin de période"
          type="date"
          value={periodEnd}
          onChange={(event) => setPeriodEnd(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Solde initial"
          value={openingBalance}
          onChange={(event) => setOpeningBalance(event.target.value)}
        />
        <TextField
          label="Solde final"
          value={closingBalance}
          onChange={(event) => setClosingBalance(event.target.value)}
        />
        <Box
          sx={{
            gridColumn: "1 / -1",
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 3,
            p: 3,
            textAlign: "center",
          }}
        >
          <Button
            component="label"
            variant="outlined"
            startIcon={<CloudUploadOutlined />}
          >
            {file ? file.name : "Choisir un fichier CSV ou XLSX"}
            <input
              hidden
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Button>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1 }}
          >
            Colonnes requises : Date, Libellé et Montant — ou Débit/Crédit.
            Taille maximale 10 Mo.
          </Typography>
          <Button
            size="small"
            startIcon={<DownloadOutlined />}
            onClick={downloadTemplate}
            sx={{ mt: 1 }}
          >
            Télécharger le modèle CSV
          </Button>
        </Box>
        <Alert severity="info" sx={{ gridColumn: "1 / -1" }}>
          Le solde final doit être égal au solde initial plus la somme des
          opérations du fichier.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          disabled={
            !bankAccountId ||
            !periodStart ||
            !periodEnd ||
            !file ||
            mutation.isPending
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Import en cours…" : "Importer"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type MatchMode = "payment" | "entry" | "generate";
function MatchDialog({
  mode,
  transaction,
  statement,
  onClose,
  organizationId,
  dossierId,
  payments,
  entries,
  accounts,
}: {
  mode: MatchMode;
  transaction: BankTransaction;
  statement: BankStatement;
  onClose: () => void;
  organizationId: string;
  dossierId: string;
  payments: ThirdPartyPayment[];
  entries: JournalEntry[];
  accounts: LedgerAccount[];
}) {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState("");
  const [description, setDescription] = useState(transaction.description);
  const [reference, setReference] = useState(transaction.reference ?? "");
  const [error, setError] = useState("");
  const amount = Number(transaction.amount);
  const absolute = Math.abs(amount);
  const paymentCandidates = payments.filter(
    (payment) =>
      payment.status === "COMPTABILISE" &&
      payment.direction === (amount > 0 ? "ENCAISSEMENT" : "DECAISSEMENT") &&
      Math.abs(Number(payment.amount) - absolute) < 0.0005,
  );
  const entryCandidates = entries.filter(
    (entry) =>
      entry.status === "COMPTABILISEE" &&
      entry.lines.some(
        (line) =>
          line.accountId === statement.bankAccount.ledgerAccountId &&
          Math.abs(Number(line.debit) - Number(line.credit) - amount) < 0.0005,
      ),
  );
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["bank-statement", organizationId, dossierId, statement.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ["bank-statements", organizationId, dossierId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["journal-entries", organizationId, dossierId],
      }),
    ]);
    onClose();
  };
  const mutation = useMutation({
    mutationFn: () => {
      const base = `/api/organizations/${organizationId}/dossiers/${dossierId}/bank-reconciliation/transactions/${transaction.id}`;
      if (mode === "payment")
        return api.post(`${base}/match-payment`, { paymentId: selection });
      if (mode === "entry")
        return api.post(`${base}/match-entry`, { journalEntryId: selection });
      return api.post(`${base}/generate-entry`, {
        counterpartAccountId: selection,
        description: description.trim() || undefined,
        pieceReference: reference.trim() || undefined,
      });
    },
    onSuccess: refresh,
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Rapprochement impossible.",
      ),
  });
  const title =
    mode === "payment"
      ? "Rapprocher avec un règlement"
      : mode === "entry"
        ? "Rapprocher avec une écriture"
        : "Générer une écriture comptable";
  return (
    <Dialog
      open
      onClose={mutation.isPending ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
        {error && <Alert severity="error">{error}</Alert>}
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 900 }}>
            {transaction.description}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {shortDate(transaction.transactionDate)} ·{" "}
            {transaction.reference || "Sans référence"}
          </Typography>
          <Typography
            sx={{
              fontWeight: 900,
              mt: 1,
              color: amount > 0 ? "success.dark" : "error.dark",
            }}
          >
            {money(transaction.amount)}
          </Typography>
        </Card>
        {mode === "payment" && (
          <TextField
            select
            label="Règlement comptabilisé"
            value={selection}
            onChange={(event) => setSelection(event.target.value)}
          >
            <MenuItem value="">Sélectionner…</MenuItem>
            {paymentCandidates.map((payment) => (
              <MenuItem key={payment.id} value={payment.id}>
                {payment.thirdParty.name} — {shortDate(payment.paymentDate)} —{" "}
                {money(payment.amount)}
                {payment.reference ? ` — ${payment.reference}` : ""}
              </MenuItem>
            ))}
          </TextField>
        )}
        {mode === "entry" && (
          <TextField
            select
            label="Écriture comptabilisée"
            value={selection}
            onChange={(event) => setSelection(event.target.value)}
          >
            <MenuItem value="">Sélectionner…</MenuItem>
            {entryCandidates.map((entry) => (
              <MenuItem key={entry.id} value={entry.id}>
                {entry.pieceReference} — {shortDate(entry.entryDate)} —{" "}
                {entry.description}
              </MenuItem>
            ))}
          </TextField>
        )}
        {mode === "generate" && (
          <>
            <TextField
              select
              label="Compte de contrepartie"
              value={selection}
              onChange={(event) => setSelection(event.target.value)}
            >
              <MenuItem value="">Sélectionner…</MenuItem>
              {accounts
                .filter(
                  (account) =>
                    account.isActive &&
                    account.allowsPosting &&
                    account.id !== statement.bankAccount.ledgerAccountId,
                )
                .map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.code} — {account.name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Description de l’écriture"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <TextField
              label="Référence pièce"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
            <Alert severity="info">
              L’écriture sera créée en brouillon. Elle devra être comptabilisée
              avant le rapprochement définitif.
            </Alert>
          </>
        )}
        {((mode === "payment" && !paymentCandidates.length) ||
          (mode === "entry" && !entryCandidates.length)) && (
          <Alert severity="warning">
            Aucun élément comptabilisé avec le même sens et le même montant.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          disabled={!selection || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mode === "generate" ? "Générer le brouillon" : "Rapprocher"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function DossierBankReconciliationPanel({
  organizationId,
  dossierId,
  archived,
  canManage,
  canValidate,
  canAccountsView,
  canAccountingView,
  canAccountingPost,
  canPaymentsView,
}: {
  organizationId: string;
  dossierId: string;
  archived: boolean;
  canManage: boolean;
  canValidate: boolean;
  canAccountsView: boolean;
  canAccountingView: boolean;
  canAccountingPost: boolean;
  canPaymentsView: boolean;
}) {
  const queryClient = useQueryClient();
  const [accountOpen, setAccountOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [match, setMatch] = useState<{
    mode: MatchMode;
    transaction: BankTransaction;
  } | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("TOUTES");
  const bankAccounts = useQuery({
    queryKey: ["bank-accounts", organizationId, dossierId],
    queryFn: () =>
      api.get<BankAccount[]>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/bank-reconciliation/accounts`,
      ),
  });
  const statements = useQuery({
    queryKey: ["bank-statements", organizationId, dossierId],
    queryFn: () =>
      api.get<BankStatement[]>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/bank-reconciliation/statements`,
      ),
  });
  const statement = useQuery({
    queryKey: ["bank-statement", organizationId, dossierId, selectedId],
    queryFn: () =>
      api.get<BankStatement>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/bank-reconciliation/statements/${selectedId}`,
      ),
    enabled: Boolean(selectedId),
  });
  const accounts = useQuery({
    queryKey: ["ledger-accounts", organizationId, dossierId],
    queryFn: () =>
      api.get<LedgerAccount[]>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/ledger-accounts`,
      ),
    enabled: canAccountsView,
  });
  const journals = useQuery({
    queryKey: ["journals", organizationId, dossierId],
    queryFn: () =>
      api.get<AccountingJournal[]>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/journals`,
      ),
    enabled: canAccountingView,
  });
  const entries = useQuery({
    queryKey: ["journal-entries", organizationId, dossierId],
    queryFn: () =>
      api.get<JournalEntry[]>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/entries`,
      ),
    enabled: canAccountingView,
  });
  const payments = useQuery({
    queryKey: ["third-party-payments", organizationId, dossierId],
    queryFn: () =>
      api.get<ThirdPartyPayment[]>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/payments`,
      ),
    enabled: canPaymentsView,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["bank-statements", organizationId, dossierId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["bank-statement", organizationId, dossierId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["journal-entries", organizationId, dossierId],
      }),
    ]);
  };
  const action = useMutation({
    mutationFn: async ({ type, transaction }: { type: "auto" | "reconcile" | "post-generated"; transaction?: BankTransaction }) => {
      if (!statement.data) return;
      const base = `/api/organizations/${organizationId}/dossiers/${dossierId}`;
      if (type === "auto")
        return api.post(
          `${base}/bank-reconciliation/statements/${statement.data.id}/auto-match`,
        );
      if (type === "reconcile")
        return api.post(
          `${base}/bank-reconciliation/statements/${statement.data.id}/reconcile`,
        );
      if (!transaction?.journalEntryId) return;
      await api.post(`${base}/entries/${transaction.journalEntryId}/post`);
      return api.post(
        `${base}/bank-reconciliation/transactions/${transaction.id}/match-entry`,
        { journalEntryId: transaction.journalEntryId },
      );
    },
    onSuccess: async () => {
      setError("");
      await refresh();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError ? reason.message : "Action impossible.",
      ),
  });
  const selected = statement.data;
  const filteredTransactions = (selected?.transactions ?? []).filter(
    (transaction) => filter === "TOUTES" || transaction.status === filter,
  );
  const totalMovement = useMemo(
    () =>
      (selected?.transactions ?? []).reduce(
        (sum, transaction) => sum + Number(transaction.amount),
        0,
      ),
    [selected?.transactions],
  );
  return (
    <>
      <Stack spacing={2}>
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
                Rapprochement bancaire
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Importez les relevés, rapprochez chaque ligne et contrôlez
                l’écart comptable.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              {canManage && !archived && (
                <Button
                  variant="outlined"
                  startIcon={<AddRounded />}
                  disabled={!canAccountsView || !canAccountingView}
                  onClick={() => setAccountOpen(true)}
                >
                  Compte bancaire
                </Button>
              )}
              {canManage && !archived && (
                <Button
                  variant="contained"
                  startIcon={<CloudUploadOutlined />}
                  disabled={!bankAccounts.data?.length}
                  onClick={() => setImportOpen(true)}
                >
                  Importer un relevé
                </Button>
              )}
            </Stack>
          </Box>
          {error && (
            <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>
              {error}
            </Alert>
          )}
          {bankAccounts.isLoading && (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <Skeleton height={70} />
            </Box>
          )}
          {bankAccounts.data?.length ? (
            <Box
              sx={{
                px: 2.5,
                pb: 2.5,
                display: "flex",
                gap: 1.5,
                overflowX: "auto",
              }}
            >
              {bankAccounts.data.map((account) => (
                <Card
                  key={account.id}
                  variant="outlined"
                  sx={{ p: 1.8, minWidth: 250 }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center" }}
                  >
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 3,
                        bgcolor: "primary.light",
                        color: "primary.main",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <AccountBalanceOutlined />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 900 }}>
                        {account.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {account.bankName} · {account.currency}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1 }}
                  >
                    {account.iban || "IBAN non renseigné"}
                  </Typography>
                  <Typography variant="caption">
                    {account.ledgerAccount.code} — {account.journal.code}
                  </Typography>
                </Card>
              ))}
            </Box>
          ) : (
            !bankAccounts.isLoading && (
              <Alert severity="info" sx={{ mx: 2.5, mb: 2 }}>
                Créez un compte bancaire lié à un compte comptable et à un
                journal de banque.
              </Alert>
            )
          )}
        </Card>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", xl: "340px minmax(0,1fr)" },
            gap: 2,
          }}
        >
          <Card sx={{ alignSelf: "start" }}>
            <Box sx={{ p: 2.2 }}>
              <Typography sx={{ fontWeight: 900 }}>Relevés importés</Typography>
            </Box>
            {statements.isLoading && (
              <Box sx={{ p: 2 }}>
                <Skeleton height={65} />
                <Skeleton height={65} />
              </Box>
            )}
            {!statements.isLoading && !statements.data?.length && (
              <Box sx={{ p: 4, textAlign: "center" }}>
                <ReceiptLongOutlined
                  sx={{ fontSize: 40, color: "text.disabled" }}
                />
                <Typography variant="body2" color="text.secondary">
                  Aucun relevé importé.
                </Typography>
              </Box>
            )}
            {statements.data?.map((item) => (
              <Button
                key={item.id}
                fullWidth
                onClick={() => setSelectedId(item.id)}
                sx={{
                  px: 2.2,
                  py: 1.7,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  borderRadius: 0,
                  justifyContent: "flex-start",
                  textAlign: "left",
                  bgcolor:
                    selectedId === item.id ? "primary.light" : "transparent",
                }}
              >
                <Box sx={{ width: "100%" }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 900 }}>
                      {item.bankAccount.name}
                    </Typography>
                    <Chip
                      label={statementLabels[item.status]}
                      size="small"
                      color={statusColor(item.status)}
                      variant="outlined"
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {shortDate(item.periodStart)} → {shortDate(item.periodEnd)}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Solde final <strong>{money(item.closingBalance)}</strong>
                  </Typography>
                </Box>
              </Button>
            ))}
          </Card>
          <Box>
            {!selectedId && (
              <Card sx={{ p: 7, textAlign: "center" }}>
                <ReceiptLongOutlined
                  sx={{ fontSize: 48, color: "text.disabled" }}
                />
                <Typography sx={{ fontWeight: 900, mt: 1 }}>
                  Sélectionnez un relevé
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ses opérations et les actions de rapprochement apparaîtront
                  ici.
                </Typography>
              </Card>
            )}
            {selectedId && statement.isLoading && (
              <Card sx={{ p: 3 }}>
                <Skeleton height={100} />
                <Skeleton height={300} />
              </Card>
            )}
            {selected && (
              <Stack spacing={2}>
                <Card>
                  <Box sx={{ p: 2.5 }}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      sx={{
                        justifyContent: "space-between",
                        alignItems: { md: "center" },
                      }}
                    >
                      <Box>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: "center", flexWrap: "wrap" }}
                        >
                          <Typography variant="h3" sx={{ fontSize: 23 }}>
                            {selected.bankAccount.name}
                          </Typography>
                          <Chip
                            label={statementLabels[selected.status]}
                            color={statusColor(selected.status)}
                            variant="outlined"
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {shortDate(selected.periodStart)} au{" "}
                          {shortDate(selected.periodEnd)} ·{" "}
                          {selected.sourceFileName}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        {canManage &&
                          !archived &&
                          selected.status !== "RAPPROCHE" && (
                            <Button
                              startIcon={<AutoAwesomeRounded />}
                              onClick={() => action.mutate({ type: "auto" })}
                            >
                              Rapprochement auto
                            </Button>
                          )}
                        {canValidate &&
                          !archived &&
                          selected.status === "PRET_A_VALIDER" && (
                            <Button
                              variant="contained"
                              color="success"
                              startIcon={<CheckCircleOutlineRounded />}
                              onClick={() => action.mutate({ type: "reconcile" })}
                            >
                              Valider le relevé
                            </Button>
                          )}
                      </Stack>
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "1fr 1fr",
                          md: "repeat(6, 1fr)",
                        },
                        gap: 1.3,
                      }}
                    >
                      {[
                        ["Solde initial", selected.openingBalance],
                        ["Mouvements", totalMovement.toFixed(3)],
                        ["Solde bancaire", selected.closingBalance],
                        ["Solde comptable", selected.currentBookClosingBalance],
                        ["Écart", selected.currentDifference],
                        [
                          "Rapprochées",
                          `${selected.matchedCount ?? 0}/${selected.rowCount}`,
                        ],
                      ].map(([label, value], index) => (
                        <Card key={label} variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {label}
                          </Typography>
                          <Typography
                            sx={{
                              fontWeight: 900,
                              color:
                                index === 4 && Number(value) !== 0
                                  ? "error.dark"
                                  : "text.primary",
                            }}
                          >
                            {index === 5 ? value : money(value)}
                          </Typography>
                        </Card>
                      ))}
                    </Box>
                  </Box>
                </Card>
                <Card>
                  <Box
                    sx={{
                      p: 2,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 1,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography sx={{ fontWeight: 900 }}>
                      Opérations du relevé
                    </Typography>
                    <TextField
                      select
                      size="small"
                      label="Filtre"
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                      sx={{ minWidth: 175 }}
                    >
                      <MenuItem value="TOUTES">Toutes</MenuItem>
                      <MenuItem value="NON_RAPPROCHEE">À rapprocher</MenuItem>
                      <MenuItem value="ECRITURE_BROUILLON">
                        Écriture brouillon
                      </MenuItem>
                      <MenuItem value="RAPPROCHEE">Rapprochées</MenuItem>
                    </TextField>
                  </Box>
                  {filteredTransactions.map((transaction) => (
                    <Box
                      key={transaction.id}
                      sx={{
                        px: 2.5,
                        py: 1.8,
                        borderTop: "1px solid",
                        borderColor: "divider",
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "1fr",
                          lg: "115px minmax(230px,1fr) 140px 175px auto",
                        },
                        gap: 1.5,
                        alignItems: "center",
                      }}
                    >
                      <Typography variant="body2">
                        {shortDate(transaction.transactionDate)}
                      </Typography>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {transaction.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {transaction.reference || "Sans référence"}
                          {transaction.matchType
                            ? ` · ${matchLabels[transaction.matchType]}`
                            : ""}
                          {transaction.matchConfidence
                            ? ` · ${transaction.matchConfidence}%`
                            : ""}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontWeight: 900,
                          color:
                            Number(transaction.amount) > 0
                              ? "success.dark"
                              : "error.dark",
                        }}
                      >
                        {money(transaction.amount)}
                      </Typography>
                      <Chip
                        label={transactionLabels[transaction.status]}
                        size="small"
                        color={statusColor(transaction.status)}
                        variant="outlined"
                      />
                      <Stack
                        direction="row"
                        spacing={0.4}
                        sx={{
                          justifyContent: { lg: "flex-end" },
                          flexWrap: "wrap",
                        }}
                      >
                        {canManage &&
                          !archived &&
                          transaction.status === "NON_RAPPROCHEE" &&
                          canPaymentsView && (
                            <Tooltip title="Associer un règlement">
                              <IconButton
                                onClick={() =>
                                  setMatch({ mode: "payment", transaction })
                                }
                              >
                                <LinkRounded />
                              </IconButton>
                            </Tooltip>
                          )}
                        {canManage &&
                          !archived &&
                          transaction.status === "NON_RAPPROCHEE" &&
                          canAccountingView && (
                            <Tooltip title="Associer une écriture">
                              <IconButton
                                onClick={() =>
                                  setMatch({ mode: "entry", transaction })
                                }
                              >
                                <PostAddRounded />
                              </IconButton>
                            </Tooltip>
                          )}
                        {canManage &&
                          !archived &&
                          transaction.status === "NON_RAPPROCHEE" &&
                          canAccountsView && (
                            <Button
                              size="small"
                              onClick={() =>
                                setMatch({ mode: "generate", transaction })
                              }
                            >
                              Créer écriture
                            </Button>
                          )}
                        {canManage &&
                          canAccountingPost &&
                          !archived &&
                          transaction.status === "ECRITURE_BROUILLON" && (
                            <Button
                              size="small"
                              color="success"
                              variant="contained"
                              onClick={() => action.mutate({ type: "post-generated", transaction })}
                            >
                              Comptabiliser & rapprocher
                            </Button>
                          )}
                      </Stack>
                    </Box>
                  ))}
                  {!filteredTransactions.length && (
                    <Box sx={{ p: 4, textAlign: "center" }}>
                      <Typography color="text.secondary">
                        Aucune opération dans ce filtre.
                      </Typography>
                    </Box>
                  )}
                </Card>
              </Stack>
            )}
          </Box>
        </Box>
      </Stack>
      {accountOpen && (
        <BankAccountDialog
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          organizationId={organizationId}
          dossierId={dossierId}
          accounts={accounts.data ?? []}
          journals={journals.data ?? []}
        />
      )}
      {importOpen && (
        <ImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          organizationId={organizationId}
          dossierId={dossierId}
          bankAccounts={bankAccounts.data ?? []}
        />
      )}
      {match && selected && (
        <MatchDialog
          mode={match.mode}
          transaction={match.transaction}
          statement={selected}
          onClose={() => setMatch(null)}
          organizationId={organizationId}
          dossierId={dossierId}
          payments={payments.data ?? []}
          entries={entries.data ?? []}
          accounts={accounts.data ?? []}
        />
      )}
    </>
  );
}
