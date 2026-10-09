import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type {
  AccountingDocument,
  DocumentExtractionJob,
  DocumentExtractionReviewItem,
} from "../../types/api";
import { DocumentExtractionReviewDialog } from "../operations/DocumentExtractionReviewDialog";
import { DocumentExtractionViewer } from "../operations/DocumentExtractionViewer";

const statuses = {
  NON_DEMANDEE: { label: "Lecture IA à lancer", color: "warning" },
  EN_ATTENTE: { label: "Extraction en attente", color: "info" },
  EN_COURS: { label: "Extraction en cours", color: "info" },
  A_REVOIR: { label: "Prête à vérifier", color: "warning" },
  ECHEC: { label: "Extraction échouée", color: "error" },
  VALIDEE: { label: "Importé en banque", color: "success" },
  REJETEE: { label: "Extraction rejetée", color: "default" },
} as const;
const message = (error: unknown) =>
  error instanceof ApiError || error instanceof Error
    ? error.message
    : "La lecture du relevé est impossible.";

export function BankStatementAiImports({
  organizationId,
  dossierId,
  canImport,
  scanBankAccountId,
  onScanClose,
}: {
  organizationId: string;
  dossierId: string;
  canImport: boolean;
  scanBankAccountId: string | null;
  onScanClose: () => void;
}) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const base = `/api/organizations/${organizationId}/dossiers/${dossierId}/documents`;
  const queryKey = [
    "dossier-documents",
    organizationId,
    dossierId,
    "bank-imports",
  ];
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<AccountingDocument | null>(null);
  const [requested, setRequested] = useState(false);
  const [bankHints, setBankHints] = useState<Record<string, string>>({});
  const [reviewTarget, setReviewTarget] =
    useState<DocumentExtractionReviewItem | null>(null);
  const [resultsDocumentId, setResultsDocumentId] = useState<string | null>(
    null,
  );
  const documents = useQuery({
    queryKey,
    queryFn: () =>
      api.get<AccountingDocument[]>(`${base}?category=RELEVES_BANCAIRES`),
    enabled: can("documents.view"),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((document) =>
        ["EN_ATTENTE", "EN_COURS"].includes(document.extractionStatus),
      )
        ? 2500
        : 30_000,
  });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["dossier-documents", organizationId, dossierId],
    });
  const job = useQuery({
    queryKey: ["bank-scan-extraction", organizationId, dossierId, uploaded?.id],
    queryFn: () =>
      api.get<DocumentExtractionJob>(`${base}/${uploaded!.id}/extraction`),
    enabled: Boolean(uploaded && requested && scanBankAccountId),
    refetchInterval: (query) =>
      ["EN_ATTENTE", "EN_COURS"].includes(
        query.state.data?.status ?? "EN_ATTENTE",
      )
        ? 2500
        : false,
    retry: false,
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!file && !uploaded)
        throw new Error("Choisissez une image ou un PDF.");
      if (file && file.size > 20 * 1024 * 1024)
        throw new Error("Le fichier ne doit pas dépasser 20 Mo.");
      if (
        file &&
        !["image/png", "image/jpeg", "application/pdf"].includes(file.type)
      )
        throw new Error("Utilisez une image PNG/JPEG ou un PDF.");
      let document = uploaded;
      if (!document) {
        const now = new Date();
        const data = new FormData();
        data.append("file", file!);
        data.append("category", "RELEVES_BANCAIRES");
        data.append("periodYear", String(now.getFullYear()));
        data.append("periodMonth", String(now.getMonth() + 1));
        data.append("isClientVisible", "false");
        document = await api.upload<AccountingDocument>(base, data);
        // Keep the uploaded original if starting extraction fails; retry must not reupload it.
        setUploaded(document);
        if (scanBankAccountId)
          setBankHints((current) => ({
            ...current,
            [document!.id]: scanBankAccountId,
          }));
      }
      await api.post(`${base}/${document.id}/extraction`);
      setRequested(true);
    },
    onSettled: refresh,
  });
  const retry = useMutation({
    mutationFn: (documentId: string) =>
      api.post(`${base}/${documentId}/extraction`),
    onSuccess: refresh,
  });
  const closeScan = () => {
    if (upload.isPending || review.isPending) return;
    onScanClose();
    setFile(null);
    setUploaded(null);
    setRequested(false);
    upload.reset();
  };
  const review = useMutation({
    mutationFn: async (document: AccountingDocument) => {
      const extraction = await api.get<DocumentExtractionJob>(
        `${base}/${document.id}/extraction`,
      );
      if (extraction.status !== "A_REVOIR" || !extraction.normalizedData)
        throw new Error(
          "Cette extraction n’est plus en attente de vérification. Actualisez les imports IA.",
        );
      if (extraction.normalizedData.document_type !== "bank_statement")
        throw new Error(
          "Le document détecté n’est pas un relevé bancaire. Vérifiez-le dans Documents.",
        );
      return { ...extraction, document };
    },
    onSuccess: (target) => {
      onScanClose();
      setFile(null);
      setUploaded(null);
      setRequested(false);
      setReviewTarget(target);
    },
  });
  const imports = (documents.data ?? [])
    .filter((document) => document.extractionStatus in statuses)
    .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc));
  return (
    <>
      {documents.isError && (
        <Alert
          severity="warning"
          action={
            <Button onClick={() => void documents.refetch()}>Réessayer</Button>
          }
        >
          Impossible de charger les imports IA du dossier.
        </Alert>
      )}
      {Boolean(imports.length) && (
        <Card
          component="section"
          aria-label="Imports IA de relevés"
          sx={{ p: 2.5 }}
        >
          <Stack
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
              mb: 1,
            }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              Imports IA ({imports.length})
            </Typography>
            <Button
              size="small"
              disabled={documents.isFetching}
              onClick={() => void documents.refetch()}
            >
              Actualiser
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            La lecture continue en arrière-plan. L’original reste dans Documents
            ; le relevé bancaire est importé uniquement après votre vérification
            et confirmation.
          </Typography>
          {(retry.error || review.error) && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {message(retry.error ?? review.error)}
            </Alert>
          )}
          {imports.map((document) => {
            const status =
              statuses[document.extractionStatus as keyof typeof statuses];
            const processing = ["EN_ATTENTE", "EN_COURS"].includes(
              document.extractionStatus,
            );
            return (
              <Box
                key={document.id}
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  mb: 1,
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{
                    justifyContent: "space-between",
                    alignItems: { sm: "center" },
                  }}
                >
                  <Typography
                    sx={{ fontWeight: 600, overflowWrap: "anywhere" }}
                  >
                    {document.originalName}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
                  >
                    {processing && (
                      <CircularProgress size={18} aria-label="Traitement IA" />
                    )}
                    <Chip
                      size="small"
                      variant="outlined"
                      color={status.color}
                      label={status.label}
                    />
                    {can("documents.validate") &&
                      ["A_REVOIR", "VALIDEE", "REJETEE"].includes(
                        document.extractionStatus,
                      ) && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setResultsDocumentId(document.id)}
                        >
                          Original + résultats
                        </Button>
                      )}
                    {canImport && document.extractionStatus === "A_REVOIR" && (
                      <Button
                        size="small"
                        variant="contained"
                        disabled={review.isPending}
                        onClick={() => review.mutate(document)}
                      >
                        Vérifier les données
                      </Button>
                    )}
                    {canImport &&
                      ["ECHEC", "NON_DEMANDEE"].includes(
                        document.extractionStatus,
                      ) && (
                        <Button
                          size="small"
                          disabled={retry.isPending}
                          onClick={() => retry.mutate(document.id)}
                        >
                          Relancer l’extraction
                        </Button>
                      )}
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Card>
      )}
      <Dialog
        open={Boolean(scanBankAccountId)}
        onClose={upload.isPending || review.isPending ? undefined : closeScan}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Scanner un relevé bancaire avec l’IA</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              L’original sera conservé dans Documents. Vérifiez les dates, les
              soldes et les opérations ici avant de confirmer l’import dans le
              compte bancaire choisi.
            </Alert>
            {upload.error && (
              <Alert severity="error">{message(upload.error)}</Alert>
            )}
            {review.error && (
              <Alert severity="error">{message(review.error)}</Alert>
            )}
            {!uploaded && (
              <Button
                component="label"
                variant="outlined"
                disabled={upload.isPending}
              >
                {file ? file.name : "Choisir une image ou un PDF"}
                <input
                  hidden
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    upload.reset();
                  }}
                />
              </Button>
            )}
            {uploaded &&
              requested &&
              ["EN_ATTENTE", "EN_COURS"].includes(
                job.data?.status ?? "EN_ATTENTE",
              ) && (
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center" }}
                >
                  <CircularProgress size={22} />
                  <Typography>
                    L’IA lit le relevé… Vous pouvez continuer en arrière-plan.
                  </Typography>
                </Stack>
              )}
            {job.isError && (
              <Alert
                severity="error"
                action={
                  <Button onClick={() => void job.refetch()}>Réessayer</Button>
                }
              >
                Impossible de lire l’état de l’extraction.
              </Alert>
            )}
            {job.data?.status === "ECHEC" && (
              <Alert severity="error">
                {job.data.lastError ||
                  "La lecture IA a échoué. Fermez cette fenêtre pour relancer depuis Imports IA."}
              </Alert>
            )}
            {job.data?.status === "A_REVOIR" && (
              <Alert severity="success">
                Lecture terminée. Vérifiez les données avec la pièce originale
                avant de confirmer l’import.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={upload.isPending || review.isPending}
            onClick={closeScan}
          >
            {requested
              ? "Continuer en arrière-plan"
              : uploaded
                ? "Fermer"
                : "Annuler"}
          </Button>
          {!requested ? (
            <Button
              variant="contained"
              disabled={(!file && !uploaded) || upload.isPending}
              onClick={() => upload.mutate()}
            >
              {upload.isPending
                ? "Envoi…"
                : uploaded
                  ? "Relancer la lecture"
                  : "Lire avec l’IA"}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={job.data?.status !== "A_REVOIR" || review.isPending}
              onClick={() => uploaded && review.mutate(uploaded)}
            >
              {review.isPending ? "Chargement…" : "Vérifier les données"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
      {resultsDocumentId && (
        <DocumentExtractionViewer
          organizationId={organizationId}
          dossierId={dossierId}
          documentId={resultsDocumentId}
          onClose={() => setResultsDocumentId(null)}
        />
      )}
      {reviewTarget && (
        <DocumentExtractionReviewDialog
          key={reviewTarget.id}
          organizationId={organizationId}
          dossierId={dossierId}
          target={reviewTarget}
          initialBankAccountId={bankHints[reviewTarget.documentId]}
          onClose={() => {
            setReviewTarget(null);
            void refresh();
          }}
        />
      )}
    </>
  );
}
