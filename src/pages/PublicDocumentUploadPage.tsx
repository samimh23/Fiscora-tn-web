import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutlineRounded,
  CloudUploadOutlined,
  InsertDriveFileOutlined,
  LockOutlined,
} from "@mui/icons-material";
import { api, ApiError } from "../api/client";
import { Brand } from "../components/Brand";
import { documentCategoryLabel } from "../features/operations/options";
import type { PublicDocumentRequestPreview } from "../types/api";

const accepted = ".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.xml,.csv";

const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-TN", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

export function PublicDocumentUploadPage() {
  const { token = "" } = useParams();
  const [file, setFile] = useState<File | null>(null);
  const [receipt, setReceipt] = useState<{
    originalName: string;
    receivedAtUtc: string;
  } | null>(null);

  const request = useQuery({
    queryKey: ["public-document-request", token],
    enabled: Boolean(token),
    retry: false,
    queryFn: () =>
      api.get<PublicDocumentRequestPreview>(
        `/api/public/document-requests/${encodeURIComponent(token)}`,
      ),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Sélectionnez un fichier.");
      if (file.size > 20 * 1024 * 1024) {
        throw new Error("Le fichier dépasse la limite de 20 Mo.");
      }
      const form = new FormData();
      form.append("file", file);
      return api.upload<{
        originalName: string;
        receivedAtUtc: string;
      }>(
        `/api/public/document-requests/${encodeURIComponent(token)}/upload`,
        form,
      );
    },
    onSuccess: (result) => {
      setReceipt(result);
      void request.refetch();
    },
  });

  const error = useMemo(() => {
    const reason = upload.error ?? request.error;
    if (!reason) return "";
    return reason instanceof ApiError || reason instanceof Error
      ? reason.message
      : "Le dépôt est temporairement indisponible.";
  }, [request.error, upload.error]);

  const preview = request.data;
  const closed = preview && !preview.canUpload;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f6f3ea",
        display: "grid",
        placeItems: "center",
        p: 2,
      }}
    >
      <Card sx={{ width: "min(720px, 100%)", overflow: "hidden" }}>
        <Box sx={{ bgcolor: "#103a2f", color: "white", p: 3 }}>
          <Brand dark />
        </Box>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Stack spacing={3}>
            <Box>
              <Typography
                variant="overline"
                color="secondary.main"
                sx={{ fontWeight: 700, letterSpacing: ".14em" }}
              >
                Dépôt sécurisé
              </Typography>
              <Typography variant="h2" sx={{ fontSize: { xs: 32, sm: 44 } }}>
                Envoyer une pièce au cabinet
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Aucun compte Fiscora n’est nécessaire. Ce lien est personnel et
                ne répond qu’à la demande indiquée.
              </Typography>
            </Box>

            {request.isLoading && (
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <CircularProgress size={22} />
                <Typography>Vérification du lien…</Typography>
              </Stack>
            )}
            {error && <Alert severity="error">{error}</Alert>}

            {receipt && (
              <Alert
                severity="success"
                icon={<CheckCircleOutlineRounded />}
              >
                <strong>{receipt.originalName}</strong> a bien été transmis au
                cabinet. Vous pouvez fermer cette page.
              </Alert>
            )}

            {preview && !receipt && (
              <>
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 3,
                    p: 2.5,
                    bgcolor: "rgba(255,255,255,.65)",
                  }}
                >
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Cabinet
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }}>
                        {preview.organizationName}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Dossier · période
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }}>
                        {preview.dossierName} · {String(preview.periodMonth).padStart(2, "0")}/
                        {preview.periodYear}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Pièce demandée
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }}>
                        {preview.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {documentCategoryLabel(preview.category)}
                      </Typography>
                    </Box>
                    {preview.message && (
                      <Alert severity="info">{preview.message}</Alert>
                    )}
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ flexWrap: "wrap" }}
                    >
                      <Chip
                        icon={<LockOutlined />}
                        label={`Lien valable jusqu’au ${formatDateTime(preview.expiresAtUtc)}`}
                        variant="outlined"
                      />
                      {preview.dueOn && (
                        <Chip label={`Demandé avant le ${preview.dueOn}`} />
                      )}
                    </Stack>
                  </Stack>
                </Box>

                {closed ? (
                  <Alert
                    severity={preview.status === "RECEIVED" ? "success" : "warning"}
                  >
                    {preview.status === "RECEIVED"
                      ? "Une pièce a déjà été transmise avec ce lien."
                      : "Ce lien a expiré. Demandez un nouveau lien au cabinet."}
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    <Button
                      component="label"
                      variant="outlined"
                      size="large"
                      startIcon={
                        file ? (
                          <InsertDriveFileOutlined />
                        ) : (
                          <CloudUploadOutlined />
                        )
                      }
                      sx={{ py: 2, borderStyle: "dashed" }}
                    >
                      {file ? file.name : "Choisir le document"}
                      <input
                        hidden
                        type="file"
                        accept={accepted}
                        onChange={(event) =>
                          setFile(event.target.files?.[0] ?? null)
                        }
                      />
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      PDF, image, Excel, XML ou CSV · 20 Mo maximum · analyse
                      antivirus avant enregistrement.
                    </Typography>
                    <Button
                      size="large"
                      variant="contained"
                      disabled={!file || upload.isPending}
                      onClick={() => upload.mutate()}
                    >
                      {upload.isPending
                        ? "Analyse et envoi…"
                        : "Envoyer au cabinet"}
                    </Button>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
