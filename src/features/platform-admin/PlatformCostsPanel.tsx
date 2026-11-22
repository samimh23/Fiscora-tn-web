import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OpenInNewRounded, SyncRounded } from "@mui/icons-material";
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
    : `${value.toFixed(2)} ${currency === "USD" || !currency ? "$" : currency}`;

const clock = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tunis",
  }).format(new Date(value));

function BudgetBar({ report }: { report: CloudCostReport }) {
  if (!report.monthlyBudget || report.monthToDate == null) return null;
  const share = (report.monthToDate / report.monthlyBudget) * 100;
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
        <Typography variant="body2">
          {`Budget mensuel : ${money(report.monthlyBudget, report.currency)}`}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 700 }}
          color={
            share >= 100
              ? "error"
              : share >= 80
                ? "warning.dark"
                : "text.primary"
          }
        >
          {`${Math.round(share)} %`}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={Math.min(share, 100)}
        color={share >= 100 ? "error" : share >= 80 ? "warning" : "primary"}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
}

function GoogleExportSteps({ report }: { report: CloudCostReport }) {
  return (
    <Stack spacing={1.5}>
      <Alert severity="warning">
        {report.status === "WAITING_FOR_EXPORT"
          ? "Google Cloud n’envoie pas encore ses coûts : l’export de facturation vers BigQuery n’est pas activé, ou il vient de l’être (les premières lignes arrivent sous 24 h)."
          : report.status === "NOT_CONFIGURED"
            ? "La lecture des coûts Google Cloud n’est pas configurée."
            : report.message}
      </Alert>
      {report.status !== "ERROR" && (
        <>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Activation (une seule fois, par un administrateur de facturation)
          </Typography>
          <Box component="ol" sx={{ m: 0, pl: 2.5, "& li": { mb: 0.5 } }}>
            <li>
              <Typography variant="body2">
                Ouvrez Facturation › Export de la facturation.
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                Dans « Données de coût d’utilisation standard », cliquez sur
                Modifier les paramètres.
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                Choisissez le projet fiscora-ai et le jeu de données
                billing_export, puis enregistrez.
              </Typography>
            </li>
          </Box>
          <Box>
            <Button
              size="small"
              variant="outlined"
              endIcon={<OpenInNewRounded />}
              href="https://console.cloud.google.com/billing/export"
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir l’export de facturation
            </Button>
          </Box>
        </>
      )}
      {report.monthlyBudget != null && (
        <Typography variant="body2" color="text.secondary">
          {`Budget mensuel : ${money(report.monthlyBudget, "USD")}`}
          {" · alertes e-mail à 50 %, 80 % et 100 % (déjà actives)."}
        </Typography>
      )}
    </Stack>
  );
}

function CostCard({
  title,
  report,
}: {
  title: string;
  report: CloudCostReport | undefined;
}) {
  if (!report) return null;
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <Typography variant="h6">{title}</Typography>
            {report.status === "OK" ? (
              <Chip
                size="small"
                color="success"
                label={`Données de ${clock(report.refreshedAtUtc)}`}
              />
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
            report.provider === "gcp" ? (
              <GoogleExportSteps report={report} />
            ) : (
              <Alert severity={report.status === "ERROR" ? "error" : "warning"}>
                {report.status === "NOT_CONFIGURED"
                  ? "La lecture des coûts Azure n’est pas configurée."
                  : report.message}
              </Alert>
            )
          ) : (
            <>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: "1fr 1fr",
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Depuis le début du mois
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {money(report.monthToDate, report.currency)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Mois précédent
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                    {money(report.lastMonth, report.currency)}
                  </Typography>
                  {report.credits != null && report.credits !== 0 && (
                    <Typography variant="caption" color="success.main">
                      {`Crédits : ${money(report.credits, report.currency)}`}
                    </Typography>
                  )}
                </Box>
              </Box>
              <BudgetBar report={report} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                  Coût par jour (30 jours)
                </Typography>
                <Box sx={{ height: 180 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={report.daily.map((day) => ({
                        date: day.date.slice(5),
                        Coût: day.cost,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} width={36} />
                      <ChartTooltip />
                      <Bar dataKey="Coût" fill="#345f9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
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
        </Stack>
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
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Box>
            <Typography variant="h3">Dépenses cloud</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Azure et Google Cloud publient leurs coûts avec quelques heures de
              retard. Les alertes de budget partent par e-mail.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<SyncRounded />}
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
          <CostCard title="Azure" report={costs.data?.azure} />
          <CostCard title="Google Cloud" report={costs.data?.gcp} />
        </Box>
      </Stack>
    </Box>
  );
}
