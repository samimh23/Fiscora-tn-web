import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { CalculateRounded, DownloadRounded } from "@mui/icons-material";
import { api, downloadApiFile } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DossierSelector, Money } from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";

interface AnnualTaxReport {
  warning: string;
  period: { year: number; startsOn: string; endsOn: string };
  accounting: { revenue: string; expenses: string; accountingResult: string };
  fiscal: {
    regime: "IS" | "FORFAITAIRE";
    reintegrationsTotal: string;
    deductionsTotal: string;
    fiscalResult: string;
    corporateTaxRate: string;
    grossCorporateTax: string;
    minimumTax: string;
    taxCredits: string;
    forfaitaireTax: string;
    netTaxDue: string;
  };
  installments: Array<{ label: string; dueOn: string; amount: string }>;
  liasseChecklist: Array<{ label: string; status: "OK" | "A_COMPLETER" }>;
}

export function AnnualTaxPage() {
  const { organization } = useAuth();
  const [dossierId, setDossierId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState({
    regime: "IS",
    corporateTaxRate: "0.15000",
    minimumTax: "0",
    taxCredits: "0",
    forfaitaireTax: "0",
    reintegrationLabel: "",
    reintegrationAmount: "",
    deductionLabel: "",
    deductionAmount: "",
  });
  const [report, setReport] = useState<AnnualTaxReport | null>(null);
  const [error, setError] = useState("");
  const base =
    organization?.id && dossierId
      ? `/api/organizations/${organization.id}/dossiers/${dossierId}/annual-tax/${year}`
      : "";

  const payload = () => ({
    regime: form.regime,
    corporateTaxRate: form.corporateTaxRate,
    minimumTax: form.minimumTax || "0",
    taxCredits: form.taxCredits || "0",
    forfaitaireTax: form.forfaitaireTax || "0",
    reintegrations:
      form.reintegrationLabel && form.reintegrationAmount
        ? [{ label: form.reintegrationLabel, amount: form.reintegrationAmount }]
        : [],
    deductions:
      form.deductionLabel && form.deductionAmount
        ? [{ label: form.deductionLabel, amount: form.deductionAmount }]
        : [],
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

  const exportFile = async (format: "pdf" | "csv") => {
    if (!base) return;
    const params = new URLSearchParams({
      format,
      regime: form.regime,
      corporateTaxRate: form.corporateTaxRate,
      minimumTax: form.minimumTax || "0",
      taxCredits: form.taxCredits || "0",
      forfaitaireTax: form.forfaitaireTax || "0",
    });
    await downloadApiFile(
      `${base}/export?${params.toString()}`,
      `fiscal-annuel-${year}.${format}`,
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Fiscal"
        title="Fiscal annuel"
        description="IS annuel, régime forfaitaire, pré-liasse fiscale et acomptes provisionnels."
        action={<DossierSelector value={dossierId} onChange={setDossierId} />}
      />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField type="number" label="Exercice" value={year} onChange={(event) => setYear(Number(event.target.value))} />
            <TextField select label="Régime" value={form.regime} onChange={(event) => setForm({ ...form, regime: event.target.value })} sx={{ minWidth: 180 }}>
              <MenuItem value="IS">IS annuel</MenuItem>
              <MenuItem value="FORFAITAIRE">Régime forfaitaire</MenuItem>
            </TextField>
            <TextField label="Taux IS" value={form.corporateTaxRate} onChange={(event) => setForm({ ...form, corporateTaxRate: event.target.value })} />
            <TextField label="Minimum / avance" value={form.minimumTax} onChange={(event) => setForm({ ...form, minimumTax: event.target.value })} />
            <TextField label="Crédits imputables" value={form.taxCredits} onChange={(event) => setForm({ ...form, taxCredits: event.target.value })} />
          </Stack>
          <Divider sx={{ my: 3 }} />
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField fullWidth label="Réintégration fiscale" placeholder="Ex : charge non déductible" value={form.reintegrationLabel} onChange={(event) => setForm({ ...form, reintegrationLabel: event.target.value })} />
            <TextField label="Montant" value={form.reintegrationAmount} onChange={(event) => setForm({ ...form, reintegrationAmount: event.target.value })} />
            <TextField fullWidth label="Déduction fiscale" placeholder="Ex : produit exonéré" value={form.deductionLabel} onChange={(event) => setForm({ ...form, deductionLabel: event.target.value })} />
            <TextField label="Montant" value={form.deductionAmount} onChange={(event) => setForm({ ...form, deductionAmount: event.target.value })} />
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ mt: 3, flexWrap: "wrap" }}>
            <Button variant="contained" startIcon={<CalculateRounded />} disabled={!base || calculate.isPending} onClick={() => calculate.mutate()}>
              Calculer
            </Button>
            <Button startIcon={<DownloadRounded />} disabled={!base} onClick={() => void exportFile("pdf")}>Export PDF</Button>
            <Button startIcon={<DownloadRounded />} disabled={!base} onClick={() => void exportFile("csv")}>Export CSV</Button>
          </Stack>
        </CardContent>
      </Card>

      {report && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Alert severity="warning" sx={{ mb: 2 }}>{report.warning}</Alert>
            <Typography variant="h5" sx={{ mb: 1 }}>Résultat fiscal {report.period.year}</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>Période du {report.period.startsOn} au {report.period.endsOn}</Typography>
            <Table size="small">
              <TableBody>
                {[
                  ["Produits", report.accounting.revenue],
                  ["Charges", report.accounting.expenses],
                  ["Résultat comptable", report.accounting.accountingResult],
                  ["Réintégrations", report.fiscal.reintegrationsTotal],
                  ["Déductions", report.fiscal.deductionsTotal],
                  ["Résultat fiscal", report.fiscal.fiscalResult],
                  ["IS brut", report.fiscal.grossCorporateTax],
                  ["Net à payer / forfaitaire", report.fiscal.netTaxDue],
                ].map(([label, value]) => (
                  <TableRow key={label}>
                    <TableCell>{label}</TableCell>
                    <TableCell align="right"><Money value={value} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Typography variant="h6" sx={{ mt: 3 }}>Acomptes provisionnels</Typography>
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
                    <TableCell align="right"><Money value={item.amount} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Typography variant="h6" sx={{ mt: 3 }}>Checklist liasse fiscale</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mt: 1 }}>
              {report.liasseChecklist.map((item) => (
                <Chip key={item.label} label={item.label} color={item.status === "OK" ? "success" : "warning"} variant="outlined" />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </>
  );
}
