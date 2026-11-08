import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { api, fetchApiFile } from "../../api/client";
import type { DocumentPreview } from "../../types/api";
import { PdfDocumentViewer } from "../../components/PdfDocumentViewer";
import type { AssistantCitation, AssistantMessage } from "./history";
import {
  assistantMode,
  isDocumentCitation,
  safeAssistantPath,
} from "./source-target";
import "./assistant-controls.css";

function SourcePreview({
  citation,
  organizationId,
  dossierId,
  onClose,
}: {
  citation: AssistantCitation;
  organizationId: string;
  dossierId: string;
  onClose: () => void;
}) {
  const base = `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${citation.sourceId}`;
  const preview = useQuery({
    queryKey: [
      "assistant-source-preview",
      organizationId,
      dossierId,
      citation.sourceId,
    ],
    queryFn: () => api.get<DocumentPreview>(`${base}/preview`),
    retry: false,
  });
  const [image, setImage] = useState("");
  const [imageError, setImageError] = useState(false);
  useEffect(() => {
    if (preview.data?.kind !== "image") return;
    let active = true;
    let url = "";
    setImage("");
    setImageError(false);
    void fetchApiFile(`${base}/content`)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setImage(url);
      })
      .catch(() => {
        if (active) setImageError(true);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [base, preview.data?.kind]);
  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      sx={{ zIndex: 1500 }}
    >
      <DialogTitle>{citation.sourceName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} className="fiscora-chat-tools">
          <Typography variant="body2">
            {citation.pageNumber
              ? `Page localisée : ${citation.pageNumber}`
              : citation.pages?.length
                ? `L’extrait couvre les pages ${citation.pages.join(", ")}.`
                : "Page non localisée : comparez l’extrait avec l’original. Aucun numéro de page n’est supposé."}
          </Typography>
          {citation.excerpt && (
            <Box>
              <Typography sx={{ fontWeight: 700 }}>
                Extrait des données validées
              </Typography>
              <Typography
                sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {citation.excerpt}
              </Typography>
            </Box>
          )}
          {preview.isPending && (
            <Typography role="status">Chargement de l’original…</Typography>
          )}
          {(preview.isError || imageError) && (
            <Alert severity="warning">
              L’original est indisponible ou votre accès ne permet pas de
              l’ouvrir. Les autorisations et le contrôle antivirus restent
              appliqués.
            </Alert>
          )}
          {preview.data?.kind === "pdf" && (
            <PdfDocumentViewer
              sourcePath={`${base}/content`}
              originalName={citation.sourceName}
              initialPage={citation.pageNumber ?? citation.pages?.[0] ?? 1}
            />
          )}
          {preview.data?.kind === "image" && image && (
            <Box
              component="img"
              src={image}
              alt={`Original : ${citation.sourceName}`}
              sx={{ width: "100%", maxHeight: "70vh", objectFit: "contain" }}
            />
          )}
          {preview.data?.kind === "text" && (
            <Typography component="pre" sx={{ whiteSpace: "pre-wrap" }}>
              {preview.data.content}
            </Typography>
          )}
          {(preview.data?.kind === "unsupported" ||
            preview.data?.kind === "spreadsheet") && (
            <Typography>
              Consultez cette pièce dans Documents pour son aperçu complet.
            </Typography>
          )}
          <div>
            <button
              type="button"
              className="chat-btn chat-btn-sm"
              onClick={onClose}
            >
              Fermer la source
            </button>
          </div>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export function AssistantAnswerDetails({
  message,
  organizationId,
  dossierId,
  compact = false,
}: {
  message: AssistantMessage;
  organizationId: string;
  dossierId: string;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const [source, setSource] = useState<AssistantCitation | null>(null);
  const [showAll, setShowAll] = useState(false);
  const citations = message.citations ?? [];
  return (
    <Stack spacing={1} sx={{ mt: 1 }} className="fiscora-chat-tools">
      <div>
        <span className="chat-badge chat-badge-sm h-auto min-h-5 whitespace-normal">
          {assistantMode(message)}
        </span>
      </div>
      {(showAll || !compact ? citations : citations.slice(0, 3)).map(
        (citation) => (
          <div key={citation.chunkId}>
            <button
              type="button"
              className="chat-btn chat-btn-xs"
              style={{
                height: "auto",
                minHeight: "1.6rem",
                maxWidth: "100%",
                whiteSpace: "normal",
                textAlign: "start",
              }}
              disabled={
                !isDocumentCitation(citation) &&
                !safeAssistantPath(citation.path)
              }
              onClick={() => {
                if (isDocumentCitation(citation)) setSource(citation);
                else {
                  const path = safeAssistantPath(citation.path);
                  if (path) navigate(path);
                }
              }}
            >
              [{citation.label}] {citation.sourceName}
              {citation.pageNumber ? ` · p. ${citation.pageNumber}` : ""}
            </button>
          </div>
        ),
      )}
      {compact && citations.length > 3 && (
        <div>
          <button
            type="button"
            className="chat-btn chat-btn-xs"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll
              ? "Réduire les sources"
              : `Voir les ${citations.length} sources`}
          </button>
        </div>
      )}
      {source && organizationId && dossierId && (
        <SourcePreview
          key={`${organizationId}:${dossierId}:${source.sourceId}`}
          citation={source}
          organizationId={organizationId}
          dossierId={dossierId}
          onClose={() => setSource(null)}
        />
      )}
    </Stack>
  );
}

export function AssistantRequestStatus({
  message,
  onRetry,
}: {
  message: AssistantMessage;
  onRetry: () => void;
}) {
  if (!message.status) return null;
  return (
    <Stack spacing={1} sx={{ mt: 1 }} className="fiscora-chat-tools">
      <Typography variant="caption" role="status">
        {message.error ?? "La réponse n’a pas été affichée."}
      </Typography>
      <div>
        <button
          type="button"
          className="chat-btn chat-btn-xs"
          onClick={onRetry}
        >
          Réessayer cette question
        </button>
      </div>
    </Stack>
  );
}

export function AssistantStopButton({ onStop }: { onStop: () => void }) {
  return (
    <div className="fiscora-chat-tools">
      <button
        type="button"
        className="chat-btn chat-btn-sm"
        onClick={onStop}
        title="Arrête l’attente dans ce chat. Le traitement envoyé peut encore se terminer côté serveur."
      >
        Arrêter l’attente
      </button>
    </div>
  );
}
