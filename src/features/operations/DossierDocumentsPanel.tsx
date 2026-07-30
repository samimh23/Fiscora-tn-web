import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Switch,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  CheckCircleOutlineRounded,
  DeleteOutlineRounded,
  DownloadRounded,
  InsertDriveFileOutlined,
  UploadFileRounded,
  VisibilityOutlined,
} from "@mui/icons-material";
import { api, ApiError } from "../../api/client";
import type {
  AccountingDocument,
  DocumentPreview,
  MissingDocumentExpectation,
} from "../../types/api";
import { documentCategories, documentCategoryLabel } from "./options";

const current = new Date();
const currentYear = current.getFullYear();
const currentMonth = current.getMonth() + 1;
const accepted = ".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.xml,.csv";
const fileSize = (value: string) => {
  const bytes = Number(value);
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
};
const malwareStatus = (document: AccountingDocument) => {
  switch (document.malwareScanStatus) {
    case "SAIN":
      return { label: "Antivirus : sain", color: "success" as const };
    case "INFECTE":
      return { label: "Fichier bloqué", color: "error" as const };
    case "ERREUR":
      return { label: "Analyse indisponible", color: "warning" as const };
    default:
      return { label: "Analyse requise", color: "warning" as const };
  }
};

export function DossierDocumentsPanel({
  organizationId,
  dossierId,
  archived,
  canUpload,
}: {
  organizationId: string;
  dossierId: string;
  archived: boolean;
  canUpload: boolean;
}) {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [category, setCategory] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [expectationOpen, setExpectationOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountingDocument | null>(
    null,
  );
  const [previewTarget, setPreviewTarget] = useState<AccountingDocument | null>(
    null,
  );
  const [previewSheet, setPreviewSheet] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState("BOITE_RECEPTION");
  const [shareWithClient, setShareWithClient] = useState(false);
  const [expectationId, setExpectationId] = useState("");
  const [expectationLabel, setExpectationLabel] = useState("");
  const [expectationCategory, setExpectationCategory] =
    useState("BOITE_RECEPTION");
  const [receiveSelections, setReceiveSelections] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState("");
  const documents = useQuery({
    queryKey: [
      "dossier-documents",
      organizationId,
      dossierId,
      year,
      month,
      category,
    ],
    queryFn: () =>
      api.get<AccountingDocument[]>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents?periodYear=${year}&periodMonth=${month}${category ? `&category=${category}` : ""}`,
      ),
  });
  const expectations = useQuery({
    queryKey: ["missing-documents", organizationId, dossierId, year, month],
    queryFn: () =>
      api.get<MissingDocumentExpectation[]>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/missing/${year}/${month}`,
      ),
  });
  const preview = useQuery({
    queryKey: [
      "document-preview",
      organizationId,
      dossierId,
      previewTarget?.id,
    ],
    queryFn: async () => {
      const result = await api.get<DocumentPreview>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${previewTarget!.id}/preview`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["dossier-documents", organizationId, dossierId],
      });
      return result;
    },
    enabled: Boolean(previewTarget),
    retry: false,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["dossier-documents", organizationId, dossierId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["missing-documents", organizationId, dossierId],
    });
  };
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Sélectionnez un fichier.");
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Le fichier dépasse la limite de 20 Mo.");
      const data = new FormData();
      data.append("file", file);
      data.append("category", uploadCategory);
      data.append("periodYear", String(year));
      data.append("periodMonth", String(month));
      data.append("isClientVisible", String(shareWithClient));
      const result = await api.upload<AccountingDocument>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents`,
        data,
      );
      if (expectationId)
        await api.patch(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/missing/${expectationId}/receive/${result.id}`,
        );
      return result;
    },
    onSuccess: async () => {
      setUploadOpen(false);
      setFile(null);
      setExpectationId("");
      setError("");
      await refresh();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError || reason instanceof Error
          ? reason.message
          : "Téléversement impossible.",
      ),
  });
  const action = useMutation({
    mutationFn: async ({
      type,
      document,
      id,
      documentId,
    }: {
      type: string;
      document?: AccountingDocument;
      id?: string;
      documentId?: string;
    }) => {
      if (type === "delete" && document)
        return api.delete(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${document.id}`,
        );
      if (type === "processed" && document)
        return api.patch(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${document.id}`,
          {
            category: document.category,
            periodYear: document.periodYear,
            periodMonth: document.periodMonth,
            processingStatus: "TRAITE",
            extractionStatus: document.extractionStatus,
          },
        );
      if (type === "expectation")
        return api.post(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/missing`,
          {
            periodYear: year,
            periodMonth: month,
            label: expectationLabel.trim(),
            category: expectationCategory,
          },
        );
      if (type === "receive" && id && documentId)
        return api.patch(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/missing/${id}/receive/${documentId}`,
        );
    },
    onSuccess: async (_, variables) => {
      if (variables.type === "delete") setDeleteTarget(null);
      if (variables.type === "expectation") {
        setExpectationOpen(false);
        setExpectationLabel("");
      }
      setError("");
      await refresh();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError ? reason.message : "Action impossible.",
      ),
  });
  const download = async (document: AccountingDocument) => {
    try {
      const response = await api.get<{ url: string }>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${document.id}/download`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["dossier-documents", organizationId, dossierId],
      });
      window.open(response.url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Téléchargement impossible.",
      );
    }
  };
  const missing =
    expectations.data?.filter((entry) => !entry.receivedDocumentId) ?? [];

  return (
    <>
      <Box className="documents-layout">
        <Card>
          <Box
            sx={{
              p: 2.5,
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography variant="h3" sx={{ fontSize: 24 }}>
                Pièces du dossier
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Fichiers classés dans le stockage sécurisé.
              </Typography>
            </Box>
            {canUpload && !archived && (
              <Button
                variant="contained"
                startIcon={<UploadFileRounded />}
                onClick={() => {
                  setUploadOpen(true);
                  setError("");
                }}
              >
                Déposer un document
              </Button>
            )}
          </Box>
          <Box
            sx={{
              px: 2.5,
              pb: 2,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr 1fr",
                sm: "120px 140px minmax(180px, 1fr)",
              },
              gap: 1.5,
            }}
          >
            <TextField
              select
              size="small"
              label="Année"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Mois"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map(
                (value) => (
                  <MenuItem key={value} value={value}>
                    {String(value).padStart(2, "0")}
                  </MenuItem>
                ),
              )}
            </TextField>
            <TextField
              select
              size="small"
              label="Catégorie"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              sx={{ gridColumn: { xs: "span 2", sm: "auto" } }}
            >
              <MenuItem value="">Toutes</MenuItem>
              {documentCategories.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          {error && (
            <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>
              {error}
            </Alert>
          )}
          {documents.isLoading && (
            <Box sx={{ p: 2.5 }}>
              <Skeleton height={70} />
              <Skeleton height={70} />
            </Box>
          )}
          {documents.isError && (
            <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>
              Impossible de charger les documents.
            </Alert>
          )}
          {!documents.isLoading && !documents.data?.length && (
            <Box sx={{ p: 6, textAlign: "center" }}>
              <InsertDriveFileOutlined
                sx={{ fontSize: 44, color: "text.disabled" }}
              />
              <Typography sx={{ fontWeight: 800, mt: 1 }}>
                Aucun document pour cette période
              </Typography>
            </Box>
          )}
          {documents.data?.map((document) => (
            <Box
              key={document.id}
              sx={{
                px: 3,
                py: 2,
                borderTop: "1px solid",
                borderColor: "divider",
                display: "flex",
                gap: 2,
                alignItems: "center",
              }}
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2.5,
                  bgcolor: "primary.light",
                  color: "primary.main",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <InsertDriveFileOutlined />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800 }} noWrap>
                  {document.originalName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {documentCategoryLabel(document.category)} ·{" "}
                  {fileSize(document.sizeBytes)} · v{document.version}
                </Typography>
              </Box>
              <Chip
                label={
                  document.processingStatus === "TRAITE"
                    ? "Traité"
                    : "À traiter"
                }
                color={
                  document.processingStatus === "TRAITE" ? "success" : "warning"
                }
                size="small"
                variant="outlined"
              />
              <Tooltip
                title={
                  document.malwareScanStatus === "INFECTE"
                    ? `Menace détectée : ${document.malwareSignature ?? "signature inconnue"}`
                    : "Tous les documents doivent être analysés avant leur ouverture."
                }
              >
                <Chip
                  label={malwareStatus(document).label}
                  color={malwareStatus(document).color}
                  size="small"
                  variant="outlined"
                />
              </Tooltip>
              {canUpload &&
                !archived &&
                document.processingStatus !== "TRAITE" && (
                  <Tooltip title="Marquer comme traité">
                    <IconButton
                      color="success"
                      onClick={() =>
                        action.mutate({ type: "processed", document })
                      }
                    >
                      <CheckCircleOutlineRounded />
                    </IconButton>
                  </Tooltip>
                )}
              <Tooltip title="Aperçu">
                <IconButton
                  color="primary"
                  disabled={document.malwareScanStatus === "INFECTE"}
                  onClick={() => {
                    setPreviewSheet(0);
                    setPreviewTarget(document);
                  }}
                >
                  <VisibilityOutlined />
                </IconButton>
              </Tooltip>
              <Tooltip title="Télécharger">
                <IconButton
                  disabled={document.malwareScanStatus === "INFECTE"}
                  onClick={() => void download(document)}
                >
                  <DownloadRounded />
                </IconButton>
              </Tooltip>
              {canUpload && !archived && (
                <Tooltip title="Supprimer">
                  <IconButton
                    color="error"
                    onClick={() => setDeleteTarget(document)}
                  >
                    <DeleteOutlineRounded />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          ))}
        </Card>
        <Card>
          <Box
            sx={{
              p: 2.5,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Box>
              <Typography variant="h3" sx={{ fontSize: 22 }}>
                Documents attendus
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {String(month).padStart(2, "0")}/{year}
              </Typography>
            </Box>
            {canUpload && !archived && (
              <IconButton
                color="primary"
                onClick={() => setExpectationOpen(true)}
              >
                <AddRounded />
              </IconButton>
            )}
          </Box>
          {expectations.isLoading && (
            <Box sx={{ p: 2.5 }}>
              <Skeleton height={60} />
            </Box>
          )}
          {!expectations.isLoading && !expectations.data?.length && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ px: 2.5, pb: 3 }}
            >
              Aucune pièce attendue définie.
            </Typography>
          )}
          {expectations.data?.map((entry) => (
            <Box
              key={entry.id}
              sx={{
                px: 2.5,
                py: 1.8,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    {entry.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {documentCategoryLabel(entry.category)}
                  </Typography>
                </Box>
                <Chip
                  label={entry.receivedDocumentId ? "Reçu" : "Manquant"}
                  size="small"
                  color={entry.receivedDocumentId ? "success" : "error"}
                  variant="outlined"
                />
              </Box>
              {canUpload &&
              !archived &&
              !entry.receivedDocumentId &&
              documents.data?.length ? (
                <Box sx={{ display: "flex", gap: 1, mt: 1.2 }}>
                  <Select
                    size="small"
                    displayEmpty
                    fullWidth
                    value={receiveSelections[entry.id] ?? ""}
                    onChange={(event) =>
                      setReceiveSelections({
                        ...receiveSelections,
                        [entry.id]: event.target.value,
                      })
                    }
                  >
                    <MenuItem value="">Associer un document…</MenuItem>
                    {documents.data.map((document) => (
                      <MenuItem key={document.id} value={document.id}>
                        {document.originalName}
                      </MenuItem>
                    ))}
                  </Select>
                  <Button
                    size="small"
                    disabled={!receiveSelections[entry.id]}
                    onClick={() =>
                      action.mutate({
                        type: "receive",
                        id: entry.id,
                        documentId: receiveSelections[entry.id],
                      })
                    }
                  >
                    Lier
                  </Button>
                </Box>
              ) : null}
            </Box>
          ))}
        </Card>
      </Box>
      <Dialog
        open={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(null)}
        fullWidth
        maxWidth="xl"
        slotProps={{ paper: { sx: { height: { xs: "94vh", md: "88vh" } } } }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3" sx={{ fontSize: 22 }} noWrap>
              Aperçu du document
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {previewTarget?.originalName}
            </Typography>
          </Box>
          {previewTarget && (
            <Button
              variant="outlined"
              startIcon={<DownloadRounded />}
              onClick={() => void download(previewTarget)}
            >
              Télécharger
            </Button>
          )}
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            p: { xs: 1.5, md: 2.5 },
            bgcolor: "grey.100",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {preview.isLoading && (
            <Box sx={{ p: 3 }}>
              <Skeleton height={48} />
              <Skeleton height={420} />
            </Box>
          )}
          {preview.isError && (
            <Alert severity="error">
              Impossible de générer l’aperçu. Vous pouvez toujours télécharger
              le document.
            </Alert>
          )}
          {preview.data?.kind === "image" && preview.data.url && (
            <Box
              component="img"
              src={preview.data.url}
              alt={preview.data.originalName}
              sx={{
                maxWidth: "100%",
                maxHeight: "100%",
                m: "auto",
                objectFit: "contain",
                bgcolor: "common.white",
                boxShadow: 2,
              }}
            />
          )}
          {preview.data?.kind === "pdf" && preview.data.url && (
            <Box
              component="iframe"
              src={preview.data.url}
              title={`Aperçu de ${preview.data.originalName}`}
              sx={{
                width: "100%",
                flex: 1,
                minHeight: 500,
                border: 0,
                bgcolor: "common.white",
              }}
            />
          )}
          {preview.data?.kind === "text" && (
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2.5,
                overflow: "auto",
                flex: 1,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                bgcolor: "common.white",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                fontFamily: "monospace",
                fontSize: 13,
              }}
            >
              {preview.data.content}
              {preview.data.truncated
                ? "\n\n— Aperçu limité. Téléchargez le fichier pour voir la suite. —"
                : ""}
            </Box>
          )}
          {preview.data?.kind === "spreadsheet" && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                minHeight: 0,
                flex: 1,
              }}
            >
              <TextField
                select
                size="small"
                label="Feuille"
                value={previewSheet}
                onChange={(event) =>
                  setPreviewSheet(Number(event.target.value))
                }
                sx={{ width: { xs: "100%", sm: 280 }, bgcolor: "common.white" }}
              >
                {preview.data.sheets?.map((sheet, index) => (
                  <MenuItem key={`${sheet.name}-${index}`} value={index}>
                    {sheet.name}
                  </MenuItem>
                ))}
              </TextField>
              {preview.data.sheets?.[previewSheet]?.truncated && (
                <Alert severity="info">
                  L’aperçu est limité aux 250 premières lignes et 50 colonnes.
                </Alert>
              )}
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflow: "auto",
                  bgcolor: "common.white",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <Box
                  component="table"
                  sx={{
                    borderCollapse: "collapse",
                    minWidth: "100%",
                    width: "max-content",
                    "& td, & th": {
                      borderRight: "1px solid",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      px: 1.5,
                      py: 1,
                      maxWidth: 360,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 13,
                    },
                    "& th": {
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                    },
                  }}
                >
                  <thead>
                    <tr>
                      <th>#</th>
                      {Array.from({
                        length: Math.max(
                          0,
                          ...(preview.data.sheets?.[previewSheet]?.rows.map(
                            (row) => row.length,
                          ) ?? []),
                        ),
                      }).map((_, index) => (
                        <th key={index}>{index + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.data.sheets?.[previewSheet]?.rows.map(
                      (row, rowIndex) => (
                        <tr key={rowIndex}>
                          <td>{rowIndex + 1}</td>
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              title={cell == null ? "" : String(cell)}
                            >
                              {cell == null ? "" : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ),
                    )}
                  </tbody>
                </Box>
              </Box>
            </Box>
          )}
          {preview.data?.kind === "unsupported" && (
            <Alert severity="info">{preview.data.message}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewTarget(null)}>Fermer</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={uploadOpen}
        onClose={upload.isPending ? undefined : () => setUploadOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Déposer un document</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Button
            component="label"
            variant="outlined"
            startIcon={<UploadFileRounded />}
          >
            {file ? file.name : "Choisir un fichier"}
            <input
              hidden
              type="file"
              accept={accepted}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Button>
          <TextField
            select
            label="Catégorie"
            value={uploadCategory}
            onChange={(event) => setUploadCategory(event.target.value)}
          >
            {documentCategories.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          {missing.length > 0 && (
            <TextField
              select
              label="Document attendu correspondant"
              value={expectationId}
              onChange={(event) => setExpectationId(event.target.value)}
            >
              <MenuItem value="">Aucun</MenuItem>
              {missing.map((entry) => (
                <MenuItem key={entry.id} value={entry.id}>
                  {entry.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          <FormControlLabel
            control={
              <Switch
                checked={shareWithClient}
                onChange={(_, checked) => setShareWithClient(checked)}
              />
            }
            label="Rendre ce document visible dans le portail client"
          />
          <Typography variant="caption" color="text.secondary">
            PDF, images, Excel, XML ou CSV · 20 Mo maximum.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={() => upload.mutate()}
            disabled={!file || upload.isPending}
          >
            {upload.isPending ? "Envoi…" : "Téléverser"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={expectationOpen}
        onClose={() => setExpectationOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Ajouter un document attendu</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
          <TextField
            label="Libellé"
            value={expectationLabel}
            onChange={(event) => setExpectationLabel(event.target.value)}
            placeholder="Ex. Relevé bancaire BIAT"
          />
          <TextField
            select
            label="Catégorie"
            value={expectationCategory}
            onChange={(event) => setExpectationCategory(event.target.value)}
          >
            {documentCategories.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpectationOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!expectationLabel.trim()}
            onClick={() => action.mutate({ type: "expectation" })}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Supprimer ce document ?</DialogTitle>
        <DialogContent>
          <Typography>{deleteTarget?.originalName}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Annuler</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() =>
              deleteTarget &&
              action.mutate({ type: "delete", document: deleteTarget })
            }
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
