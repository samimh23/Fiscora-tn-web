import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshRounded } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../api/client";
import type { CloudCostReport, CloudCosts } from "./monitoring-types";

const money = (value: number | null, currency: string | null) =>
  value == null
    ? "—"
    : `${value.toFixed(2)} ${currency === "USD" ? "$" : (currency ?? "")}`;

function CostCard({
  title,
  report,
  setupHint,
}: {
  title: string;
  report: CloudCostReport | undefined;
  setupHint: string;
}) {
  if (!report) return null;
  const budgetShare =
    report.monthlyBudget && report.monthToDate != null
      ? (report.monthToDate / report.monthlyBudget) * 100
      : null;
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
        >
          <Typography variant="h6">{title}</Typography>
          {report.status === "OK" ? (
            <Chip size="small" color="success" label="À jour" />
          ) : (
            <Chip
              size="small"
              color={report.status === "ERROR" ? "error" : "warning"}
              label={
                report.status === "WAITING_FOR_EXPORT"
                  ? "Export en attente"
                  : report.status === "NOT_CONFIGURED"
                    ? "Non configuré"
                    : "Erreur"
              }
            />
          )}
        </Stack>

        {report.status !== "OK" ? (
          <Alert severity={report.status === "ERROR" ? "error" : "warning"}>
            <Typography variant="body2">
              {report.status === "WAITING_FOR_EXPORT"
                ? "L’export de facturation n’est pas encore activé, ou Google n’a pas encore écrit ses premières lignes (jusqu’à un jour)."
                : report.status === "NOT_CONFIGURED"
                  ? "La lecture des coûts n’est pas configurée."
                  : report.message}
            </Typography>
            {report.status !== "ERROR" && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {setupHint}
              </Typography>
            )}
          </Alert>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary">
              Depuis le début du mois
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {money(report.monthToDate, report.currency)}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", gap: 1, my: 1 }}
            >
              <Chip
                size="small"
                variant="outlined"
                label={`Mois dernier : ${money(report.lastMonth, report.currency)}`}
              />
              {report.credits != null && report.credits !== 0 && (
                <Chip
                  size="small"
                  variant="outlined"
                  color="success"
                  label={`Crédits : ${money(report.credits, report.currency)}`}
                />
              )}
            </Stack>
            {budgetShare != null && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {`Budget mensuel : ${Math.round(budgetShare)} % / ${money(report.monthlyBudget, report.currency)}`}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(budgetShare, 100)}
                  color={
                    budgetShare >= 100
                      ? "error"
                      : budgetShare >= 80
                        ? "warning"
                        : "primary"
                  }
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}
            <Box sx={{ height: 180, mb: 1 }}>
              <ResponsiveContainer>
                <BarChart
                  data={report.daily.map((day) => ({
                    date: day.date.slice(5),
                    Coût: day.cost,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <ChartTooltip />
                  <Bar dataKey="Coût" fill="#345f9d" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell align="right">Ce mois</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.byService.map((row) => (
                  <TableRow key={`${row.project ?? ""}-${row.name}`}>
                    <TableCell>
                      {row.name}
                      {row.project && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block" }}
                        >
                          {row.project}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {money(row.cost, report.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function PlatformCostsPanel() {
  const [refresh, setRefresh] = useState(0);
  const costs = useQuery({
    queryKey: ["platform-admin", "cloud-costs", refresh],
    queryFn: () =>
      api.get<CloudCosts>(
        `/api/platform-admin/cloud-costs${refresh ? "?refresh=true" : ""}`,
      ),
    staleTime: 10 * 60_000,
  });
  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Typography variant="body2" color="text.secondary">
          Azure et Google Cloud publient leurs coûts avec quelques heures de
          retard ; les alertes de budget sont envoyées par e-mail.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshRounded />}
          disabled={costs.isFetching}
          onClick={() => setRefresh((value) => value + 1)}
        >
          Actualiser
        </Button>
      </Stack>
      {costs.isFetching && <LinearProgress aria-label="Chargement" />}
      {costs.isError && (
        <Alert severity="error">Impossible de charger les coûts cloud.</Alert>
      )}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
        }}
      >
        <CostCard
          title="Azure"
          report={costs.data?.azure}
          setupHint="Définissez AZURE_COST_SCOPE et donnez le rôle Cost Management Reader à l’identité de l’API."
        />
        <CostCard
          title="Google Cloud"
          report={costs.data?.gcp}
          setupHint="Console Google Cloud › Facturation › Export de la facturation › BigQuery : activez les données de coût d’utilisation standard vers le projet fiscora-ai, jeu de données billing_export."
        />
      </Box>
    </Stack>
  );
}
