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
  MarkEmailReadOutlined,
  PaymentsOutlined,
} from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  DossierSelector,
  MetricCard,
  Money,
  QueryState,
} from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";
import type { BillingSummary } from "../types/api";
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
}
export function BillingPage() {
  const { organization, can } = useAuth();
  const qc = useQueryClient();
  const [dossierId, setDossierId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentFor, setPaymentFor] = useState<Invoice | null>(null);
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
  const [payment, setPayment] = useState({
    paymentDate: today,
    amount: "",
    reference: "",
  });
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
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["billing-summary"] });
    void qc.invalidateQueries({ queryKey: ["cabinet-invoices"] });
  };
  const create = useMutation({
    mutationFn: () =>
      api.post(`${base}/dossiers/${dossierId}/invoices`, invoice),
    onSuccess: () => {
      setCreateOpen(false);
      refresh();
    },
  });
  const send = useMutation({
    mutationFn: (id: string) =>
      api.post(`${base}/dossiers/${dossierId}/invoices/${id}/send`),
    onSuccess: refresh,
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
    },
  });
  const error = create.error ?? send.error ?? pay.error;
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
              onClick={() => setCreateOpen(true)}
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
                <TableCell />
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
                      label={i.status}
                      color={
                        i.status === "PAYEE"
                          ? "success"
                          : i.status === "EN_RETARD"
                            ? "error"
                            : "default"
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row">
                      <Button
                        size="small"
                        startIcon={<MarkEmailReadOutlined />}
                        disabled={
                          !can("billing.manage") || i.status !== "BROUILLON"
                        }
                        onClick={() => send.mutate(i.id)}
                      >
                        Émettre
                      </Button>
                      <Button
                        size="small"
                        startIcon={<PaymentsOutlined />}
                        disabled={
                          !can("billing.manage") ||
                          ["BROUILLON", "PAYEE", "ANNULEE"].includes(i.status)
                        }
                        onClick={() => {
                          setPaymentFor(i);
                          setPayment({
                            ...payment,
                            amount: (
                              Number(i.totalAmount) - Number(i.paidAmount)
                            ).toFixed(3),
                          });
                        }}
                      >
                        Paiement
                      </Button>
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
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nouvelle facture d’honoraires</DialogTitle>
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
          <Button onClick={() => setCreateOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!invoice.netAmount || create.isPending}
            onClick={() => create.mutate()}
          >
            Créer le brouillon
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(paymentFor)} onClose={() => setPaymentFor(null)}>
        <DialogTitle>Encaisser {paymentFor?.number}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
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
          <Button onClick={() => setPaymentFor(null)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!payment.amount || pay.isPending}
            onClick={() => pay.mutate()}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
