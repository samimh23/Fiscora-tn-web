import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AutoAwesomeOutlined,
  ErrorOutlineRounded,
  PaidOutlined,
  ThumbDownOutlined,
  ThumbUpOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../api/client";
import { MetricCard } from "../../components/MetricCard";
import type { AiUsageReport, RatedAnswer } from "./monitoring-types";

const featureLabels: Record<string, string> = {
  assistant_answer: "Réponses de l’assistant",
  assistant_route: "Questions chiffrées (routage)",
  product_help: "Guide produit",
  embedding_query: "Vecteurs des questions",
  embedding_document: "Indexation des documents",
  rerank: "Reclassement des passages",
  extraction: "Extraction NuExtract",
  ocr: "OCR PaddleOCR",
  pdf_render: "Rendu des pages PDF",
};

const integer = (value: number) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(value));
const usd = (value: number) =>
  `${value < 1 ? value.toFixed(4) : value.toFixed(2)} $`;
const shortDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Tunis",
      }).format(new Date(value))
    : "—";

export function PlatformAiPanel() {
  const [days, setDays] = useState(30);
  const [rating, setRating] = useState<"down" | "up" | "all">("down");
  const usage = useQuery({
    queryKey: ["platform-admin", "ai-usage", days],
    queryFn: () =>
      api.get<AiUsageReport>(`/api/platform-admin/ai-usage?days=${days}`),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const feedback = useQuery({
    queryKey: ["platform-admin", "assistant-feedback", rating],
    queryFn: () =>
      api.get<RatedAnswer[]>(
        `/api/platform-admin/assistant-feedback?rating=${rating}&limit=50`,
      ),
  });
  const data = usage.data;
  const assistant = data?.assistant;
  const rated = (assistant?.likes ?? 0) + (assistant?.dislikes ?? 0);
  const problemRate = data?.totals.calls
    ? (data.totals.problems / data.totals.calls) * 100
    : 0;

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{
          justifyContent: "space-between",
          alignItems: { sm: "center" },
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Chaque appel aux services d’IA est enregistré : volume, erreurs, temps
          de réponse, jetons et coût estimé.
        </Typography>
        <TextField
          select
          size="small"
          label="Période"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          sx={{ minWidth: 160, mt: 1 }}
        >
          <MenuItem value={7}>7 derniers jours</MenuItem>
          <MenuItem value={30}>30 derniers jours</MenuItem>
          <MenuItem value={90}>90 derniers jours</MenuItem>
        </TextField>
      </Stack>

      {usage.isLoading && <LinearProgress aria-label="Chargement" />}
      {usage.isError && (
        <Alert severity="error">
          Impossible de charger l’utilisation de l’IA.
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          },
        }}
      >
        <MetricCard
          label="Appels IA"
          value={integer(data?.totals.calls ?? 0)}
          hint={`Sur ${days} jours`}
          icon={AutoAwesomeOutlined}
          loading={usage.isLoading}
        />
        <MetricCard
          label="Erreurs et replis"
          value={`${problemRate.toFixed(1)} %`}
          hint={`${integer(data?.totals.problems ?? 0)} appels concernés`}
          icon={ErrorOutlineRounded}
          color={problemRate > 5 ? "#b42318" : "#17624c"}
          loading={usage.isLoading}
        />
        <MetricCard
          label="Coût IA estimé"
          value={usd(data?.totals.costUsd ?? 0)}
          hint="Gemini, vecteurs et reclassement"
          icon={PaidOutlined}
          loading={usage.isLoading}
        />
        <MetricCard
          label="Avis sur les réponses"
          value={
            rated
              ? `${Math.round(((assistant?.likes ?? 0) / rated) * 100)} % utiles`
              : "Aucun avis"
          }
          hint={`${assistant?.likes ?? 0} 👍 · ${assistant?.dislikes ?? 0} 👎`}
          icon={ThumbUpOutlined}
          loading={usage.isLoading}
        />
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Appels par jour
          </Typography>
          <Box sx={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart
                data={(data?.daily ?? []).map((day) => ({
                  date: day.date.slice(5),
                  Réussis: day.calls - day.problems,
                  Problèmes: day.problems,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <ChartTooltip />
                <Legend />
                <Bar dataKey="Réussis" stackId="a" fill="#17624c" />
                <Bar dataKey="Problèmes" stackId="a" fill="#d97706" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Détail par fonction
          </Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fonction</TableCell>
                  <TableCell align="right">Appels</TableCell>
                  <TableCell align="right">Erreurs</TableCell>
                  <TableCell align="right">Replis</TableCell>
                  <TableCell align="right">Médiane</TableCell>
                  <TableCell align="right">p95</TableCell>
                  <TableCell align="right">Jetons entrée / sortie</TableCell>
                  <TableCell align="right">Coût estimé</TableCell>
                  <TableCell>Dernier problème</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data?.features ?? []).map((row) => (
                  <TableRow key={`${row.feature}-${row.provider}`}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {featureLabels[row.feature] ?? row.feature}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.model}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{integer(row.calls)}</TableCell>
                    <TableCell align="right">
                      {row.errors ? (
                        <Chip size="small" color="error" label={row.errors} />
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {row.fallbacks ? (
                        <Chip
                          size="small"
                          color="warning"
                          label={row.fallbacks}
                        />
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {(row.p50Ms / 1000).toFixed(2)} s
                    </TableCell>
                    <TableCell align="right">
                      {(row.p95Ms / 1000).toFixed(2)} s
                    </TableCell>
                    <TableCell align="right">
                      {integer(row.inputTokens)} / {integer(row.outputTokens)}
                    </TableCell>
                    <TableCell align="right">{usd(row.costUsd)}</TableCell>
                    <TableCell>{shortDate(row.lastProblemAtUtc)}</TableCell>
                  </TableRow>
                ))}
                {!usage.isLoading && !data?.features.length && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      Aucun appel IA sur la période.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1 }}
          >
            Coût estimé au tarif public de Google. NuExtract et PaddleOCR
            tournent sur Cloud Run : leur coût apparaît dans la facture Google
            Cloud (section Coûts cloud).
          </Typography>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              Qualité de l’assistant
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 2 }}>
              <Chip label={`${assistant?.answers ?? 0} réponses`} />
              <Chip
                color="success"
                variant="outlined"
                label={`${assistant?.likes ?? 0} utiles`}
              />
              <Chip
                color="error"
                variant="outlined"
                label={`${assistant?.dislikes ?? 0} pas utiles`}
              />
              <Chip
                variant="outlined"
                label={`${assistant?.comments ?? 0} commentaires`}
              />
              <Chip
                variant="outlined"
                color={assistant?.withoutSource ? "warning" : "default"}
                label={`${assistant?.withoutSource ?? 0} sans source`}
              />
            </Stack>
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer>
                <BarChart
                  data={(assistant?.weekly ?? []).map((week) => ({
                    semaine: week.week.slice(5),
                    Utiles: week.likes,
                    "Pas utiles": week.dislikes,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="semaine" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <ChartTooltip />
                  <Legend />
                  <Bar dataKey="Utiles" fill="#17624c" />
                  <Bar dataKey="Pas utiles" fill="#b42318" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              Cabinets qui utilisent l’assistant
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Cabinet</TableCell>
                  <TableCell align="right">Questions</TableCell>
                  <TableCell align="right">Pas utiles</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(assistant?.organizations ?? []).map((row) => (
                  <TableRow key={row.organizationName}>
                    <TableCell>{row.organizationName}</TableCell>
                    <TableCell align="right">{row.answers}</TableCell>
                    <TableCell align="right">{row.dislikes}</TableCell>
                  </TableRow>
                ))}
                {!assistant?.organizations.length && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      Aucune question sur la période.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{
              justifyContent: "space-between",
              alignItems: { sm: "center" },
              mb: 1.5,
            }}
          >
            <Box>
              <Typography variant="h6">Réponses notées</Typography>
              <Typography variant="body2" color="text.secondary">
                Seules les réponses qu’un utilisateur a notées apparaissent ici.
                Les réponses « pas utiles » sont à corriger en priorité.
              </Typography>
            </Box>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={rating}
              onChange={(_, value: "down" | "up" | "all" | null) =>
                value && setRating(value)
              }
            >
              <ToggleButton value="down">
                <ThumbDownOutlined fontSize="small" sx={{ mr: 0.5 }} />
                Pas utiles
              </ToggleButton>
              <ToggleButton value="up">
                <ThumbUpOutlined fontSize="small" sx={{ mr: 0.5 }} />
                Utiles
              </ToggleButton>
              <ToggleButton value="all">Toutes</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {feedback.isLoading && <LinearProgress aria-label="Chargement" />}
          <Stack spacing={1.5}>
            {(feedback.data ?? []).map((item) => (
              <Box
                key={item.id}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 1.5,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", flexWrap: "wrap", mb: 1 }}
                >
                  <Chip
                    size="small"
                    color={item.rating > 0 ? "success" : "error"}
                    icon={
                      item.rating > 0 ? (
                        <ThumbUpOutlined />
                      ) : (
                        <ThumbDownOutlined />
                      )
                    }
                    label={item.rating > 0 ? "Utile" : "Pas utile"}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {item.organizationName}
                    {item.dossierName ? ` · ${item.dossierName}` : ""} ·{" "}
                    {shortDate(item.feedbackAtUtc)}
                  </Typography>
                </Stack>
                {item.comment && (
                  <Alert severity="info" sx={{ mb: 1 }}>
                    {item.comment}
                  </Alert>
                )}
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {item.question}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    whiteSpace: "pre-wrap",
                    mt: 0.5,
                    maxHeight: 160,
                    overflow: "auto",
                  }}
                >
                  {item.answer}
                </Typography>
                {item.sources.length > 0 && (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ flexWrap: "wrap", mt: 1, gap: 0.5 }}
                  >
                    {item.sources.slice(0, 8).map((source) => (
                      <Chip
                        key={source}
                        size="small"
                        variant="outlined"
                        label={source}
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            ))}
            {!feedback.isLoading && !feedback.data?.length && (
              <Typography variant="body2" color="text.secondary">
                Aucune réponse notée pour ce filtre.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
