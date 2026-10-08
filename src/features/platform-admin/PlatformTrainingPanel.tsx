import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
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
import { DownloadRounded, AutoAwesomeRounded } from "@mui/icons-material";
import { api } from "../../api/client";

type Overview = {
  schemaVersion: string;
  counts: { kind: string; status: string; count: string }[];
  exports: {
    id: string;
    status: string;
    sampleCount: number;
    sizeBytes: string | null;
    createdAtUtc: string;
    expiresAtUtc: string;
    errorCode: string | null;
  }[];
};
const statuses: Record<string, string> = {
  QUEUED: "En attente",
  PROCESSING: "Préparation",
  READY: "Prêt",
  FAILED: "Échec",
  EXPIRED: "Expiré",
};

export function PlatformTrainingPanel() {
  const client = useQueryClient();
  const [kind, setKind] = useState("all");
  const [limit, setLimit] = useState(1000);
  const [first, setFirst] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState("");
  const data = useQuery({
    queryKey: ["platform-admin", "training-datasets"],
    queryFn: () => api.get<Overview>("/api/platform-admin/training-datasets"),
    refetchInterval: 5000,
  });
  const create = useMutation({
    mutationFn: () =>
      api.post("/api/platform-admin/training-datasets/exports", {
        documentKind: kind,
        limit,
        offset: first - 1,
      }),
    onSuccess: () => {
      setFeedback(
        "Export demandé. Les images et le ZIP sont préparés en arrière-plan.",
      );
      void client.invalidateQueries({
        queryKey: ["platform-admin", "training-datasets"],
      });
    },
  });
  const download = useMutation({
    mutationFn: async (id: string) => {
      const result = await api.post<{ url: string }>(
        `/api/platform-admin/training-datasets/exports/${id}/download`,
      );
      // The URL is a one-minute, read-only storage link. Never retain it in application state.
      const link = document.createElement("a");
      link.href = result.url;
      link.rel = "noopener noreferrer";
      link.download = `fiscora-training-${id}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
  });
  const ready = (documentKind?: string) =>
    data.data?.counts
      .filter(
        (row) =>
          row.status === "READY" &&
          (!documentKind || row.kind === documentKind),
      )
      .reduce((sum, row) => sum + Number(row.count), 0) ?? 0;
  const failed =
    data.data?.counts
      .filter((row) => row.status === "FAILED")
      .reduce((sum, row) => sum + Number(row.count), 0) ?? 0;
  const busy =
    data.data?.exports.some((item) =>
      ["QUEUED", "PROCESSING"].includes(item.status),
    ) ?? false;
  const error = data.error ?? create.error ?? download.error;
  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Alert severity="info">
          La collecte est désactivée par défaut. Le propriétaire autorise chaque
          dossier depuis Documents. Seules les extractions NuExtract approuvées,
          sans erreur bloquante et avec antivirus sain sont collectées. Aucune
          formation ni aucun déploiement automatique.
        </Alert>
        {error && (
          <Alert severity="error">
            {error instanceof Error ? error.message : "Opération indisponible."}
          </Alert>
        )}
        {feedback && (
          <Alert severity="success" onClose={() => setFeedback("")}>
            {feedback}
          </Alert>
        )}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Box
            sx={{
              flex: 1,
              p: 2,
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <Typography color="text.secondary">Factures prêtes</Typography>
            <Typography variant="h2">{ready("invoice")}</Typography>
          </Box>
          <Box
            sx={{
              flex: 1,
              p: 2,
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <Typography color="text.secondary">
              Relevés bancaires prêts
            </Typography>
            <Typography variant="h2">{ready("bank_statement")}</Typography>
          </Box>
        </Stack>
        {failed > 0 && (
          <Alert severity="warning">
            {failed} collecte(s) en échec. Vérifiez le stockage avant de
            réautoriser le dossier pour réessayer.
          </Alert>
        )}
        <Box>
          <Typography variant="h3" sx={{ mb: 1 }}>
            Exporter pour le fine-tuning LoRA
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            ZIP privé : images des pages, réponses corrigées, templates,
            métadonnées et samples.jsonl. Jusqu’à 1 000 exemples et 512 Mo par
            export. Les PDF sont rendus avec le service déjà utilisé pour
            l’extraction. Auditez les réponses et séparez entraînement /
            validation / test avant de lancer LoRA.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              label="Documents"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="all">Factures et relevés</MenuItem>
              <MenuItem value="invoice">Factures</MenuItem>
              <MenuItem value="bank_statement">Relevés bancaires</MenuItem>
            </TextField>
            <TextField
              type="number"
              label="Nombre maximum"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              slotProps={{ htmlInput: { min: 1, max: 1000 } }}
            />
            <TextField
              type="number"
              label="Commencer à l’exemple"
              value={first}
              onChange={(event) => setFirst(Number(event.target.value))}
              slotProps={{ htmlInput: { min: 1, max: 1000001 } }}
              helperText="Pour exporter en lots : 1, puis 1001, etc."
            />
          </Stack>
          <FormControlLabel
            sx={{ my: 1 }}
            control={
              <Checkbox
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
            }
            label="Je confirme que cet export est destiné à un entraînement autorisé et restera confidentiel."
          />
          <Box>
            <Button
              variant="contained"
              startIcon={<AutoAwesomeRounded />}
              disabled={
                !confirmed ||
                !ready(kind === "all" ? undefined : kind) ||
                busy ||
                create.isPending ||
                !Number.isInteger(limit) ||
                limit < 1 ||
                limit > 1000 ||
                !Number.isInteger(first) ||
                first < 1 ||
                first > 1000001
              }
              onClick={() => create.mutate()}
            >
              {busy ? "Export en préparation…" : "Exporter le jeu de données"}
            </Button>
          </Box>
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Exports récents
          </Typography>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Exemples</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Téléchargement</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data?.exports.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {new Date(item.createdAtUtc).toLocaleString("fr-TN")}
                  </TableCell>
                  <TableCell>{item.sampleCount}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={statuses[item.status] ?? item.status}
                    />
                    {item.errorCode && (
                      <Typography variant="caption" sx={{ display: "block" }}>
                        {item.errorCode === "EXPORT_TOO_LARGE"
                          ? "Réduisez le nombre d’exemples (limite 512 Mo)."
                          : "Export interrompu ou indisponible : réessayez."}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      startIcon={<DownloadRounded />}
                      disabled={
                        item.status !== "READY" ||
                        new Date(item.expiresAtUtc) <= new Date() ||
                        download.isPending
                      }
                      onClick={() => download.mutate(item.id)}
                    >
                      Télécharger le ZIP
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!data.isLoading && !data.data?.exports.length && (
            <Typography sx={{ p: 2 }}>
              Aucun export. Les exemples autorisés sont collectés
              automatiquement toutes les 30 secondes.
            </Typography>
          )}
          <Typography variant="caption">
            Les ZIP expirent après 24 heures. Un retrait d’autorisation bloque
            les nouveaux téléchargements. Il ne peut pas effacer une copie déjà
            téléchargée ni un modèle déjà entraîné.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
