import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  AddRounded,
  GavelRounded,
  OpenInNewRounded,
  VerifiedOutlined,
  WarningAmberRounded,
} from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { QueryState } from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";

interface FiscalRow {
  id: string;
  code?: string;
  natureCode?: string;
  label?: string;
  value?: string;
  valueType?: string;
  rate?: string;
  lowerBound?: string;
  upperBound?: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
}
interface RegulatoryRule {
  id: string;
  code: string;
  category: string;
  title: string;
  summary: string;
  articleReference: string;
  effectiveFrom: string;
  status:
    | "ACTIVE"
    | "ACTION_REQUISE"
    | "TEXTE_APPLICATION_ATTENDU"
    | "INFORMATION";
  impactedModules: string[];
  sourceLabel: string;
  sourceUrl: string;
  notes: string | null;
}
const parameterLabels: Record<string, string> = {
  TFP_TAUX_INDUSTRIE: "TFP industrie",
  TFP_TAUX_AUTRES: "TFP autres activités",
  FOPROLOS_TAUX: "FOPROLOS",
  TCL_TAUX: "TCL",
  TIMBRE_MONTANT: "Timbre fiscal",
  CNSS_RSNA_SALARIE: "CNSS salarié RSNA",
  CNSS_RSNA_EMPLOYEUR: "CNSS employeur RSNA",
};

export function FiscalSettingsPage() {
  const { organization, can } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    code: "TFP_TAUX_AUTRES",
    label: "",
    valueType: "TAUX",
    value: "",
    rate: "",
    effectiveFrom: today,
    sourceLabel: "",
    sourceUrl: "",
  });
  const [brackets, setBrackets] = useState([
    { lowerBound: "0.000", upperBound: "5000.000", rate: "0" },
    { lowerBound: "5000.000", upperBound: "20000.000", rate: "0.26" },
    { lowerBound: "20000.000", upperBound: "", rate: "0.35" },
  ]);
  const base = organization?.id
    ? `/api/organizations/${organization.id}/fiscal-settings`
    : "";
  const endpoints = [
    "parameters",
    "vat-rates",
    "withholding-rates",
    "income-tax-brackets",
  ];
  const rows = useQuery({
    queryKey: ["fiscal-settings", organization?.id, tab],
    queryFn: () => api.get<FiscalRow[]>(`${base}/${endpoints[tab]}`),
    enabled: Boolean(base),
  });
  const regulatory = useQuery({
    queryKey: ["regulatory-updates", organization?.id, today],
    queryFn: () =>
      api.get<RegulatoryRule[]>(
        `${base}/regulatory-updates?date=${today}`,
      ),
    enabled: Boolean(base),
  });
  const save = useMutation({
    mutationFn: () => {
      if (tab === 0)
        return api.post(`${base}/parameters`, {
          code: form.code,
          label: form.label || parameterLabels[form.code],
          valueType: form.code === "TIMBRE_MONTANT" ? "MONTANT" : "TAUX",
          value: form.value,
          effectiveFrom: form.effectiveFrom,
          sourceLabel: form.sourceLabel || undefined,
          sourceUrl: form.sourceUrl || undefined,
        });
      if (tab === 1)
        return api.post(`${base}/vat-rates`, {
          code: form.code,
          label: form.label,
          rate: form.rate,
          effectiveFrom: form.effectiveFrom,
          sourceLabel: form.sourceLabel || undefined,
          sourceUrl: form.sourceUrl || undefined,
        });
      if (tab === 2)
        return api.post(`${base}/withholding-rates`, {
          natureCode: form.code,
          label: form.label,
          rate: form.rate,
          effectiveFrom: form.effectiveFrom,
          sourceLabel: form.sourceLabel || undefined,
          sourceUrl: form.sourceUrl || undefined,
        });
      return api.post(`${base}/income-tax-scales`, {
        effectiveFrom: form.effectiveFrom,
        sourceLabel: form.sourceLabel || undefined,
        sourceUrl: form.sourceUrl || undefined,
        brackets: brackets.map((b) => ({
          ...b,
          upperBound: b.upperBound || null,
        })),
      });
    },
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["fiscal-settings"] });
    },
  });
  const displayValue = (r: FiscalRow) =>
    tab === 0
      ? r.valueType === "MONTANT"
        ? `${r.value} TND`
        : `${Number(r.value) * 100}%`
      : tab === 3
        ? `${r.lowerBound} → ${r.upperBound ?? "∞"} : ${Number(r.rate) * 100}%`
        : `${Number(r.rate) * 100}%`;
  return (
    <>
      <PageHeader
        eyebrow="Référentiel réglementaire"
        title="Paramètres fiscaux & sociaux"
        description="Historisez les taux officiels. Chaque calcul conserve la source et la version applicables à sa date."
        action={
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            disabled={!can("fiscal_settings.manage")}
            onClick={() => setOpen(true)}
          >
            Ajouter une version
          </Button>
        }
      />
      {save.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {save.error instanceof Error ? save.error.message : "Erreur"}
        </Alert>
      )}
      <Alert severity="info" icon={<VerifiedOutlined />} sx={{ mb: 2 }}>
        Ne modifiez pas l’historique : ajoutez une nouvelle version avec sa date
        d’effet et la référence au texte officiel tunisien.
      </Alert>
      <Card sx={{ mb: 3, overflow: "hidden" }}>
        <Box
          sx={{
            p: { xs: 2.5, md: 3 },
            display: "flex",
            gap: 2,
            alignItems: { xs: "flex-start", md: "center" },
            flexDirection: { xs: "column", md: "row" },
            bgcolor: "primary.dark",
            color: "primary.contrastText",
          }}
        >
          <GavelRounded />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              Mise à jour réglementaire 2026
            </Typography>
            <Typography sx={{ opacity: 0.82 }}>
              Les articles utiles sont reliés aux modules concernés. Une règle
              “action requise” doit être qualifiée dossier par dossier.
            </Typography>
          </Box>
          <Chip
            label={`${regulatory.data?.length ?? 0} mesures suivies`}
            sx={{ bgcolor: "rgba(255,255,255,.16)", color: "inherit" }}
          />
        </Box>
        <CardContent>
          <QueryState
            loading={regulatory.isLoading}
            error={regulatory.isError}
            empty={!regulatory.data?.length}
            emptyText="Aucune mise à jour réglementaire applicable."
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            {regulatory.data?.map((rule) => {
              const requiresAction = rule.status === "ACTION_REQUISE";
              const pending = rule.status === "TEXTE_APPLICATION_ATTENDU";
              return (
                <Card
                  key={rule.id}
                  variant="outlined"
                  sx={{
                    p: 2.25,
                    borderColor: requiresAction
                      ? "warning.main"
                      : pending
                        ? "info.main"
                        : "divider",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{ flexWrap: "wrap", mb: 1.5 }}
                  >
                    <Chip
                      size="small"
                      label={rule.articleReference}
                      color="primary"
                    />
                    <Chip size="small" label={rule.category} variant="outlined" />
                    <Chip
                      size="small"
                      icon={
                        requiresAction ? <WarningAmberRounded /> : undefined
                      }
                      label={
                        requiresAction
                          ? "À qualifier par dossier"
                          : pending
                            ? "Texte d’application attendu"
                            : rule.status === "ACTIVE"
                              ? "En vigueur"
                              : "Information"
                      }
                      color={
                        requiresAction
                          ? "warning"
                          : pending
                            ? "info"
                            : rule.status === "ACTIVE"
                              ? "success"
                              : "default"
                      }
                    />
                  </Stack>
                  <Typography variant="h6" sx={{ mb: 0.75 }}>
                    {rule.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {rule.summary}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    useFlexGap
                    sx={{ flexWrap: "wrap", mt: 1.5 }}
                  >
                    {rule.impactedModules.map((module) => (
                      <Chip
                        key={module}
                        size="small"
                        label={module.replace(/_/g, " ")}
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                  {rule.notes && (
                    <Alert severity={requiresAction ? "warning" : "info"} sx={{ mt: 1.5 }}>
                      {rule.notes}
                    </Alert>
                  )}
                  <Button
                    size="small"
                    endIcon={<OpenInNewRounded />}
                    href={rule.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ mt: 1 }}
                  >
                    Lire le texte officiel
                  </Button>
                </Card>
              );
            })}
          </Box>
        </CardContent>
      </Card>
      <Card>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label="Taxes & CNSS" />
          <Tab label="TVA" />
          <Tab label="Retenues à la source" />
          <Tab label="Barème IRPP" />
        </Tabs>
        <CardContent>
          <QueryState
            loading={rows.isLoading}
            error={rows.isError}
            empty={!rows.data?.length}
          />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code / nature</TableCell>
                <TableCell>Libellé</TableCell>
                <TableCell>Valeur</TableCell>
                <TableCell>Validité</TableCell>
                <TableCell>Source officielle</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.data?.map((r, i) => (
                <TableRow key={r.id ?? i}>
                  <TableCell>
                    <Chip
                      size="small"
                      label={r.code ?? r.natureCode ?? `Tranche ${i + 1}`}
                    />
                  </TableCell>
                  <TableCell>
                    {r.label ?? (tab === 3 ? "Impôt sur le revenu" : "—")}
                  </TableCell>
                  <TableCell>
                    <b>{displayValue(r)}</b>
                  </TableCell>
                  <TableCell>
                    Depuis {r.effectiveFrom}
                    {r.effectiveTo ? ` jusqu’au ${r.effectiveTo}` : ""}
                  </TableCell>
                  <TableCell>
                    {r.sourceUrl ? (
                      <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                        {r.sourceLabel || "Consulter"}
                      </a>
                    ) : (
                      r.sourceLabel || "À documenter"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {
            [
              "Nouveau paramètre",
              "Nouveau taux de TVA",
              "Nouvelle retenue",
              "Nouveau barème IRPP",
            ][tab]
          }
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {tab < 3 && (
              <>
                {tab === 0 ? (
                  <TextField
                    select
                    label="Paramètre"
                    value={form.code}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        code: e.target.value,
                        label: parameterLabels[e.target.value],
                      })
                    }
                  >
                    {Object.entries(parameterLabels).map(([v, l]) => (
                      <MenuItem key={v} value={v}>
                        {l}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <TextField
                    label={tab === 1 ? "Code TVA" : "Code nature"}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                )}
                <TextField
                  label="Libellé"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
                <TextField
                  label={
                    tab === 0
                      ? "Valeur décimale (ex. 0.02)"
                      : "Taux décimal (ex. 0.19)"
                  }
                  value={tab === 0 ? form.value : form.rate}
                  onChange={(e) =>
                    setForm(
                      tab === 0
                        ? { ...form, value: e.target.value }
                        : { ...form, rate: e.target.value },
                    )
                  }
                />
              </>
            )}
            {tab === 3 && (
              <>
                {brackets.map((b, i) => (
                  <Stack key={i} direction="row" spacing={1}>
                    <TextField
                      label="De"
                      value={b.lowerBound}
                      onChange={(e) =>
                        setBrackets(
                          brackets.map((x, j) =>
                            j === i ? { ...x, lowerBound: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <TextField
                      label="À (vide = infini)"
                      value={b.upperBound}
                      onChange={(e) =>
                        setBrackets(
                          brackets.map((x, j) =>
                            j === i ? { ...x, upperBound: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <TextField
                      label="Taux décimal"
                      value={b.rate}
                      onChange={(e) =>
                        setBrackets(
                          brackets.map((x, j) =>
                            j === i ? { ...x, rate: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </Stack>
                ))}
                <Button
                  onClick={() =>
                    setBrackets([
                      ...brackets,
                      { lowerBound: "", upperBound: "", rate: "" },
                    ])
                  }
                >
                  Ajouter une tranche
                </Button>
              </>
            )}
            <TextField
              type="date"
              label="Date d’effet"
              value={form.effectiveFrom}
              onChange={(e) =>
                setForm({ ...form, effectiveFrom: e.target.value })
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Référence du texte officiel"
              value={form.sourceLabel}
              onChange={(e) =>
                setForm({ ...form, sourceLabel: e.target.value })
              }
            />
            <TextField
              label="Lien officiel"
              value={form.sourceUrl}
              onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            Enregistrer la version
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
