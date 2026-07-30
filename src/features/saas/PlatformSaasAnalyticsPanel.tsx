import { useQuery } from "@tanstack/react-query";
import {
  AutorenewOutlined,
  PaidOutlined,
  QueryStatsOutlined,
  WarningAmberRounded,
} from "@mui/icons-material";
import { Alert, Box, Card, CardContent, LinearProgress, Stack, Typography } from "@mui/material";
import { api } from "../../api/client";
import { MetricCard } from "../../components/MetricCard";
import type { SaasAnalytics } from "../../types/api";

const money = (value: number) =>
  new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
  }).format(value);

export function PlatformSaasAnalyticsPanel() {
  const analytics = useQuery({
    queryKey: ["platform-admin", "saas-analytics"],
    queryFn: () =>
      api.get<SaasAnalytics>("/api/platform-admin/saas-analytics"),
  });
  const data = analytics.data;
  const total =
    (data?.subscriptions.trialing ?? 0) +
    (data?.subscriptions.active ?? 0) +
    (data?.subscriptions.pastDue ?? 0) +
    (data?.subscriptions.suspended ?? 0) +
    (data?.subscriptions.cancelled ?? 0);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h3" sx={{ fontSize: 25 }}>
        Analytics SaaS
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Revenus et cycle de vie des cabinets, sans consulter leurs données
        comptables ni celles de leurs clients.
      </Typography>
      <Box className="metric-grid">
        <MetricCard
          label="MRR"
          value={money(data?.mrrTnd ?? 0)}
          hint={`ARR ${money(data?.arrTnd ?? 0)}`}
          icon={PaidOutlined}
          color="#6672d8"
          loading={analytics.isLoading}
        />
        <MetricCard
          label="Cabinets payants"
          value={data?.subscriptions.active ?? 0}
          hint={`${data?.subscriptions.trialing ?? 0} en essai`}
          icon={AutorenewOutlined}
          color="#2f7d5d"
          loading={analytics.isLoading}
        />
        <MetricCard
          label="Revenu moyen"
          value={money(data?.averageRevenuePerActiveCabinetTnd ?? 0)}
          hint="Par cabinet actif / mois"
          icon={QueryStatsOutlined}
          color="#3f7c8d"
          loading={analytics.isLoading}
        />
        <MetricCard
          label="Impayés"
          value={money(data?.overdueAmountTnd ?? 0)}
          hint={`${data?.overdueInvoices ?? 0} facture(s) échue(s)`}
          icon={WarningAmberRounded}
          color="#bd6b4f"
          loading={analytics.isLoading}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 2.5,
          mt: 2.5,
        }}
      >
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h4" sx={{ mb: 2 }}>
              Cycle des abonnements
            </Typography>
            {[
              ["Essais", data?.subscriptions.trialing ?? 0, "#4f78c4"],
              ["Actifs", data?.subscriptions.active ?? 0, "#2f7d5d"],
              ["Impayés", data?.subscriptions.pastDue ?? 0, "#c47a24"],
              ["Suspendus", data?.subscriptions.suspended ?? 0, "#b64646"],
              ["Annulés", data?.subscriptions.cancelled ?? 0, "#777"],
            ].map(([label, count, color]) => (
              <Box key={String(label)} sx={{ mb: 1.5 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography variant="body2">{label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 750 }}>
                    {count}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={total ? (Number(count) / total) * 100 : 0}
                  sx={{
                    mt: 0.6,
                    height: 7,
                    borderRadius: 4,
                    "& .MuiLinearProgress-bar": { bgcolor: color },
                  }}
                />
              </Box>
            ))}
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h4" sx={{ mb: 2 }}>
              Santé commerciale
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Typography color="text.secondary" variant="body2">
                  Conversion essai → payant
                </Typography>
                <Typography variant="h3">
                  {(data?.trialConversionRate ?? 0).toFixed(1)} %
                </Typography>
              </Box>
              <Box>
                <Typography color="text.secondary" variant="body2">
                  Taux d’attrition observé
                </Typography>
                <Typography variant="h3">
                  {(data?.churnRate ?? 0).toFixed(1)} %
                </Typography>
              </Box>
              <Box>
                <Typography color="text.secondary" variant="body2">
                  Encaissé ce mois
                </Typography>
                <Typography variant="h3">
                  {money(data?.collectedThisMonthTnd ?? 0)}
                </Typography>
              </Box>
              <Alert severity="info">
                Ces chiffres concernent uniquement l’abonnement Fiscora payé par
                les cabinets. Les honoraires de leurs clients sont exclus.
              </Alert>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
