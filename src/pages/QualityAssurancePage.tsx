import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutlineRounded,
  ErrorOutlineRounded,
  FactCheckOutlined,
  InfoOutlined,
  WarningAmberRounded,
} from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { QueryState } from "../components/WorkspaceTools";
import type { DossierSummary, PagedResponse } from "../types/api";

type QualitySeverity = "BLOCKER" | "WARNING" | "INFO";

interface QualityFinding {
  code: string;
  severity: QualitySeverity;
  category: string;
  title: string;
  details: string;
  count?: number;
  actionLabel: string;
  actionPath: string;
}

interface QualityDossierReport {
  dossier: {
    id: string;
    legalName: string;
    tradeName: string | null;
  };
  score: number;
  counts: Record<QualitySeverity, number>;
  findings: QualityFinding[];
}

interface QualitySummary {
  generatedAtUtc: string;
  totals: {
    dossiersChecked: number;
    averageScore: number;
    BLOCKER: number;
    WARNING: number;
    INFO: number;
  };
  dossiers: QualityDossierReport[];
}

const severityLabels: Record<QualitySeverity, string> = {
  BLOCKER: "Bloquant",
  WARNING: "Alerte",
  INFO: "Info",
};

const severityColors: Record<QualitySeverity, "error" | "warning" | "info"> = {
  BLOCKER: "error",
  WARNING: "warning",
  INFO: "info",
};

const categoryLabels: Record<string, string> = {
  DOSSIER: "Dossier",
  DOCUMENTS: "Documents",
  TASKS: "Tâches",
  OBLIGATIONS: "Obligations",
  ACCOUNTING: "Comptabilité",
  BANK: "Banque",
  FISCAL: "Fiscal",
  PAYROLL: "Paie",
  INVOICES: "Factures",
};

function scoreColor(score: number) {
  if (score >= 85) return "success.main";
  if (score >= 65) return "warning.main";
  return "error.main";
}

function ScoreCard({
  title,
  score,
  subtitle,
}: {
  title: string;
  score: number;
  subtitle: string;
}) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <FactCheckOutlined color="primary" />
          <Typography sx={{ fontWeight: 850 }}>{title}</Typography>
        </Stack>
        <Typography
          variant="h3"
          sx={{ mt: 1.5, color: scoreColor(score), fontSize: 46 }}
        >
          {score}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={score}
          color={score >= 85 ? "success" : score >= 65 ? "warning" : "error"}
          sx={{ my: 1.25, height: 8, borderRadius: 999 }}
        />
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function QualityAssurancePage() {
  const { organization, can } = useAuth();
  const organizationId = organization?.id ?? "";
  const [dossierId, setDossierId] = useState("");

  const dossierOptions = useQuery({
    queryKey: ["qa-dossier-options", organizationId],
    queryFn: () =>
      api.get<PagedResponse<DossierSummary>>(
        `/api/organizations/${organizationId}/dossiers?page=1&pageSize=100`,
      ),
    enabled: Boolean(organizationId && can("dossiers.view")),
  });

  const quality = useQuery({
    queryKey: ["quality-assurance", organizationId, dossierId],
    queryFn: () =>
      api.get<QualitySummary>(
        `/api/organizations/${organizationId}/quality-assurance${
          dossierId ? `?dossierId=${dossierId}` : ""
        }`,
      ),
    enabled: Boolean(organizationId && can("quality_assurance.view")),
  });

  const findings = useMemo(
    () =>
      (quality.data?.dossiers ?? []).flatMap((report) =>
        report.findings.map((finding) => ({
          ...finding,
          dossier: report.dossier,
          score: report.score,
        })),
      ),
    [quality.data],
  );

  if (!can("quality_assurance.view")) {
    return (
      <Alert severity="warning">
        Vous n’avez pas l’autorisation de consulter l’assurance qualité.
      </Alert>
    );
  }

  const clean = quality.data && findings.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Pilotage de production"
        title="Assurance qualité"
        description="Contrôlez les dossiers avant validation : pièces, échéances, écritures, banque, fiscalité et paie."
        action={
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 320 } }}>
            <InputLabel>Dossier</InputLabel>
            <Select
              label="Dossier"
              value={dossierId}
              onChange={(event) => setDossierId(event.target.value)}
            >
              <MenuItem value="">Tous les dossiers actifs</MenuItem>
              {dossierOptions.data?.items.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.legalName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        }
      />

      <QueryState
        loading={quality.isLoading}
        error={quality.isError}
        empty={false}
      />

      {quality.data && (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "0.9fr 1.6fr" },
              gap: 2,
              mb: 2,
            }}
          >
            <Box>
              <ScoreCard
                title="Score qualité"
                score={quality.data.totals.averageScore}
                subtitle={`${quality.data.totals.dossiersChecked} dossier(s) contrôlé(s)`}
              />
            </Box>
            <Box>
              <Card sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="h5">Synthèse des contrôles</Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                      gap: 1.5,
                      mt: 1,
                    }}
                  >
                    <Box>
                      <Alert
                        severity="error"
                        icon={<ErrorOutlineRounded />}
                        sx={{ height: "100%" }}
                      >
                        <Typography sx={{ fontWeight: 900, fontSize: 26 }}>
                          {quality.data.totals.BLOCKER}
                        </Typography>
                        Bloquant(s)
                      </Alert>
                    </Box>
                    <Box>
                      <Alert
                        severity="warning"
                        icon={<WarningAmberRounded />}
                        sx={{ height: "100%" }}
                      >
                        <Typography sx={{ fontWeight: 900, fontSize: 26 }}>
                          {quality.data.totals.WARNING}
                        </Typography>
                        Alerte(s)
                      </Alert>
                    </Box>
                    <Box>
                      <Alert
                        severity="info"
                        icon={<InfoOutlined />}
                        sx={{ height: "100%" }}
                      >
                        <Typography sx={{ fontWeight: 900, fontSize: 26 }}>
                          {quality.data.totals.INFO}
                        </Typography>
                        Information(s)
                      </Alert>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {clean && (
            <Alert
              severity="success"
              icon={<CheckCircleOutlineRounded />}
              sx={{ mb: 2 }}
            >
              Tout est propre pour le périmètre sélectionné. Aucun point qualité
              ouvert.
            </Alert>
          )}

          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 2.5 }}>
                <Typography variant="h5">Points à corriger</Typography>
                <Typography color="text.secondary">
                  Les points bloquants doivent être traités avant dépôt,
                  clôture ou reporting client.
                </Typography>
              </Box>
              <QueryState
                loading={false}
                error={false}
                empty={!findings.length}
                emptyText="Aucun point qualité ouvert."
              />
              {findings.length > 0 && (
                <Box sx={{ overflowX: "auto" }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Dossier</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Contrôle</TableCell>
                        <TableCell>Détail</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {findings.map((finding) => (
                        <TableRow key={`${finding.dossier.id}-${finding.code}`}>
                          <TableCell>
                            <Typography sx={{ fontWeight: 800 }}>
                              {finding.dossier.legalName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Score {finding.score}/100
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.75} sx={{ alignItems: "flex-start" }}>
                              <Chip
                                size="small"
                                color={severityColors[finding.severity]}
                                label={severityLabels[finding.severity]}
                              />
                              <Chip
                                size="small"
                                variant="outlined"
                                label={categoryLabels[finding.category] ?? finding.category}
                              />
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 800 }}>
                              {finding.title}
                            </Typography>
                            {finding.count !== undefined && (
                              <Typography variant="caption" color="text.secondary">
                                {finding.count} élément(s)
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 470 }}>
                            {finding.details}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              component={RouterLink}
                              to={finding.actionPath}
                              size="small"
                              variant={finding.severity === "BLOCKER" ? "contained" : "outlined"}
                            >
                              {finding.actionLabel}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
