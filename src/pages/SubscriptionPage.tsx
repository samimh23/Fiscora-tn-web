import { useQuery } from "@tanstack/react-query";
import {
  CloudOutlined,
  DescriptionOutlined,
  GroupsOutlined,
  ReceiptLongOutlined,
  SmartToyOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type {
  OrganizationSubscription,
  SaasPlan,
  SaasSubscriptionInvoice,
  SaasUsageMetric,
} from "../types/api";

const money = (value: number) =>
  new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
  }).format(value);

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-TN", { dateStyle: "long" }).format(
        new Date(value),
      )
    : "—";

function UsageCard({
  label,
  metric,
  icon: Icon,
  bytes = false,
}: {
  label: string;
  metric: SaasUsageMetric;
  icon: typeof GroupsOutlined;
  bytes?: boolean;
}) {
  const format = (value: number) =>
    bytes ? `${(value / 1024 ** 3).toFixed(2)} Go` : value.toLocaleString("fr-TN");
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Typography sx={{ fontWeight: 750 }}>{label}</Typography>
          <Icon color="primary" />
        </Stack>
        <Typography variant="h4" sx={{ mt: 1.5 }}>
          {format(metric.used)}
          <Typography component="span" variant="body2" color="text.secondary">
            {" "}/ {format(metric.limit)}
          </Typography>
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, metric.percentage)}
          color={metric.percentage >= 90 ? "warning" : "primary"}
          sx={{ mt: 1.5, height: 7, borderRadius: 4 }}
        />
      </CardContent>
    </Card>
  );
}

export function SubscriptionPage() {
  const { organization } = useAuth();
  const organizationId = organization?.id ?? "";
  const base = `/api/organizations/${organizationId}/subscription`;
  const subscription = useQuery({
    queryKey: ["organization-subscription", organizationId],
    queryFn: () => api.get<OrganizationSubscription>(base),
    enabled: Boolean(organizationId),
  });
  const plans = useQuery({
    queryKey: ["organization-subscription-plans", organizationId],
    queryFn: () => api.get<SaasPlan[]>(`${base}/plans`),
    enabled: Boolean(organizationId),
  });
  const invoices = useQuery({
    queryKey: ["organization-subscription-invoices", organizationId],
    queryFn: () => api.get<SaasSubscriptionInvoice[]>(`${base}/invoices`),
    enabled: Boolean(organizationId),
  });
  const item = subscription.data;
  const hasError = subscription.isError || plans.isError || invoices.isError;

  return (
    <>
      <Typography
        variant="overline"
        sx={{ color: "primary.main", fontWeight: 800, letterSpacing: ".13em" }}
      >
        Gestion du cabinet
      </Typography>
      <Typography variant="h2" sx={{ fontSize: { xs: 36, md: 50 }, mt: 0.5 }}>
        Mon abonnement Fiscora
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.8, mb: 3 }}>
        Offre, limites d’utilisation et factures dues par votre cabinet à
        Fiscora.
      </Typography>

      {hasError && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          L’abonnement n’est pas disponible ou votre rôle ne permet pas de le
          consulter.
        </Alert>
      )}

      {item && (
        <>
          <Card
            sx={{
              mb: 2.5,
              color: "#fff",
              background:
                "linear-gradient(120deg, #103a2f 0%, #1d6653 58%, #6672d8 140%)",
            }}
          >
            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{ justifyContent: "space-between" }}
              >
                <Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <Typography variant="overline" sx={{ color: "#f2c56b" }}>
                      Offre actuelle
                    </Typography>
                    <Chip
                      size="small"
                      label={item.status}
                      sx={{ bgcolor: "rgba(255,255,255,.14)", color: "#fff" }}
                    />
                  </Stack>
                  <Typography variant="h2" sx={{ color: "#fff", mt: 0.5 }}>
                    {item.plan.name}
                  </Typography>
                  <Typography sx={{ color: "rgba(255,255,255,.78)", mt: 0.7 }}>
                    {item.billingCycle === "ANNUEL"
                      ? `${money(item.plan.annualPriceTnd)} / an`
                      : `${money(item.plan.monthlyPriceTnd)} / mois`}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: { md: "right" } }}>
                  <Typography sx={{ color: "rgba(255,255,255,.65)" }}>
                    {item.status === "ESSAI"
                      ? "Fin de la période d’essai"
                      : "Prochaine échéance"}
                  </Typography>
                  <Typography variant="h4" sx={{ color: "#fff" }}>
                    {date(
                      item.status === "ESSAI"
                        ? item.trialEndsAtUtc
                        : item.currentPeriodEndUtc,
                    )}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "1fr 1fr",
                xl: "repeat(5, 1fr)",
              },
              gap: 2,
              mb: 2.5,
            }}
          >
            <UsageCard
              label="Collaborateurs"
              metric={item.usage.collaborators}
              icon={GroupsOutlined}
            />
            <UsageCard
              label="Dossiers actifs"
              metric={item.usage.activeDossiers}
              icon={DescriptionOutlined}
            />
            <UsageCard
              label="Stockage"
              metric={item.usage.storageBytes}
              icon={CloudOutlined}
              bytes
            />
            <UsageCard
              label="Documents OCR"
              metric={item.usage.ocrDocuments}
              icon={SmartToyOutlined}
            />
            <UsageCard
              label="Transmissions TTN"
              metric={item.usage.ttnSubmissions}
              icon={ReceiptLongOutlined}
            />
          </Box>
        </>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.35fr .65fr" },
          gap: 2.5,
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h3" sx={{ fontSize: 24, mb: 2 }}>
              Factures d’abonnement
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Numéro</TableCell>
                    <TableCell>Échéance</TableCell>
                    <TableCell align="right">Montant</TableCell>
                    <TableCell>Statut</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.data?.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.number}</TableCell>
                      <TableCell>{date(invoice.dueAtUtc)}</TableCell>
                      <TableCell align="right">{money(invoice.amountTnd)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={invoice.status === "PAYEE" ? "success" : "default"}
                          label={invoice.status.replace("_", " ")}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!invoices.data?.length && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        Aucune facture d’abonnement.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1.5 }}>
                Offres disponibles
              </Typography>
              <Stack
                divider={
                  <Box sx={{ borderTop: "1px solid", borderColor: "divider" }} />
                }
              >
                {plans.data?.map((plan) => (
                  <Box key={plan.id} sx={{ py: 1.2 }}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between" }}
                    >
                      <Typography sx={{ fontWeight: 750 }}>{plan.name}</Typography>
                      <Typography>{money(plan.monthlyPriceTnd)}/mois</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {plan.maxCollaborators} collaborateurs ·{" "}
                      {plan.maxActiveDossiers} dossiers
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
          <Alert severity="info">
            Vos clients ne paient pas Fiscora. Ils règlent leurs honoraires à
            votre cabinet dans le module « Honoraires ». Cet abonnement concerne
            uniquement votre accès professionnel à la plateforme.
          </Alert>
        </Stack>
      </Box>
    </>
  );
}
