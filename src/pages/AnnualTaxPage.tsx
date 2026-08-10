import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
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
  CalculateRounded,
  DownloadRounded,
  LockRounded,
} from "@mui/icons-material";
import { api, downloadApiFile } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  DossierSelector,
  Money,
  QueryState,
} from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";
import { useDossierSelection } from "../hooks/useDossierSelection";

interface AnnualTaxReport {
  warning: string;
  finalized: boolean;
  period: { year: number; startsOn: string; endsOn: string };
  accounting: { revenue: string; expenses: string; accountingResult: string };
  fiscal: {
    regime: "IS" | "FORFAITAIRE";
    reintegrationsTotal: string;
    deductionsTotal: string;
    fiscalResultBeforeCarryforward: string;
    carryforwardApplied: string;
    carryforwardAvailable: string;
    fiscalResult: string;
    corporateTaxRate: string;
    grossCorporateTax: string;
    minimumTax: string;
    forfaitaireTax: string;
    baseTax: string;
    taxCredits: string;
    netTaxDue: string;
  };
  regularisation: {
    impotDu: string;
    retenueALaSourceSubie: string;
    acomptesVerses: string;
    excedentsAnterieurs: string;
    autresCredits: string;
    resultat: string;
    sens: "REPORT" | "DU";
  };
  installments: Array<{ label: string; dueOn: string; amount: string }>;
  liasseChecklist: Array<{ label: string; status: "OK" | "A_COMPLETER" }>;
}

interface DeficitRow {
  id: string;
  originYear: number;
  originalAmount: string;
  remainingAmount: string;
  expiresAfterYear: number;
  status: "DISPONIBLE" | "EPUISE";
}

export function AnnualTaxPage() {
  const { organization } = useAuth();
  const qc = useQueryClient();
  const [dossierId, setDossierId] = useDossierSelection();
  const [year, setYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState({
    regime: "IS",
    corporateTaxRate: "",
    minimumTax: "",
    taxCredits: "0",
    forfaitaireTax: "",
    acomptesVerses: "0",
    excedentsAnterieurs: "0",
    reintegrationLabel: "",
    reintegrationAmount: "",
    deductionLabel: "",
    deductionAmount: "",
  });
  const [report, setReport] = useState<AnnualTaxReport | null>(null);
  const [error, setError] = useState("");
  const root =
    organization?.id && dossierId
      ? `/api/organizations/${organization.id}/dossiers/${dossierId}/annual-tax`
      : "";
  const base = root ? `${root}/${year}` : "";

  const payload = () => ({
    regime: form.regime,
    ...(form.corporateTaxRate
      ? { corporateTaxRate: form.corporateTaxRate }
      : {}),
    ...(form.minimumTax ? { minimumTax: form.minimumTax } : {}),
    taxCredits: form.taxCredits || "0",
    ...(form.forfaitaireTax ? { forfaitaireTax: form.forfaitaireTax } : {}),
    acomptesVerses: form.acomptesVerses || "0",
    excedentsAnterieurs: form.excedentsAnterieurs || "0",
    reintegrations:
      form.reintegrationLabel && form.reintegrationAmount
        ? [{ label: form.reintegrationLabel, amount: form.reintegrationAmount }]
        : [],
    deductions:
      form.deductionLabel && form.deductionAmount
        ? [{ label: form.deductionLabel, amount: form.deductionAmount }]
        : [],
  });

  const deficits = useQuery({
    queryKey: ["annual-tax-deficits", organization?.id, dossierId],
    queryFn: () => api.get<DeficitRow[]>(`${root}/deficits`),
    enabled: Boolean(root),
  });

  const calculate = useMutation({
    mutationFn: () => api.post<AnnualTaxReport>(`${base}/calculate`, payload()),
    onSuccess: (data) => {
      setReport(data);
      setError("");
    },
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : "Calcul impossible."),
  });

  const finalize = useMutation({
    mutationFn: () => api.post<AnnualTaxReport>(`${base}/finalize`, payload()),
    onSuccess: (data) => {
      setReport(data);
      setError("");
      void qc.invalidateQueries({ queryKey: ["annual-tax-deficits"] });
    },
    onError: (reason) =>
      setError(
        reason instanceof Error ? reason.message : "Clôture impossible.",
      ),
  });

  const exportFile = async (format: "pdf" | "csv") => {
    if (!base) return;
    const params = new URLSearchParams({
      format,
      regime: form.regime,
      taxCredits: form.taxCredits || "0",
      ...(form.corporateTaxRate
        ? { corporateTaxRate: form.corporateTaxRate }
        : {}),
      ...(form.minimumTax ? { minimumTax: form.minimumTax } : {}),
      ...(form.forfaitaireTax ? { forfaitaireTax: form.forfaitaireTax } : {}),
    });
    await downloadApiFile(
      `${base}/export?${params.toString()}`,
      `fiscal-annuel-${year}.${format}`,
    );
  };

  const exportAnnex = async (
    kind: "amortissements" | "retenues-source",
    format: "pdf" | "csv",
  ) => {
    if (!base) return;
    await downloadApiFile(
      `${base}/annexes/${kind}/export?format=${format}`,
      `${kind}-${year}.${format}`,
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Fiscal"
        title="Fiscal annuel"
        description="IS annuel, régime forfaitaire, pré-liasse fiscale, annexes et acomptes provisionnels."
        action={<DossierSelector value={dossierId} onChange={setDossierId} />}
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              type="number"
              label="Exercice"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
            <TextField
              select
              label="Régime"
              value={form.regime}
              onChange={(event) =>
                setForm({ ...form, regime: event.target.value })
              }
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="IS">IS annuel</MenuItem>
              <MenuItem value="FORFAITAIRE">Régime forfaitaire</MenuItem>
            </TextField>
            <TextField
              label="Taux IS"
              placeholder="Auto (selon secteur)"
              helperText="Laisser vide pour résoudre automatiquement selon le secteur du dossier"
              value={form.corporateTaxRate}
              onChange={(event) =>
                setForm({ ...form, corporateTaxRate: event.target.value })
              }
            />
            <TextField
              label="Minimum / avance"
              placeholder="Auto"
              helperText="Laisser vide pour appliquer le minimum d'impôt configuré"
              value={form.minimumTax}
              onChange={(event) =>
                setForm({ ...form, minimumTax: event.target.value })
              }
            />
            <TextField
              label="Crédits imputables"
              value={form.taxCredits}
              onChange={(event) =>
                setForm({ ...form, taxCredits: event.target.value })
              }
            />
          </Stack>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ mt: 2 }}
          >
            <TextField
              label="Acomptes provisionnels versés"
              helperText="Montant déjà versé au titre de cet exercice"
              value={form.acomptesVerses}
              onChange={(event) =>
                setForm({ ...form, acomptesVerses: event.target.value })
              }
            />
            <TextField
              label="Excédents antérieurs"
              helperText="Crédit reporté d'un exercice précédent"
              value={form.excedentsAnterieurs}
              onChange={(event) =>
                setForm({ ...form, excedentsAnterieurs: event.target.value })
              }
            />
          </Stack>
          <Divider sx={{ my: 3 }} />
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              fullWidth
              label="Réintégration fiscale"
              placeholder="Ex : charge non déductible"
              value={form.reintegrationLabel}
              onChange={(event) =>
                setForm({ ...form, reintegrationLabel: event.target.value })
              }
            />
            <TextField
              label="Montant"
              value={form.reintegrationAmount}
              onChange={(event) =>
                setForm({ ...form, reintegrationAmount: event.target.value })
              }
            />
            <TextField
              fullWidth
              label="Déduction fiscale"
              placeholder="Ex : produit exonéré"
              value={form.deductionLabel}
              onChange={(event) =>
                setForm({ ...form, deductionLabel: event.target.value })
              }
            />
            <TextField
              label="Montant"
              value={form.deductionAmount}
              onChange={(event) =>
                setForm({ ...form, deductionAmount: event.target.value })
              }
            />
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ mt: 3, flexWrap: "wrap" }}>
            <Button
              variant="contained"
              startIcon={<CalculateRounded />}
              disabled={!base || calculate.isPending}
              onClick={() => calculate.mutate()}
            >
              Calculer
            </Button>
            <Button
              color="warning"
              variant="outlined"
              startIcon={<LockRounded />}
              disabled={!base || finalize.isPending}
              onClick={() => finalize.mutate()}
            >
              Clôturer l'exercice
            </Button>
            <Button
              startIcon={<DownloadRounded />}
              disabled={!base}
              onClick={() => void exportFile("pdf")}
            >
              Export pré-liasse PDF
            </Button>
            <Button
              startIcon={<DownloadRounded />}
              disabled={!base}
              onClick={() => void exportFile("csv")}
            >
              Export pré-liasse CSV
            </Button>
          </Stack>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ mt: 1.5, flexWrap: "wrap" }}
          >
            <Button
              size="small"
              startIcon={<DownloadRounded />}
              disabled={!base}
              onClick={() => void exportAnnex("amortissements", "pdf")}
            >
              Annexe amortissements PDF
            </Button>
            <Button
              size="small"
              startIcon={<DownloadRounded />}
              disabled={!base}
              onClick={() => void exportAnnex("amortissements", "csv")}
            >
              CSV
            </Button>
            <Button
              size="small"
              startIcon={<DownloadRounded />}
              disabled={!base}
              onClick={() => void exportAnnex("retenues-source", "pdf")}
            >
              Annexe retenues à la source PDF
            </Button>
            <Button
              size="small"
              startIcon={<DownloadRounded />}
              disabled={!base}
              onClick={() => void exportAnnex("retenues-source", "csv")}
            >
              CSV
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {report && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", mb: 2 }}
            >
              <Alert severity="warning" sx={{ flex: 1 }}>
                {report.warning}
              </Alert>
              {report.finalized && (
                <Chip color="success" label="Exercice clôturé" />
              )}
            </Stack>
            <Typography variant="h5" sx={{ mb: 1 }}>
              Résultat fiscal {report.period.year}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Période du {report.period.startsOn} au {report.period.endsOn}
            </Typography>

            <Typography variant="h6" sx={{ mb: 1 }}>
              Tableau de détermination du résultat fiscal
            </Typography>
            <Table size="small">
              <TableBody>
                {[
                  ["Produits", report.accounting.revenue],
                  ["Charges", report.accounting.expenses],
                  ["Résultat comptable", report.accounting.accountingResult],
                  ["Réintégrations", report.fiscal.reintegrationsTotal],
                  ["Déductions", report.fiscal.deductionsTotal],
                  [
                    "Résultat fiscal avant report déficitaire",
                    report.fiscal.fiscalResultBeforeCarryforward,
                  ],
                  [
                    "Report déficitaire imputé",
                    report.fiscal.carryforwardApplied,
                  ],
                  ["Résultat fiscal", report.fiscal.fiscalResult],
                ].map(([label, value]) => (
                  <TableRow key={label}>
                    <TableCell>{label}</TableCell>
                    <TableCell align="right">
                      <Money value={value} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
              Liquidation de l'impôt dû
            </Typography>
            <Table size="small">
              <TableBody>
                {[
                  ["Taux IS retenu", report.fiscal.corporateTaxRate],
                  ["IS brut", report.fiscal.grossCorporateTax],
                  [
                    report.fiscal.regime === "FORFAITAIRE"
                      ? "Forfaitaire"
                      : "Minimum d'impôt",
                    report.fiscal.regime === "FORFAITAIRE"
                      ? report.fiscal.forfaitaireTax
                      : report.fiscal.minimumTax,
                  ],
                  ["Impôt dû (I)", report.fiscal.baseTax],
                ].map(([label, value]) => (
                  <TableRow key={label}>
                    <TableCell>{label}</TableCell>
                    <TableCell align="right">
                      <Money value={value} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
              Régularisation
            </Typography>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>
                    Retenue à la source subie (auto, voir annexe)
                  </TableCell>
                  <TableCell align="right">
                    <Money
                      value={report.regularisation.retenueALaSourceSubie}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Acomptes provisionnels versés</TableCell>
                  <TableCell align="right">
                    <Money value={report.regularisation.acomptesVerses} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Excédents antérieurs</TableCell>
                  <TableCell align="right">
                    <Money value={report.regularisation.excedentsAnterieurs} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Autres crédits imputables</TableCell>
                  <TableCell align="right">
                    <Money value={report.regularisation.autresCredits} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {report.regularisation.sens === "REPORT"
                      ? "Report (crédit à reporter)"
                      : "Net à payer (IV)"}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    <Money value={report.regularisation.resultat} />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Typography variant="h6" sx={{ mt: 3 }}>
              Acomptes provisionnels (exercice suivant)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tranche</TableCell>
                  <TableCell>Échéance</TableCell>
                  <TableCell align="right">Montant</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.installments.map((item) => (
                  <TableRow key={item.label}>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>{item.dueOn}</TableCell>
                    <TableCell align="right">
                      <Money value={item.amount} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Typography variant="h6" sx={{ mt: 3 }}>
              Checklist liasse fiscale
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mt: 1 }}>
              {report.liasseChecklist.map((item) => (
                <Chip
                  key={item.label}
                  label={item.label}
                  color={item.status === "OK" ? "success" : "warning"}
                  variant="outlined"
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Déficits reportés
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Pertes fiscales des exercices clôturés, imputables sur les 4
            exercices suivants.
          </Typography>
          <QueryState
            loading={deficits.isLoading}
            error={deficits.isError}
            empty={!deficits.data?.length}
            emptyText="Aucun déficit reporté enregistré pour ce dossier."
          />
          {Boolean(deficits.data?.length) && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Exercice d'origine</TableCell>
                  <TableCell align="right">Montant initial</TableCell>
                  <TableCell align="right">Solde disponible</TableCell>
                  <TableCell>Expire après</TableCell>
                  <TableCell>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deficits.data?.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.originYear}</TableCell>
                    <TableCell align="right">
                      <Money value={row.originalAmount} />
                    </TableCell>
                    <TableCell align="right">
                      <Money value={row.remainingAmount} />
                    </TableCell>
                    <TableCell>{row.expiresAfterYear}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={
                          row.status === "DISPONIBLE" ? "Disponible" : "Épuisé"
                        }
                        color={
                          row.status === "DISPONIBLE" ? "success" : "default"
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
