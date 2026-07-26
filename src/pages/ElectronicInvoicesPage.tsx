import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutlineRounded,
  CloudUploadOutlined,
  DownloadOutlined,
  ErrorOutlineRounded,
  FactCheckOutlined,
} from "@mui/icons-material";
import { api, downloadApiFile } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DossierSelector, Money, QueryState } from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";
import type { BusinessInvoice, DossierSummary } from "../types/api";

interface TtnConfiguration {
  id: string; environment: "SIMULATION" | "TEST" | "PRODUCTION"; issuerTaxIdentifier: string;
  schemaVersion: string | null; certificateReference: string | null; connectionReference: string | null; isEnabled: boolean;
}
interface ReadinessCheck { code: string; label: string; ok: boolean }
interface TtnReadiness { mode: string; simulationReady: boolean; liveReady: boolean; warning: string; checks: ReadinessCheck[] }
interface ConfigurationResponse { configuration: TtnConfiguration | null; readiness: TtnReadiness }
interface Submission {
  id: string; environment: string; schemaVersion: string; payloadHash: string; signatureMode: string;
  status: string; externalReference: string | null; responseCode: string | null; responseMessage: string | null;
  attemptCount: number; createdAtUtc: string; acceptedAtUtc: string | null; invoice: BusinessInvoice;
}

export function ElectronicInvoicesPage() {
  const { organization, can } = useAuth();
  const organizationId = organization?.id ?? "";
  const [dossierId, setDossierId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [form, setForm] = useState({ environment: "SIMULATION", issuerTaxIdentifier: "", schemaVersion: "", certificateReference: "", connectionReference: "", isEnabled: true });
  const qc = useQueryClient();
  const base = organizationId && dossierId ? `/api/organizations/${organizationId}/dossiers/${dossierId}/electronic-invoices` : "";
  const dossier = useQuery({ queryKey: ["dossier", organizationId, dossierId], queryFn: () => api.get<DossierSummary>(`/api/organizations/${organizationId}/dossiers/${dossierId}`), enabled: Boolean(organizationId && dossierId) });
  const config = useQuery({ queryKey: ["ttn-config", organizationId, dossierId], queryFn: () => api.get<ConfigurationResponse>(`${base}/configuration`), enabled: Boolean(base) });
  const submissions = useQuery({ queryKey: ["ttn-submissions", organizationId, dossierId], queryFn: () => api.get<Submission[]>(base), enabled: Boolean(base) });
  const eligible = useQuery({ queryKey: ["ttn-eligible", organizationId, dossierId], queryFn: () => api.get<BusinessInvoice[]>(`${base}/eligible-invoices`), enabled: Boolean(base) });

  useEffect(() => {
    const item = config.data?.configuration;
    if (item) setForm({ environment: item.environment, issuerTaxIdentifier: item.issuerTaxIdentifier, schemaVersion: item.schemaVersion ?? "", certificateReference: item.certificateReference ?? "", connectionReference: item.connectionReference ?? "", isEnabled: item.isEnabled });
    else if (dossier.data?.taxIdentifier) setForm((current) => ({ ...current, issuerTaxIdentifier: dossier.data?.taxIdentifier ?? "" }));
  }, [config.data?.configuration, dossier.data?.taxIdentifier]);
  useEffect(() => { if (!invoiceId && eligible.data?.[0]) setInvoiceId(eligible.data[0].id); }, [eligible.data, invoiceId]);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["ttn-config"] });
    void qc.invalidateQueries({ queryKey: ["ttn-submissions"] });
    void qc.invalidateQueries({ queryKey: ["ttn-eligible"] });
  };
  const save = useMutation({ mutationFn: () => api.put(`${base}/configuration`, { ...form, schemaVersion: form.schemaVersion || undefined, certificateReference: form.certificateReference || undefined, connectionReference: form.connectionReference || undefined }), onSuccess: refresh });
  const prepare = useMutation({ mutationFn: () => api.post(`${base}/prepare`, { invoiceId }), onSuccess: () => { refresh(); setInvoiceId(""); } });
  const submit = useMutation({ mutationFn: (id: string) => api.post(`${base}/${id}/submit`), onSuccess: refresh });
  const error = save.error ?? prepare.error ?? submit.error;
  const readiness = config.data?.readiness;
  const statusColor = (status: string): "default" | "success" | "error" | "warning" | "info" => status === "ACCEPTEE" ? "success" : status === "REJETEE" || status === "ECHEC" ? "error" : status === "PRETE" ? "warning" : "info";

  return <>
    <PageHeader eyebrow="Facturation électronique" title="TTN · El Fatoora" description="Préparez, contrôlez et suivez les factures électroniques du dossier." action={<DossierSelector value={dossierId} onChange={setDossierId} />} />
    <Alert severity="warning" sx={{ mb: 2 }}><b>Connecteur en simulation.</b> L’application ne transmet encore rien à TTN et l’empreinte locale ne remplace pas le cachet électronique légal.</Alert>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error instanceof Error ? error.message : "Une erreur est survenue."}</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(360px,.85fr) minmax(0,1.65fr)" }, gap: 2 }}>
      <Stack spacing={2}>
        <Card><CardContent><Typography variant="h5" sx={{ mb: 2 }}>Configuration du dossier</Typography><Stack spacing={2}>
          <TextField select label="Environnement" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}><MenuItem value="SIMULATION">Simulation locale</MenuItem><MenuItem value="TEST">Recette TTN (bloquée sans accès)</MenuItem><MenuItem value="PRODUCTION">Production TTN (bloquée)</MenuItem></TextField>
          <TextField label="Matricule fiscale émetteur" value={form.issuerTaxIdentifier} onChange={(e) => setForm({ ...form, issuerTaxIdentifier: e.target.value })} />
          <TextField label="Version du schéma officiel TTN" placeholder="Fournie dans le dossier technique TTN" value={form.schemaVersion} onChange={(e) => setForm({ ...form, schemaVersion: e.target.value })} helperText="Laissez vide en simulation : l’adaptateur interne sera utilisé." />
          <TextField label="Référence du certificat/cachet" placeholder="Alias du coffre ou HSM, jamais la clé privée" value={form.certificateReference} onChange={(e) => setForm({ ...form, certificateReference: e.target.value })} />
          <TextField label="Référence du raccordement TTN" placeholder="Identifiant de contrat ou compte de test" value={form.connectionReference} onChange={(e) => setForm({ ...form, connectionReference: e.target.value })} />
          <FormControlLabel control={<Switch checked={form.isEnabled} onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })} />} label="Raccordement actif" />
          <Button variant="contained" disabled={!base || !form.issuerTaxIdentifier || !can("electronic_invoices.configure") || save.isPending} onClick={() => save.mutate()}>Enregistrer la configuration</Button>
        </Stack></CardContent></Card>
        <Card><CardContent><Typography variant="h6">Préparation à la production</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Cette liste distingue ce qui fonctionne en simulation de ce qui exige TTN/TunTrust.</Typography><Stack spacing={1}>{readiness?.checks.map((check) => <Stack key={check.code} direction="row" spacing={1.2} sx={{ alignItems: "center" }}>{check.ok ? <CheckCircleOutlineRounded color="success" /> : <ErrorOutlineRounded color="warning" />}<Typography variant="body2">{check.label}</Typography></Stack>)}</Stack>{readiness && <Alert severity={readiness.liveReady ? "success" : "info"} sx={{ mt: 2 }}>{readiness.warning}</Alert>}</CardContent></Card>
      </Stack>

      <Stack spacing={2}>
        <Card><CardContent><Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}><Box sx={{ flex: 1 }}><Typography variant="h5">Préparer une facture</Typography><Typography variant="body2" color="text.secondary">Seules les factures de vente comptabilisées et non encore préparées sont proposées.</Typography></Box><TextField select size="small" label="Facture de vente" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} sx={{ minWidth: 320 }}><MenuItem value="">Sélectionner…</MenuItem>{eligible.data?.map((item) => <MenuItem key={item.id} value={item.id}>{item.number} · {item.nature === "BIENS" ? "Biens" : item.nature === "SERVICES" ? "Services" : "Mixte"} · {item.thirdPartyName} · {Number(item.grossAmount).toFixed(3)} TND</MenuItem>)}</TextField><Button variant="contained" startIcon={<FactCheckOutlined />} disabled={!invoiceId || !readiness?.simulationReady || !can("electronic_invoices.manage") || prepare.isPending} onClick={() => prepare.mutate()}>Générer XML</Button></Stack><Alert severity="info" sx={{ mt: 2 }}>Depuis 2026, l’article 53 étend le champ légal aux prestations de services. La nature choisie sur la facture est affichée ici pour faciliter le contrôle.</Alert>{!readiness?.simulationReady && <Alert severity="warning" sx={{ mt: 2 }}>Enregistrez d’abord une configuration active en mode simulation.</Alert>}</CardContent></Card>
        <Card><CardContent><Typography variant="h5" sx={{ mb: 2 }}>Transmissions</Typography><QueryState loading={submissions.isLoading} error={submissions.isError} empty={!submissions.data?.length} emptyText="Aucune facture électronique préparée." />{!!submissions.data?.length && <Box sx={{ overflowX: "auto" }}><Table size="small"><TableHead><TableRow><TableCell>Facture</TableCell><TableCell>Total</TableCell><TableCell>Environnement</TableCell><TableCell>Statut</TableCell><TableCell>Accusé / réponse</TableCell><TableCell /></TableRow></TableHead><TableBody>{submissions.data.map((item) => <TableRow key={item.id}><TableCell><b>{item.invoice.number}</b><br /><Typography variant="caption">{item.invoice.invoiceDate} · {item.invoice.thirdPartyName}</Typography></TableCell><TableCell><Money value={item.invoice.grossAmount} /></TableCell><TableCell><Chip size="small" variant="outlined" label={item.environment} /></TableCell><TableCell><Chip size="small" color={statusColor(item.status)} label={item.status} /></TableCell><TableCell>{item.externalReference ?? item.responseCode ?? "—"}<br />{item.responseMessage && <Typography variant="caption" color="text.secondary">{item.responseMessage}</Typography>}</TableCell><TableCell><Stack direction="row" spacing={1}><Button size="small" startIcon={<DownloadOutlined />} onClick={() => void downloadApiFile(`${base}/${item.id}/payload`, `${item.invoice.number}.xml`)}>XML</Button>{["PRETE", "REJETEE", "ECHEC"].includes(item.status) && <Button size="small" variant="contained" startIcon={<CloudUploadOutlined />} disabled={!can("electronic_invoices.submit") || submit.isPending} onClick={() => submit.mutate(item.id)}>{item.environment === "SIMULATION" ? "Simuler" : "Transmettre"}</Button>}</Stack></TableCell></TableRow>)}</TableBody></Table></Box>}</CardContent></Card>
        <Card variant="outlined"><CardContent><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Ce qu’il faudra fournir pour le raccordement réel</Typography><Typography variant="body2" color="text.secondary">Adhésion TTN/El Fatoora, dossier technique et schéma courant, identifiants de recette, certificat TunTrust Enterprise-ID/cachet, méthode de signature et validation d’homologation. Les secrets resteront dans un coffre ou HSM, jamais dans la base ni le code.</Typography></CardContent></Card>
      </Stack>
    </Box>
  </>;
}
