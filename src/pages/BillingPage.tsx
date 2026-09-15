import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  CancelOutlined,
  EditOutlined,
  HistoryOutlined,
  MarkEmailReadOutlined,
  PaymentsOutlined,
  PictureAsPdfOutlined,
  UndoRounded,
} from "@mui/icons-material";
import { api, downloadApiFile } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  DossierSelector,
  MetricCard,
  Money,
  QueryState,
} from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";
import type { BillingSummary } from "../types/api";
import { useDossierSelection } from "../hooks/useDossierSelection";
import { useFeedback } from "../feedback/useFeedback";
import { UnsavedChangesDialog } from "../components/UnsavedChangesDialog";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";
interface Invoice {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  description: string;
  netAmount: string;
  vatRate: string;
  vatAmount: string;
  stampDuty: string;
  totalAmount: string;
  paidAmount: string;
  status: string;
  notes: string | null;
}
interface CabinetPayment {
  id: string;
  paymentDate: string;
  amount: string;
  reference: string | null;
  correctionType: "ANNULATION_SAISIE" | "REMBOURSEMENT" | null;
  correctionDate: string | null;
  correctionReason: string | null;
}
const statusLabels: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  PARTIELLEMENT_PAYEE: "Partiellement payée",
  PAYEE: "Payée",
  EN_RETARD: "En retard",
  ANNULEE: "Annulée",
};
export function BillingPage() {
  const { organization, can } = useAuth();
  const qc = useQueryClient();
  const { showFeedback } = useFeedback();
  const [dossierId, setDossierId] = useDossierSelection();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [cancelFor, setCancelFor] = useState<Invoice | null>(null);
  const [paymentFor, setPaymentFor] = useState<Invoice | null>(null);
  const [historyFor, setHistoryFor] = useState<Invoice | null>(null);
  const [correctionFor, setCorrectionFor] = useState<CabinetPayment | null>(
    null,
  );
  const today = new Date().toISOString().slice(0, 10);
  const [invoice, setInvoice] = useState({
    issueDate: today,
    dueDate: today,
    description: "Honoraires comptables",
    netAmount: "",
    vatRate: "0.19",
    stampDuty: "1.000",
    notes: "",
  });
  const [initialInvoice, setInitialInvoice] = useState(invoice);
  const [payment, setPayment] = useState({
    paymentDate: today,
    amount: "",
    reference: "",
  });
  const [initialPayment, setInitialPayment] = useState(payment);
  const [correction, setCorrection] = useState({
    correctionType: "ANNULATION_SAISIE" as
      | "ANNULATION_SAISIE"
      | "REMBOURSEMENT",
    correctionDate: today,
    reason: "",
  });
  const [initialCorrection, setInitialCorrection] = useState(correction);
  const base = organization?.id ? `/api/organizations/${organization.id}` : "";
  const summary = useQuery({
    queryKey: ["billing-summary", organization?.id],
    queryFn: () => api.get<BillingSummary>(`${base}/billing/summary`),
    enabled: Boolean(base),
  });
  const invoices = useQuery({
    queryKey: ["cabinet-invoices", organization?.id, dossierId],
    queryFn: () => api.get<Invoice[]>(`${base}/dossiers/${dossierId}/invoices`),
    enabled: Boolean(base && dossierId),
  });
  const invoicePayments = useQuery({
    queryKey: [
      "cabinet-invoice-payments",
      organization?.id,
      dossierId,
      historyFor?.id,
    ],
    queryFn: () =>
      api.get<CabinetPayment[]>(
        `${base}/dossiers/${dossierId}/invoices/${historyFor?.id}/payments`,
      ),
    enabled: Boolean(base && dossierId && historyFor),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["billing-summary"] });
    void qc.invalidateQueries({ queryKey: ["cabinet-invoices"] });
  };
  const closeInvoiceEditor = () => {
    setCreateOpen(false);
    setEditingInvoice(null);
  };
  const save = useMutation({
    mutationFn: () => {
      const path = `${base}/dossiers/${dossierId}/invoices${editingInvoice ? `/${editingInvoice.id}` : ""}`;
      return editingInvoice ? api.put(path, invoice) : api.post(path, invoice);
    },
    onSuccess: () => {
      const message = editingInvoice
        ? "La facture d’honoraires a été modifiée."
        : "La facture d’honoraires a été créée en brouillon.";
      closeInvoiceEditor();
      refresh();
      showFeedback(message);
    },
  });
  const send = useMutation({
    mutationFn: (id: string) =>
      api.post(`${base}/dossiers/${dossierId}/invoices/${id}/send`),
    onSuccess: () => {
      refresh();
      showFeedback("La facture a été émise.");
    },
  });
  const pay = useMutation({
    mutationFn: () =>
      api.post(
        `${base}/dossiers/${dossierId}/invoices/${paymentFor?.id}/payments`,
        payment,
      ),
    onSuccess: () => {
      setPaymentFor(null);
      refresh();
      showFeedback("Le règlement a été enregistré.");
    },
  });
  const correctPayment = useMutation({
    mutationFn: () =>
      api.post(
        `${base}/dossiers/${dossierId}/invoices/${historyFor?.id}/payments/${correctionFor?.id}/correct`,
        correction,
      ),
    onSuccess: () => {
      setCorrectionFor(null);
      setCorrection({
        correctionType: "ANNULATION_SAISIE",
        correctionDate: today,
        reason: "",
      });
      void qc.invalidateQueries({ queryKey: ["cabinet-invoice-payments"] });
      refresh();
      showFeedback("La correction du règlement a été enregistrée.");
    },
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      api.post(`${base}/dossiers/${dossierId}/invoices/${id}/cancel`),
    onSuccess: () => {
      setCancelFor(null);
      refresh();
      showFeedback("La facture a été annulée sans supprimer son historique.");
    },
  });
  const openCreate = () => {
    setEditingInvoice(null);
    const values = {
      issueDate: today,
      dueDate: today,
      description: "Honoraires comptables",
      netAmount: "",
      vatRate: "0.19",
      stampDuty: "1.000",
      notes: "",
    };
    setInvoice(values);
    setInitialInvoice(values);
    setCreateOpen(true);
  };
  const openEdit = (item: Invoice) => {
    setEditingInvoice(item);
    const values = {
      issueDate: item.issueDate,
      dueDate: item.dueDate,
      description: item.description,
      netAmount: item.netAmount,
      vatRate: item.vatRate,
      stampDuty: item.stampDuty,
      notes: item.notes ?? "",
    };
    setInvoice(values);
    setInitialInvoice(values);
    setCreateOpen(true);
  };
  const openPayment = (item: Invoice) => {
    setPaymentFor(item);
    const values = {
      paymentDate: today,
      amount: (Number(item.totalAmount) - Number(item.paidAmount)).toFixed(3),
      reference: "",
    };
    setPayment(values);
    setInitialPayment(values);
  };
  const openCorrection = (item: CabinetPayment) => {
    setCorrectionFor(item);
    const values = {
      correctionType: "ANNULATION_SAISIE",
      correctionDate: today,
      reason: "",
    } as typeof correction;
    setCorrection(values);
    setInitialCorrection(values);
  };
  const invoiceDirty =
    createOpen && JSON.stringify(invoice) !== JSON.stringify(initialInvoice);
  const paymentDirty =
    Boolean(paymentFor) &&
    JSON.stringify(payment) !== JSON.stringify(initialPayment);
  const correctionDirty =
    Boolean(correctionFor) &&
    JSON.stringify(correction) !== JSON.stringify(initialCorrection);
  const closeActiveForm = () => {
    if (correctionFor) setCorrectionFor(null);
    else if (paymentFor) setPaymentFor(null);
    else if (createOpen) closeInvoiceEditor();
  };
  const formCloseGuard = useUnsavedChangesGuard(
    (invoiceDirty || paymentDirty || correctionDirty) &&
      !save.isPending &&
      !pay.isPending &&
      !correctPayment.isPending,
    closeActiveForm,
  );
  const error =
    save.error ??
    send.error ??
    pay.error ??
    cancel.error ??
    correctPayment.error;
  return (
    <>
      <PageHeader
        eyebrow="Facturation du cabinet"
        title="Honoraires clients"
        description="Facturez les prestations du cabinet, suivez les échéances et enregistrez chaque encaissement."
        action={
          <Stack direction="row" spacing={1}>
            <DossierSelector value={dossierId} onChange={setDossierId} />
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              disabled={!dossierId || !can("billing.manage")}
              onClick={openCreate}
            >
              Nouvelle facture
            </Button>
          </Stack>
        }
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : "Erreur"}
        </Alert>
      )}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        <MetricCard
          label="Facturé"
          value={<Money value={summary.data?.billed} />}
        />
        <MetricCard
          label="Encaissé"
          value={<Money value={summary.data?.paid} />}
        />
        <MetricCard
          label="Reste à encaisser"
          value={<Money value={summary.data?.outstanding} />}
        />
      </Stack>
      <Card>
        <CardContent>
          <QueryState
            loading={invoices.isLoading}
            error={invoices.isError}
            empty={!invoices.data?.length}
            emptyText={
              dossierId
                ? "Aucune facture d’honoraires."
                : "Choisissez un dossier."
            }
          />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Facture</TableCell>
                <TableCell>Prestation</TableCell>
                <TableCell>Échéance</TableCell>
                <TableCell align="right">HT</TableCell>
                <TableCell align="right">Total TTC</TableCell>
                <TableCell align="right">Payé</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.data?.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <b>{i.number}</b>
                    <Typography variant="caption" sx={{ display: "block" }}>
                      {i.issueDate}
                    </Typography>
                  </TableCell>
                  <TableCell>{i.description}</TableCell>
                  <TableCell>{i.dueDate}</TableCell>
                  <TableCell align="right">
                    <Money value={i.netAmount} />
                  </TableCell>
                  <TableCell align="right">
                    <Money value={i.totalAmount} />
                  </TableCell>
                  <TableCell align="right">
                    <Money value={i.paidAmount} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={statusLabels[i.status] ?? i.status}
                      color={
                        i.status === "PAYEE"
                          ? "success"
                          : i.status === "EN_RETARD"
                            ? "error"
                            : "default"
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}
                    >
                      {i.status === "BROUILLON" && can("billing.manage") && (
                        <Button
                          size="small"
                          startIcon={<EditOutlined />}
                          onClick={() => openEdit(i)}
                        >
                          Modifier
                        </Button>
                      )}
                      {i.status === "BROUILLON" && can("billing.manage") && (
                        <Button
                          size="small"
                          startIcon={<MarkEmailReadOutlined />}
                          onClick={() => send.mutate(i.id)}
                        >
                          Émettre
                        </Button>
                      )}
                      <Button
                        size="small"
                        startIcon={<PictureAsPdfOutlined />}
                        onClick={() =>
                          void downloadApiFile(
                            `${base}/dossiers/${dossierId}/invoices/${i.id}/pdf`,
                            `${i.number}.pdf`,
                          )
                        }
                      >
                        PDF
                      </Button>
                      {can("billing.manage") &&
                        !["BROUILLON", "PAYEE", "ANNULEE"].includes(
                          i.status,
                        ) && (
                          <Button
                            size="small"
                            startIcon={<PaymentsOutlined />}
                            onClick={() => openPayment(i)}
                          >
                            Encaisser
                          </Button>
                        )}
                      {i.status !== "BROUILLON" &&
                        i.status !== "ANNULEE" && (
                          <Button
                            size="small"
                            startIcon={<HistoryOutlined />}
                            onClick={() => setHistoryFor(i)}
                          >
                            Règlements
                          </Button>
                        )}
                      {can("billing.manage") &&
                        !["PAYEE", "PARTIELLEMENT_PAYEE", "ANNULEE"].includes(
                          i.status,
                        ) && (
                          <Button
                            size="small"
                            color="error"
                            startIcon={<CancelOutlined />}
                            onClick={() => setCancelFor(i)}
                          >
                            Annuler
                          </Button>
                        )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog
        open={createOpen}
        onClose={save.isPending ? undefined : formCloseGuard.requestClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editingInvoice
            ? `Modifier ${editingInvoice.number}`
            : "Nouvelle facture d’honoraires"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                type="date"
                label="Date"
                value={invoice.issueDate}
                onChange={(e) =>
                  setInvoice({ ...invoice, issueDate: e.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth
                type="date"
                label="Échéance"
                value={invoice.dueDate}
                onChange={(e) =>
                  setInvoice({ ...invoice, dueDate: e.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            <TextField
              label="Prestation"
              value={invoice.description}
              onChange={(e) =>
                setInvoice({ ...invoice, description: e.target.value })
              }
            />
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="Montant HT"
                value={invoice.netAmount}
                onChange={(e) =>
                  setInvoice({ ...invoice, netAmount: e.target.value })
                }
              />
              <TextField
                fullWidth
                label="TVA (décimal)"
                value={invoice.vatRate}
                onChange={(e) =>
                  setInvoice({ ...invoice, vatRate: e.target.value })
                }
              />
              <TextField
                fullWidth
                label="Timbre"
                value={invoice.stampDuty}
                onChange={(e) =>
                  setInvoice({ ...invoice, stampDuty: e.target.value })
                }
              />
            </Stack>
            <TextField
              multiline
              minRows={2}
              label="Notes"
              value={invoice.notes}
              onChange={(e) =>
                setInvoice({ ...invoice, notes: e.target.value })
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={formCloseGuard.requestClose}>Fermer</Button>
          <Button
            variant="contained"
            disabled={
              !invoice.description.trim() ||
              !invoice.netAmount ||
              invoice.dueDate < invoice.issueDate ||
              save.isPending
            }
            onClick={() => save.mutate()}
          >
            {editingInvoice ? "Enregistrer" : "Créer le brouillon"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(cancelFor)}
        onClose={cancel.isPending ? undefined : () => setCancelFor(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Annuler la facture ?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            La facture {cancelFor?.number} restera dans l’historique avec le
            statut « Annulée ». Cette action ne supprime aucune trace.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelFor(null)}>Conserver</Button>
          <Button
            color="error"
            variant="contained"
            disabled={cancel.isPending}
            onClick={() => cancelFor && cancel.mutate(cancelFor.id)}
          >
            Confirmer l’annulation
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(paymentFor)}
        onClose={pay.isPending ? undefined : formCloseGuard.requestClose}
      >
        <DialogTitle>Encaisser {paymentFor?.number}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {pay.error && (
              <Alert severity="error">
                {pay.error instanceof Error
                  ? pay.error.message
                  : "Le règlement n’a pas pu être enregistré."}
              </Alert>
            )}
            <TextField
              type="date"
              label="Date"
              value={payment.paymentDate}
              onChange={(e) =>
                setPayment({ ...payment, paymentDate: e.target.value })
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Montant"
              value={payment.amount}
              onChange={(e) =>
                setPayment({ ...payment, amount: e.target.value })
              }
            />
            <TextField
              label="Référence"
              value={payment.reference}
              onChange={(e) =>
                setPayment({ ...payment, reference: e.target.value })
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={formCloseGuard.requestClose}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!payment.amount || pay.isPending}
            onClick={() => pay.mutate()}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(historyFor)}
        onClose={correctPayment.isPending ? undefined : () => setHistoryFor(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Règlements de {historyFor?.number}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            Une correction ne supprime jamais le règlement d’origine. Elle le
            conserve avec sa date, son motif et son type de correction.
          </Alert>
          <QueryState
            loading={invoicePayments.isLoading}
            error={invoicePayments.isError}
            empty={!invoicePayments.data?.length}
            emptyText="Aucun règlement enregistré pour cette facture."
          />
          {Boolean(invoicePayments.data?.length) && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Référence</TableCell>
                  <TableCell align="right">Montant</TableCell>
                  <TableCell>État</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoicePayments.data?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.paymentDate}</TableCell>
                    <TableCell>{item.reference || "—"}</TableCell>
                    <TableCell align="right">
                      <Money value={item.amount} />
                    </TableCell>
                    <TableCell>
                      {item.correctionType ? (
                        <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                          <Chip
                            size="small"
                            color="default"
                            label={
                              item.correctionType === "REMBOURSEMENT"
                                ? "Remboursé"
                                : "Saisie annulée"
                            }
                          />
                          <Typography variant="caption" color="text.secondary">
                            {item.correctionDate} · {item.correctionReason}
                          </Typography>
                        </Stack>
                      ) : (
                        <Chip size="small" color="success" label="Actif" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {!item.correctionType && can("billing.manage") && (
                        <Button
                          size="small"
                          color="warning"
                          startIcon={<UndoRounded />}
                          onClick={() => openCorrection(item)}
                        >
                          Corriger
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryFor(null)}>Fermer</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(correctionFor)}
        onClose={
          correctPayment.isPending ? undefined : formCloseGuard.requestClose
        }
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Corriger le règlement</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {correctPayment.error && (
              <Alert severity="error">
                {correctPayment.error instanceof Error
                  ? correctPayment.error.message
                  : "La correction n’a pas pu être enregistrée."}
              </Alert>
            )}
            <Alert severity="warning">
              Le montant de <Money value={correctionFor?.amount} /> sera retiré
              du total encaissé et la facture redeviendra due si nécessaire.
            </Alert>
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
              <MenuItem value="REMBOURSEMENT">Remboursement au client</MenuItem>
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
              helperText="Indiquez la cause de l’erreur ou la référence du remboursement."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={formCloseGuard.requestClose}>Conserver</Button>
          <Button
            color="warning"
            variant="contained"
            disabled={
              correction.reason.trim().length < 3 ||
              !correction.correctionDate ||
              correctPayment.isPending
            }
            onClick={() => correctPayment.mutate()}
          >
            Confirmer la correction
          </Button>
        </DialogActions>
      </Dialog>
      <UnsavedChangesDialog guard={formCloseGuard} />
    </>
  );
}
