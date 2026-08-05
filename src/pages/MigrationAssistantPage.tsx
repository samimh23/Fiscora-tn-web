import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
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
  CloudUploadOutlined,
  DownloadOutlined,
  PreviewOutlined,
  PublishedWithChangesOutlined,
} from "@mui/icons-material";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { DossierSelector } from "../components/WorkspaceTools";
import type { MigrationImportResult, MigrationPreview } from "../types/api";

type ImportKind = "accounts" | "journals" | "third-parties" | "opening-balances";

const importKinds: Array<{
  value: ImportKind;
  label: string;
  description: string;
  template: string;
}> = [
  {
    value: "accounts",
    label: "Plan comptable",
    description: "Codes, libellés et types de comptes exportés depuis Sage/Ciel.",
    template: "code;libelle;type;description\r\n401000;Fournisseurs;Asset;Compte collectif fournisseurs",
  },
  {
    value: "journals",
    label: "Journaux",
    description: "Journaux achats, ventes, banque, caisse, OD, paie.",
    template: "code;libelle;type\r\nACH;Journal achats;ACHATS\r\nBQ;Banque;BANQUE",
  },
  {
    value: "third-parties",
    label: "Tiers",
    description: "Clients, fournisseurs, matricules fiscaux, RNE et contacts.",
    template:
      "type;raison sociale;matricule fiscal;rne;email;telephone;adresse\r\nFOURNISSEUR;STEG;;;contact@steg.com.tn;;Tunisie",
  },
  {
    value: "opening-balances",
    label: "Balance d’ouverture",
    description: "Débit/crédit par compte. Le total doit être équilibré.",
    template:
      "compte;libelle;debit;credit\r\n401000;Fournisseurs;0,000;1500,000\r\n532000;Banque;1500,000;0,000",
  },
];

export function MigrationAssistantPage() {
  const { organization, can } = useAuth();
  const organizationId = organization?.id ?? "";
  const queryClient = useQueryClient();
  const [dossierId, setDossierId] = useState("");
  const [kind, setKind] = useState<ImportKind>("accounts");
  const [openingDate, setOpeningDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
  );
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [previewData, setPreviewData] = useState<MigrationPreview | null>(null);
  const [result, setResult] = useState<MigrationImportResult | null>(null);

  const selectedKind = useMemo(
    () => importKinds.find((item) => item.value === kind) ?? importKinds[0],
    [kind],
  );

  const endpoint = `/api/organizations/${organizationId}/dossiers/${dossierId}/migration-assistant`;
  const makeBody = () => {
    const body = new FormData();
    if (file) body.append("file", file);
    if (kind === "opening-balances") body.append("openingDate", openingDate);
    return body;
  };

  const preview = useMutation({
    mutationFn: () => api.upload<MigrationPreview>(`${endpoint}/preview/${kind}`, makeBody()),
    onSuccess: (data) => {
      setError("");
      setResult(null);
      setPreviewData(data);
    },
    onError: (reason) =>
      setError(reason instanceof ApiError ? reason.message : "Prévisualisation impossible."),
  });

  const importFile = useMutation({
    mutationFn: () =>
      api.upload<MigrationImportResult>(`${endpoint}/import/${kind}`, makeBody()),
    onSuccess: async (data) => {
      setError("");
      setResult(data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ledger-accounts", organizationId, dossierId] }),
        queryClient.invalidateQueries({ queryKey: ["journals", organizationId, dossierId] }),
        queryClient.invalidateQueries({ queryKey: ["third-parties", organizationId, dossierId] }),
        queryClient.invalidateQueries({ queryKey: ["journal-entries", organizationId, dossierId] }),
      ]);
    },
    onError: (reason) =>
      setError(reason instanceof ApiError ? reason.message : "Import impossible."),
  });

  const downloadTemplate = () => {
    const url = URL.createObjectURL(
      new Blob([selectedKind.template], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `modele-migration-${kind}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        eyebrow="Migration & reprise"
        title="Assistant Sage / Ciel"
        description="Prévisualisez les exports de l’ancien logiciel, corrigez si besoin, puis importez les comptes, journaux, tiers et soldes d’ouverture."
        action={<DossierSelector value={dossierId} onChange={setDossierId} />}
      />

      {!dossierId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Choisissez le dossier client avant d’importer. Chaque migration reste isolée dans son dossier.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {result && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Import terminé : {result.created} créé(s), {result.updated} mis à jour,{" "}
          {result.skipped} ignoré(s)
          {result.importedLines ? `, ${result.importedLines} ligne(s) de balance` : ""}.
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "360px minmax(0,1fr)" },
          gap: 2,
        }}
      >
        <Card sx={{ alignSelf: "start" }}>
          <CardContent>
            <Stack spacing={2}>
              <TextField
                select
                label="Données à importer"
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as ImportKind);
                  setPreviewData(null);
                  setResult(null);
                }}
              >
                {importKinds.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
              <Typography variant="body2" color="text.secondary">
                {selectedKind.description}
              </Typography>
              {kind === "opening-balances" && (
                <TextField
                  label="Date d’ouverture"
                  type="date"
                  value={openingDate}
                  onChange={(event) => setOpeningDate(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              )}
              <Box
                sx={{
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 3,
                  p: 2.5,
                  textAlign: "center",
                }}
              >
                <Button component="label" variant="outlined" startIcon={<CloudUploadOutlined />}>
                  {file ? file.name : "Choisir un CSV/XLSX"}
                  <input
                    hidden
                    type="file"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setPreviewData(null);
                      setResult(null);
                    }}
                  />
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  Export Sage/Ciel ou fichier préparé avec les colonnes du modèle.
                </Typography>
              </Box>
              <Button startIcon={<DownloadOutlined />} onClick={downloadTemplate}>
                Télécharger le modèle CSV
              </Button>
              <Divider />
              <Button
                variant="outlined"
                startIcon={<PreviewOutlined />}
                disabled={!dossierId || !file || preview.isPending || !can("accounting.view")}
                onClick={() => preview.mutate()}
              >
                Prévisualiser
              </Button>
              <Button
                variant="contained"
                startIcon={<PublishedWithChangesOutlined />}
                disabled={
                  !dossierId ||
                  !file ||
                  !previewData ||
                  importFile.isPending ||
                  !can("accounting.manage")
                }
                onClick={() => importFile.mutate()}
              >
                Importer dans le dossier
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h3" sx={{ fontSize: 24 }}>
                  Prévisualisation
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Vérifiez les premières lignes avant de confirmer l’import.
                </Typography>
              </Box>
              {!previewData && (
                <Alert severity="info">
                  Importez un fichier puis cliquez sur “Prévisualiser”. Aucune donnée n’est écrite avant confirmation.
                </Alert>
              )}
              {previewData && (
                <>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    <Chip label={`${previewData.rows} ligne(s)`} />
                    <Chip color="success" label={`${previewData.validRows} valide(s)`} />
                    <Chip
                      color={previewData.warnings.length ? "warning" : "default"}
                      label={`${previewData.warnings.length} alerte(s)`}
                    />
                  </Stack>
                  {previewData.warnings.length > 0 && (
                    <Alert severity="warning">
                      {previewData.warnings.slice(0, 8).map((warning) => (
                        <Typography key={warning} variant="body2">
                          {warning}
                        </Typography>
                      ))}
                    </Alert>
                  )}
                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {Object.keys(previewData.sample[0] ?? {}).map((key) => (
                            <TableCell key={key}>{key}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {previewData.sample.map((row, index) => (
                          <TableRow key={index}>
                            {Object.entries(row).map(([key, value]) => (
                              <TableCell key={key}>{value}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </>
  );
}
