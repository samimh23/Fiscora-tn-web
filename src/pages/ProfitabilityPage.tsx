import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { AddRounded } from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { MetricCard, Money, QueryState } from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";
import type { OrganizationMember } from "../types/api";
interface Profitability {
  basis: { warning: string };
  totals: {
    approvedHours: string;
    billedRevenueNet: string;
    collectedRevenueNet: string;
    allocatedEmployerCost: string;
    marginOnBilled: string;
    marginOnCollected: string;
  };
  dossiers: Array<{
    dossierId: string;
    dossierName: string;
    approvedHours: string;
    billableHours: string;
    billableRate: string;
    budgetConsumptionRate: string;
    allocatedPay: string;
    allocatedEmployerCost: string;
    billedRevenueNet: string;
    collectedRevenueNet: string;
    marginOnBilled: string;
    marginOnCollected: string;
    marginRateOnBilled: string;
    missingCostRateCount: number;
  }>;
  members: Array<{
    membershipId: string;
    fullName: string;
    approvedHours: string;
    billableRate: string;
    budgetConsumptionRate: string;
    payAmount: string;
    employerCost: string;
    allocatedBilledRevenue: string;
    contributionMarginBilled: string;
    missingCostRate: boolean;
  }>;
}
interface CostRate {
  id: string;
  membershipId: string;
  fullName: string;
  compensationType: string;
  payRateAmount: string;
  employerCostRateAmount: string;
  monthlyTargetHours: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}
export function ProfitabilityPage() {
  const { organization, can } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [from, setFrom] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
  );
  const [to, setTo] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10),
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    membershipId: "",
    compensationType: "MENSUELLE",
    payRateAmount: "",
    employerCostRateAmount: "",
    monthlyTargetMinutes: 9600,
    effectiveFrom: from,
  });
  const base = organization?.id ? `/api/organizations/${organization.id}` : "";
  const query = useQuery({
    queryKey: ["profitability", organization?.id, from, to],
    queryFn: () =>
      api.get<Profitability>(`${base}/profitability?from=${from}&to=${to}`),
    enabled: Boolean(base),
  });
  const rates = useQuery({
    queryKey: ["cost-rates", organization?.id],
    queryFn: () => api.get<CostRate[]>(`${base}/team-cost-rates`),
    enabled: Boolean(base && can("team_costs.manage")),
  });
  const members = useQuery({
    queryKey: ["members-for-cost", organization?.id],
    queryFn: () => api.get<OrganizationMember[]>(`${base}/members`),
    enabled: Boolean(base && can("team_costs.manage")),
  });
  const save = useMutation({
    mutationFn: () => api.post(`${base}/team-cost-rates`, form),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["cost-rates"] });
      void qc.invalidateQueries({ queryKey: ["profitability"] });
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Pilotage économique"
        title="Rentabilité & performance"
        description="Comparez honoraires, coût employeur affecté et temps approuvé par client et collaborateur."
        action={
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              type="date"
              label="Du"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              type="date"
              label="Au"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {can("team_costs.manage") && (
              <Button
                variant="contained"
                startIcon={<AddRounded />}
                onClick={() => setOpen(true)}
              >
                Coût collaborateur
              </Button>
            )}
          </Stack>
        }
      />
      {query.data?.basis.warning && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {query.data.basis.warning}
        </Alert>
      )}
      {save.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {save.error instanceof Error ? save.error.message : "Erreur"}
        </Alert>
      )}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        <MetricCard
          label="Heures approuvées"
          value={`${query.data?.totals.approvedHours ?? 0} h`}
        />
        <MetricCard
          label="Honoraires HT"
          value={<Money value={query.data?.totals.billedRevenueNet} />}
        />
        <MetricCard
          label="Coût employeur affecté"
          value={<Money value={query.data?.totals.allocatedEmployerCost} />}
        />
        <MetricCard
          label="Marge sur facturé"
          value={<Money value={query.data?.totals.marginOnBilled} />}
        />
      </Stack>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Par dossier client
          </Typography>
          <QueryState
            loading={query.isLoading}
            error={query.isError}
            empty={!query.data?.dossiers.length}
          />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Dossier</TableCell>
                <TableCell align="right">Heures</TableCell>
                <TableCell align="right">Facturable</TableCell>
                <TableCell align="right">Honoraires</TableCell>
                <TableCell align="right">Coût affecté</TableCell>
                <TableCell align="right">Marge</TableCell>
                <TableCell align="right">Taux de marge</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {query.data?.dossiers.map((d) => (
                <TableRow key={d.dossierId}>
                  <TableCell>
                    <b>{d.dossierName}</b>
                    {d.missingCostRateCount > 0 && (
                      <Typography
                        color="error"
                        variant="caption"
                        sx={{ display: "block" }}
                      >
                        {d.missingCostRateCount} coût(s) manquant(s)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{d.approvedHours} h</TableCell>
                  <TableCell align="right">{d.billableRate}%</TableCell>
                  <TableCell align="right">
                    <Money value={d.billedRevenueNet} />
                  </TableCell>
                  <TableCell align="right">
                    <Money value={d.allocatedEmployerCost} />
                  </TableCell>
                  <TableCell align="right">
                    <Money value={d.marginOnBilled} />
                  </TableCell>
                  <TableCell align="right">{d.marginRateOnBilled}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Par collaborateur
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Collaborateur</TableCell>
                <TableCell align="right">Heures</TableCell>
                <TableCell align="right">Facturable</TableCell>
                <TableCell align="right">Rémunération</TableCell>
                <TableCell align="right">Coût employeur</TableCell>
                <TableCell align="right">CA affecté</TableCell>
                <TableCell align="right">Contribution</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {query.data?.members.map((m) => (
                <TableRow key={m.membershipId}>
                  <TableCell>
                    <b>{m.fullName}</b>
                    {m.missingCostRate && (
                      <Typography
                        color="error"
                        variant="caption"
                        sx={{ display: "block" }}
                      >
                        Coût à configurer
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{m.approvedHours} h</TableCell>
                  <TableCell align="right">{m.billableRate}%</TableCell>
                  <TableCell align="right">
                    <Money value={m.payAmount} />
                  </TableCell>
                  <TableCell align="right">
                    <Money value={m.employerCost} />
                  </TableCell>
                  <TableCell align="right">
                    <Money value={m.allocatedBilledRevenue} />
                  </TableCell>
                  <TableCell align="right">
                    <Money value={m.contributionMarginBilled} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rates.data && (
            <Typography variant="caption" color="text.secondary">
              {rates.data.length} version(s) de coûts configurée(s).
            </Typography>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nouveau coût collaborateur</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Collaborateur"
              value={form.membershipId}
              onChange={(e) =>
                setForm({ ...form, membershipId: e.target.value })
              }
            >
              {members.data
                ?.filter((m) => m.isActive)
                .map((m) => (
                  <MenuItem key={m.membershipId} value={m.membershipId}>
                    {m.fullName}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              select
              label="Rémunération"
              value={form.compensationType}
              onChange={(e) =>
                setForm({ ...form, compensationType: e.target.value })
              }
            >
              <MenuItem value="MENSUELLE">Mensuelle</MenuItem>
              <MenuItem value="HORAIRE">Horaire</MenuItem>
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label={
                  form.compensationType === "MENSUELLE"
                    ? "Salaire mensuel"
                    : "Taux horaire"
                }
                value={form.payRateAmount}
                onChange={(e) =>
                  setForm({ ...form, payRateAmount: e.target.value })
                }
              />
              <TextField
                fullWidth
                label={
                  form.compensationType === "MENSUELLE"
                    ? "Coût employeur mensuel"
                    : "Coût horaire employeur"
                }
                value={form.employerCostRateAmount}
                onChange={(e) =>
                  setForm({ ...form, employerCostRateAmount: e.target.value })
                }
              />
            </Stack>
            <TextField
              type="number"
              label="Objectif mensuel (minutes)"
              value={form.monthlyTargetMinutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  monthlyTargetMinutes: Number(e.target.value),
                })
              }
            />
            <TextField
              type="date"
              label="Applicable depuis"
              value={form.effectiveFrom}
              onChange={(e) =>
                setForm({ ...form, effectiveFrom: e.target.value })
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={
              !form.membershipId ||
              !form.payRateAmount ||
              !form.employerCostRateAmount ||
              save.isPending
            }
            onClick={() => save.mutate()}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
