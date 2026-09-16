import { useQuery } from "@tanstack/react-query";
import {
  ErrorOutlineRounded,
  MemoryRounded,
  QueryStatsRounded,
  SpeedRounded,
  StorageRounded,
  SyncRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../api/client";
import { MetricCard } from "../../components/MetricCard";
import type { PlatformMonitoring } from "../../types/api";

const bytes = (value: number) => {
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} Ko`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} Mo`;
  return `${(value / 1024 ** 3).toFixed(2)} Go`;
};

const uptime = (seconds: number) => {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days) return `${days} j ${hours} h`;
  if (hours) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
};

const time = (value: string) =>
  new Intl.DateTimeFormat("fr-TN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const pipelineColor = (status: string) => {
  if (status === "ERREUR") return "error" as const;
  if (status === "EN_COURS") return "warning" as const;
  return "success" as const;
};

export function PlatformMonitoringPanel() {
  const theme = useTheme();
  const monitoring = useQuery({
    queryKey: ["platform-admin", "monitoring"],
    queryFn: () =>
      api.get<PlatformMonitoring>("/api/platform-admin/monitoring"),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const data = monitoring.data;
  const chartData =
    data?.history.map((point) => ({
      time: time(point.timestampUtc),
      Requêtes: point.requests,
      "Erreurs 5xx": point.errors5xx,
      "Latence moyenne": point.averageDurationMs,
    })) ?? [];

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Box>
          <Typography variant="h3">Supervision opérationnelle</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Santé de la réplique API active et des traitements Fiscora.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<SyncRounded />}
          onClick={() => void monitoring.refetch()}
          disabled={monitoring.isFetching}
        >
          Actualiser
        </Button>
      </Stack>

      {monitoring.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Les métriques opérationnelles ne sont pas disponibles.
        </Alert>
      )}

      <Alert severity="info" sx={{ my: 2.5 }}>
        Fenêtre glissante de {data?.windowMinutes ?? 60} minutes sur la réplique
        API actuellement active. Les compteurs repartent de zéro après une mise
        à l’échelle à zéro ou un nouveau déploiement.
      </Alert>

      <Box className="metric-grid">
        <MetricCard
          label="Requêtes"
          value={data?.http.requestsTotal ?? 0}
          hint={`${data?.http.activeRequests ?? 0} en cours`}
          icon={QueryStatsRounded}
          color="#3f7c8d"
          loading={monitoring.isLoading}
        />
        <MetricCard
          label="Erreurs serveur"
          value={`${((data?.http.errorRate ?? 0) * 100).toFixed(1)} %`}
          hint={`${data?.http.errors5xx ?? 0} réponse(s) 5xx`}
          icon={ErrorOutlineRounded}
          color="#b64646"
          loading={monitoring.isLoading}
        />
        <MetricCard
          label="Latence p95"
          value={`${data?.http.p95DurationMs ?? 0} ms`}
          hint={`Moyenne ${data?.http.averageDurationMs ?? 0} ms`}
          icon={SpeedRounded}
          color="#6672d8"
          loading={monitoring.isLoading}
        />
        <MetricCard
          label="Mémoire API"
          value={bytes(data?.runtime.memoryRssBytes ?? 0)}
          hint={`Heap ${bytes(data?.runtime.heapUsedBytes ?? 0)}`}
          icon={MemoryRounded}
          color="#80664c"
          loading={monitoring.isLoading}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 2fr) minmax(300px, 1fr)" },
          gap: 2.5,
          mt: 2.5,
        }}
      >
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h4">Activité HTTP</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Requêtes, erreurs serveur et latence moyenne par minute.
            </Typography>
            <Box sx={{ height: 300, width: "100%" }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis
                    dataKey="time"
                    minTickGap={35}
                    tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                  />
                  <YAxis
                    yAxisId="volume"
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                  />
                  <YAxis
                    yAxisId="latency"
                    orientation="right"
                    unit=" ms"
                    tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                  />
                  <ChartTooltip />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Line
                    yAxisId="volume"
                    type="monotone"
                    dataKey="Requêtes"
                    stroke={theme.palette.primary.main}
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="volume"
                    type="monotone"
                    dataKey="Erreurs 5xx"
                    stroke={theme.palette.error.main}
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="latency"
                    type="monotone"
                    dataKey="Latence moyenne"
                    stroke={theme.palette.warning.main}
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h4" sx={{ mb: 2 }}>
              État de la réplique
            </Typography>
            <Stack spacing={1.6}>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.secondary">API</Typography>
                <Chip label={data?.runtime.status ?? "—"} color="success" size="small" />
              </Stack>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.secondary">PostgreSQL</Typography>
                <Chip
                  label={`${data?.database.status ?? "—"} · ${data?.database.latencyMs ?? 0} ms`}
                  color={data?.database.status === "INDISPONIBLE" ? "error" : "success"}
                  size="small"
                />
              </Stack>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.secondary">Disponibilité courante</Typography>
                <Typography sx={{ fontWeight: 600 }}>
                  {uptime(data?.runtime.uptimeSeconds ?? 0)}
                </Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.secondary">Environnement</Typography>
                <Typography sx={{ fontWeight: 600 }}>
                  {data?.runtime.environment ?? "—"}
                </Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.secondary">Runtime</Typography>
                <Typography sx={{ fontWeight: 600 }}>
                  {data?.runtime.nodeVersion ?? "—"}
                </Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.secondary">Application Insights</Typography>
                <Chip
                  label={data?.integrations.applicationInsightsConfigured ? "Configuré" : "Non configuré"}
                  color={data?.integrations.applicationInsightsConfigured ? "success" : "warning"}
                  size="small"
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Card variant="outlined" sx={{ mt: 2.5 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
            <StorageRounded color="action" />
            <Typography variant="h4">Traitements métier</Typography>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Pipeline</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right">En attente</TableCell>
                <TableCell align="right">En cours</TableCell>
                <TableCell align="right">Échecs</TableCell>
                <TableCell>Dernier échec</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.pipelines.map((pipeline) => (
                <TableRow key={pipeline.code}>
                  <TableCell>{pipeline.label}</TableCell>
                  <TableCell>
                    <Chip
                      label={pipeline.status.replace(/_/g, " ")}
                      color={pipelineColor(pipeline.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">{pipeline.pending}</TableCell>
                  <TableCell align="right">{pipeline.processing}</TableCell>
                  <TableCell align="right">{pipeline.failed}</TableCell>
                  <TableCell>
                    {pipeline.lastFailureAtUtc
                      ? new Intl.DateTimeFormat("fr-TN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(pipeline.lastFailureAtUtc))
                      : "Aucun"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
