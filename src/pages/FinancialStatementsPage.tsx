import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  DownloadRounded,
  LockRounded,
  RefreshRounded,
  RuleRounded,
} from "@mui/icons-material";
import { api, downloadApiFile } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  DossierSelector,
  Money,
  QueryState,
} from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";

interface StatementLine {
  code: string;
  label: string;
  group: string;
  current: string;
  previous: string;
  noteNumber: number | null;
}
interface StatementReport {
  source: string;
  currencyCode: string;
  period: { year: number };
  comparisonPeriod: { year: number };
  balanceSheet: {
    assets: StatementLine[];
    equityAndLiabilities: StatementLine[];
    totalAssets: Pair;
    totalEquityAndLiabilities: Pair;
    balanceDifference: Pair;
  };
  incomeStatement: {
    lines: StatementLine[];
    operatingResult: Pair;
    ordinaryResultBeforeTax: Pair;
    netResult: Pair;
  };
  cashFlowStatement: {
    lines: StatementLine[];
    operatingCashFlow: Pair;
    investingCashFlow: Pair;
    financingCashFlow: Pair;
    cashVariation: Pair;
    closingCash: Pair;
    reconciliationDifference: Pair;
  };
  controls: Array<{
    code: string;
    label: string;
    status: "OK" | "ANOMALIE";
    message: string;
  }>;
  mappingWarnings: Array<{ accountId: string; code: string; name: string }>;
  notes: {
    status: string;
    reviewComment: string | null;
    sections: NoteSection[];
  } | null;
}
interface NoteSection {
  id: string;
  noteNumber: number;
  title: string;
  content: string;
  isRequired: boolean;
}
interface Pair {
  current: string;
  previous: string;
}

function LinesTable({
  lines,
  year,
  previousYear,
}: {
  lines: StatementLine[];
  year: number;
  previousYear: number;
}) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Rubrique</TableCell>
          <TableCell align="right">{previousYear}</TableCell>
          <TableCell align="right">{year}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={`${line.code}-${line.label}`}>
            <TableCell>
              <Typography
                sx={{ fontWeight: line.group === "TOTAL" ? 750 : 500 }}
              >
                {line.code} · {line.label}
              </Typography>
              {line.noteNumber && (
                <Typography variant="caption" color="text.secondary">
                  Note {line.noteNumber}
                </Typography>
              )}
            </TableCell>
            <TableCell align="right">
              <Money value={line.previous} />
            </TableCell>
            <TableCell align="right">
              <Money value={line.current} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function NoteEditor({ section, disabled, onSave }: { section: NoteSection; disabled: boolean; onSave: (content: string) => void }) {
  const [content, setContent] = useState(section.content);
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "flex-start" } }}>
          <Box sx={{ minWidth: 220 }}>
            <Typography variant="h6">Note {section.noteNumber}</Typography>
            <Typography color="text.secondary">{section.title}</Typography>
            {section.isRequired && <Chip size="small" color="warning" label="Obligatoire" sx={{ mt: 1 }} />}
          </Box>
          <TextField fullWidth multiline minRows={4} label="Commentaire et méthodes appliquées" value={content} onChange={(event) => setContent(event.target.value)} />
          <Button variant="outlined" disabled={disabled} onClick={() => onSave(content)}>Enregistrer</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function FinancialStatementsPage() {
  const { organization, can } = useAuth();
  const [dossierId, setDossierId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [tab, setTab] = useState(0);
  const [message, setMessage] = useState("");
  const qc = useQueryClient();
  const base =
    organization?.id && dossierId
      ? `/api/organizations/${organization.id}/dossiers/${dossierId}/financial-statements`
      : "";
  const query = useQuery({
    queryKey: ["financial-statements", organization?.id, dossierId, year],
    queryFn: () => api.get<StatementReport>(`${base}/statements/${year}`),
    enabled: Boolean(base),
  });
  const refresh = useCallback(
    () =>
      qc.invalidateQueries({
        queryKey: ["financial-statements", organization?.id, dossierId, year],
      }),
    [dossierId, organization?.id, qc, year],
  );
  const action = useMutation({
    mutationFn: ({ path }: { path: string }) => api.post<unknown>(path),
    onSuccess: () => {
      setMessage("Action terminée avec succès.");
      void refresh();
    },
  });
  const saveNote = useMutation({
    mutationFn: ({ sectionId, content }: { sectionId: string; content: string }) =>
      api.put(`${base}/notes/${year}/sections/${sectionId}`, { content }),
    onSuccess: () => {
      setMessage("Annexe enregistrée.");
      void refresh();
    },
  });
  const run = (path: string) => {
    setMessage("");
    action.mutate({ path });
  };
  const lines =
    tab === 0
      ? [
          ...(query.data?.balanceSheet.assets ?? []),
          ...(query.data?.balanceSheet.equityAndLiabilities ?? []),
        ]
      : tab === 1
        ? (query.data?.incomeStatement.lines ?? [])
        : (query.data?.cashFlowStatement.lines ?? []);

  return (
    <>
      <PageHeader
        eyebrow="Clôture & reporting"
        title="États financiers"
        description="Bilan, état de résultat, flux de trésorerie et annexes selon le système comptable tunisien."
        action={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <DossierSelector value={dossierId} onChange={setDossierId} />
            <TextField
              select
              size="small"
              label="Exercice"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              sx={{ minWidth: 120 }}
            >
              {[0, 1, 2, 3, 4].map((offset) => {
                const value = new Date().getFullYear() - offset;
                return (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                );
              })}
            </TextField>
          </Stack>
        }
      />
      {(message || action.error || saveNote.error) && (
        <Alert severity={action.error || saveNote.error ? "error" : "success"} sx={{ mb: 2 }}>
          {action.error instanceof Error
            ? action.error.message
            : saveNote.error instanceof Error
              ? saveNote.error.message
              : message}
        </Alert>
      )}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            sx={{ alignItems: { md: "center" } }}
          >
            <Button
              startIcon={<RuleRounded />}
              disabled={
                !base || !can("financial_statements.manage") || action.isPending
              }
              onClick={() => run(`${base}/mappings/apply-defaults`)}
            >
              Appliquer le classement NC 01
            </Button>
            <Button
              startIcon={<RefreshRounded />}
              disabled={
                !base || !can("financial_statements.manage") || action.isPending
              }
              onClick={() => run(`${base}/notes/${year}/generate`)}
            >
              Générer les annexes
            </Button>
            <Button
              disabled={
                !base || !can("financial_statements.manage") || action.isPending
              }
              onClick={() => run(`${base}/notes/${year}/submit`)}
            >
              Soumettre les annexes
            </Button>
            <Button
              color="success"
              disabled={
                !base ||
                !can("financial_statements.validate") ||
                action.isPending
              }
              onClick={() => run(`${base}/notes/${year}/validate`)}
            >
              Valider les annexes
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              startIcon={<DownloadRounded />}
              disabled={!query.data}
              onClick={() =>
                void downloadApiFile(
                  `${base}/statements/${year}/export?format=xlsx`,
                  `etats-financiers-${year}.xlsx`,
                )
              }
            >
              Excel
            </Button>
            <Button
              startIcon={<DownloadRounded />}
              disabled={!query.data}
              onClick={() =>
                void downloadApiFile(
                  `${base}/statements/${year}/export?format=pdf`,
                  `etats-financiers-${year}.pdf`,
                )
              }
            >
              PDF
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<LockRounded />}
              disabled={
                !base ||
                !can("financial_statements.validate") ||
                action.isPending
              }
              onClick={() => run(`${base}/statements/${year}/finalize`)}
            >
              Figer l’exercice
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <QueryState
        loading={query.isLoading}
        error={query.isError}
        empty={!dossierId}
        emptyText="Choisissez un dossier."
      />
      {query.data && (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
            <Chip
              label={
                query.data.source === "SNAPSHOT_DEFINITIF"
                  ? "Version définitive"
                  : "Prévisualisation temps réel"
              }
              color={
                query.data.source === "SNAPSHOT_DEFINITIF" ? "success" : "info"
              }
            />
            <Chip
              label={`Annexes : ${query.data.notes?.status ?? "non générées"}`}
            />
          </Stack>
          {(query.data.controls.some((item) => item.status === "ANOMALIE") ||
            query.data.mappingWarnings.length > 0) && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {query.data.controls
                .filter((item) => item.status === "ANOMALIE")
                .map((item) => item.message)
                .join(" · ")}{" "}
              {query.data.mappingWarnings.length
                ? `· ${query.data.mappingWarnings.length} compte(s) à classer.`
                : ""}
            </Alert>
          )}
          <Card>
            <Tabs
              value={tab}
              onChange={(_, value) => setTab(value)}
              sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
            >
              <Tab label="Bilan" />
              <Tab label="État de résultat" />
              <Tab label="Flux de trésorerie" />
              <Tab label="Annexes" />
            </Tabs>
            {tab < 3 ? (
              <Box sx={{ overflowX: "auto" }}>
                <LinesTable lines={lines} year={year} previousYear={year - 1} />
              </Box>
            ) : (
              <Box sx={{ p: 2 }}>
                {!query.data.notes && (
                  <Alert severity="info">Générez d’abord les annexes de cet exercice.</Alert>
                )}
                <Stack spacing={2}>
                  {query.data.notes?.sections.map((section) => (
                    <NoteEditor
                      key={section.id}
                      section={section}
                      disabled={!can("financial_statements.manage") || saveNote.isPending}
                      onSave={(content) => saveNote.mutate({ sectionId: section.id, content })}
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Card>
        </>
      )}
    </>
  );
}
