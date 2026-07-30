import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AddCardOutlined,
  CheckCircleOutlineRounded,
  EditOutlined,
  ReceiptLongOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../../api/client";
import type {
  OrganizationSubscription,
  SaasPlan,
  SaasSubscriptionInvoice,
} from "../../types/api";

const money = (value: number) =>
  new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
  }).format(value);

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-TN", { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "—";

const statusColor = (status: OrganizationSubscription["status"]) => {
  if (status === "ACTIF") return "success";
  if (status === "IMPAYE" || status === "SUSPENDU") return "error";
  if (status === "ESSAI") return "info";
  return "default";
};

type SubscriptionForm = {
  subscription: OrganizationSubscription;
  planCode: string;
  status: OrganizationSubscription["status"];
  billingCycle: OrganizationSubscription["billingCycle"];
  reason: string;
};

type InvoiceAction =
  | { kind: "create"; subscription: OrganizationSubscription; reason: string }
  | { kind: "pay"; invoice: SaasSubscriptionInvoice; reference: string; reason: string };

export function PlatformSubscriptionsPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SubscriptionForm | null>(null);
  const [invoiceAction, setInvoiceAction] = useState<InvoiceAction | null>(null);
  const plans = useQuery({
    queryKey: ["platform-admin", "subscription-plans"],
    queryFn: () =>
      api.get<SaasPlan[]>("/api/platform-admin/subscription-plans"),
  });
  const subscriptions = useQuery({
    queryKey: ["platform-admin", "subscriptions"],
    queryFn: () =>
      api.get<OrganizationSubscription[]>("/api/platform-admin/subscriptions"),
  });
  const invoices = useQuery({
    queryKey: ["platform-admin", "subscription-invoices"],
    queryFn: () =>
      api.get<SaasSubscriptionInvoice[]>(
        "/api/platform-admin/subscription-invoices",
      ),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["platform-admin"] });

  const updateSubscription = useMutation({
    mutationFn: (value: SubscriptionForm) =>
      api.patch(
        `/api/platform-admin/subscriptions/${value.subscription.organizationId}`,
        {
          planCode: value.planCode,
          status: value.status,
          billingCycle: value.billingCycle,
          trialDays: value.status === "ESSAI" ? 30 : undefined,
          reason: value.reason.trim(),
        },
      ),
    onSuccess: async () => {
      setForm(null);
      await refresh();
    },
  });

  const invoiceMutation = useMutation({
    mutationFn: (value: InvoiceAction) => {
      if (value.kind === "create") {
        return api.post(
          `/api/platform-admin/subscriptions/${value.subscription.organizationId}/invoices`,
          { dueInDays: 15, status: "A_PAYER", reason: value.reason.trim() },
        );
      }
      return api.post(
        `/api/platform-admin/subscription-invoices/${value.invoice.id}/payments`,
        {
          paymentReference: value.reference.trim(),
          reason: value.reason.trim(),
        },
      );
    },
    onSuccess: async () => {
      setInvoiceAction(null);
      await refresh();
    },
  });

  const error =
    updateSubscription.error instanceof Error
      ? updateSubscription.error.message
      : invoiceMutation.error instanceof Error
        ? invoiceMutation.error.message
        : null;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h3" sx={{ fontSize: 25 }}>
          Offres et abonnements des cabinets
        </Typography>
        <Typography color="text.secondary">
          Fiscora facture le cabinet. Les honoraires que le cabinet facture à ses
          propres clients restent dans un module séparé.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 2,
          mb: 3,
        }}
      >
        {plans.data?.map((plan) => (
          <Card key={plan.id} variant="outlined">
            <CardContent>
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: "space-between" }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>{plan.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {plan.code}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color={plan.isActive ? "success" : "default"}
                  label={plan.isActive ? "Disponible" : "Masquée"}
                />
              </Stack>
              <Typography variant="h4" sx={{ my: 1.5 }}>
                {money(plan.monthlyPriceTnd)}
                <Typography component="span" variant="body2">
                  {" "}/ mois
                </Typography>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {plan.maxCollaborators} collaborateurs · {plan.maxActiveDossiers}{" "}
                dossiers · {plan.maxStorageGb} Go
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {plan.monthlyOcrDocuments} OCR · {plan.monthlyTtnSubmissions} TTN
                par mois
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Typography variant="h4" sx={{ mb: 1.5 }}>
        Cabinets abonnés
      </Typography>
      <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Cabinet</TableCell>
              <TableCell>Offre</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Consommation</TableCell>
              <TableCell>Prochaine échéance</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {subscriptions.data?.map((subscription) => {
              const highestUsage = Math.max(
                subscription.usage.collaborators.percentage,
                subscription.usage.activeDossiers.percentage,
                subscription.usage.storageBytes.percentage,
                subscription.usage.ocrDocuments.percentage,
                subscription.usage.ttnSubmissions.percentage,
              );
              return (
                <TableRow key={subscription.id} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 750 }}>
                      {subscription.organizationName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {subscription.billingCycle === "ANNUEL" ? "Annuel" : "Mensuel"}
                    </Typography>
                  </TableCell>
                  <TableCell>{subscription.plan.name}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={statusColor(subscription.status)}
                      label={subscription.status.replace("_", " ")}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 150 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center" }}
                    >
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, highestUsage)}
                        color={highestUsage >= 90 ? "warning" : "primary"}
                        sx={{ flex: 1, height: 7, borderRadius: 4 }}
                      />
                      <Typography variant="caption">
                        {Math.round(highestUsage)} %
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {date(
                      subscription.status === "ESSAI"
                        ? subscription.trialEndsAtUtc
                        : subscription.currentPeriodEndUtc,
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      startIcon={<EditOutlined />}
                      onClick={() =>
                        setForm({
                          subscription,
                          planCode: subscription.plan.code,
                          status: subscription.status,
                          billingCycle: subscription.billingCycle,
                          reason: "",
                        })
                      }
                    >
                      Gérer
                    </Button>
                    <Button
                      size="small"
                      startIcon={<AddCardOutlined />}
                      onClick={() =>
                        setInvoiceAction({
                          kind: "create",
                          subscription,
                          reason: "",
                        })
                      }
                    >
                      Facturer
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ my: 3 }} />
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 1.5, alignItems: "center" }}
      >
        <ReceiptLongOutlined color="primary" />
        <Typography variant="h4">Factures Fiscora</Typography>
      </Stack>
      <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Facture</TableCell>
              <TableCell>Cabinet</TableCell>
              <TableCell>Échéance</TableCell>
              <TableCell align="right">Montant</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.data?.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>{invoice.number}</TableCell>
                <TableCell>{invoice.organizationName}</TableCell>
                <TableCell>{date(invoice.dueAtUtc)}</TableCell>
                <TableCell align="right">{money(invoice.amountTnd)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={invoice.status === "PAYEE" ? "success" : "default"}
                    label={invoice.status.replace("_", " ")}
                  />
                </TableCell>
                <TableCell align="right">
                  {invoice.status === "A_PAYER" && (
                    <Button
                      size="small"
                      startIcon={<CheckCircleOutlineRounded />}
                      onClick={() =>
                        setInvoiceAction({
                          kind: "pay",
                          invoice,
                          reference: "",
                          reason: "",
                        })
                      }
                    >
                      Marquer payée
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!invoices.data?.length && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Aucune facture SaaS pour le moment.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(form)} onClose={() => setForm(null)} fullWidth maxWidth="sm">
        <DialogTitle>Gérer l’abonnement</DialogTitle>
        {form && (
          <>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Alert severity="info">{form.subscription.organizationName}</Alert>
                <FormControl fullWidth>
                  <InputLabel>Offre</InputLabel>
                  <Select
                    value={form.planCode}
                    label="Offre"
                    onChange={(event) =>
                      setForm({ ...form, planCode: event.target.value })
                    }
                  >
                    {plans.data
                      ?.filter((plan) => plan.isActive)
                      .map((plan) => (
                        <MenuItem key={plan.id} value={plan.code}>
                          {plan.name}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <FormControl fullWidth>
                    <InputLabel>Statut</InputLabel>
                    <Select
                      value={form.status}
                      label="Statut"
                      onChange={(event) =>
                        setForm({
                          ...form,
                          status: event.target.value as SubscriptionForm["status"],
                        })
                      }
                    >
                      {["ESSAI", "ACTIF", "IMPAYE", "SUSPENDU", "ANNULE"].map(
                        (status) => (
                          <MenuItem key={status} value={status}>
                            {status}
                          </MenuItem>
                        ),
                      )}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Cycle</InputLabel>
                    <Select
                      value={form.billingCycle}
                      label="Cycle"
                      onChange={(event) =>
                        setForm({
                          ...form,
                          billingCycle: event.target
                            .value as SubscriptionForm["billingCycle"],
                        })
                      }
                    >
                      <MenuItem value="MENSUEL">Mensuel</MenuItem>
                      <MenuItem value="ANNUEL">Annuel</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
                <TextField
                  label="Justification obligatoire"
                  multiline
                  minRows={2}
                  value={form.reason}
                  onChange={(event) => setForm({ ...form, reason: event.target.value })}
                  helperText="Minimum 8 caractères, conservée dans l’audit."
                />
                {error && <Alert severity="error">{error}</Alert>}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setForm(null)}>Annuler</Button>
              <Button
                variant="contained"
                disabled={form.reason.trim().length < 8 || updateSubscription.isPending}
                onClick={() => updateSubscription.mutate(form)}
              >
                Enregistrer
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog
        open={Boolean(invoiceAction)}
        onClose={() => setInvoiceAction(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {invoiceAction?.kind === "pay"
            ? "Enregistrer le paiement"
            : "Créer la facture SaaS"}
        </DialogTitle>
        {invoiceAction && (
          <>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                {invoiceAction.kind === "pay" && (
                  <TextField
                    label="Référence du paiement"
                    value={invoiceAction.reference}
                    onChange={(event) =>
                      setInvoiceAction({
                        ...invoiceAction,
                        reference: event.target.value,
                      })
                    }
                  />
                )}
                <TextField
                  label="Justification obligatoire"
                  multiline
                  minRows={2}
                  value={invoiceAction.reason}
                  onChange={(event) =>
                    setInvoiceAction({
                      ...invoiceAction,
                      reason: event.target.value,
                    })
                  }
                />
                {invoiceAction.kind === "create" && (
                  <Alert severity="info">
                    Le montant est calculé automatiquement depuis l’offre et le
                    cycle du cabinet. Échéance à 15 jours.
                  </Alert>
                )}
                {error && <Alert severity="error">{error}</Alert>}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setInvoiceAction(null)}>Annuler</Button>
              <Button
                variant="contained"
                disabled={
                  invoiceAction.reason.trim().length < 8 ||
                  (invoiceAction.kind === "pay" &&
                    invoiceAction.reference.trim().length < 2) ||
                  invoiceMutation.isPending
                }
                onClick={() => invoiceMutation.mutate(invoiceAction)}
              >
                Confirmer
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
