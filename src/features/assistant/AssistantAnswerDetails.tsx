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
  TextField,
  Typography,
} from "@mui/material";
import { api, fetchApiFile } from "../../api/client";
import type { DocumentPreview } from "../../types/api";
import { PdfDocumentViewer } from "../../components/PdfDocumentViewer";
import {
  citedLabels,
  sendAssistantFeedback,
  type AssistantCitation,
  type AssistantFeedback,
  type AssistantMessage,
} from "./history";
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
  const allCitations = message.citations ?? [];
  // Show the sources the answer actually cites ([S4]); the others the model
  // read stay one click away instead of crowding the answer.
  const labels = citedLabels(message.text);
  const cited = labels.size
    ? allCitations.filter((citation) => labels.has(citation.label))
    : allCitations;
  const others = allCitations.filter((citation) => !cited.includes(citation));
  const visible = showAll ? allCitations : cited;
  const citations = compact && !showAll ? visible.slice(0, 3) : visible;
  const hidden = allCitations.length - citations.length;
  return (
    <Stack spacing={1} sx={{ mt: 1 }} className="fiscora-chat-tools">
      <div>
        <span className="chat-badge chat-badge-sm h-auto min-h-5 whitespace-normal">
          {assistantMode(message)}
        </span>
      </div>
      {citations.map((citation) => (
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
              !isDocumentCitation(citation) && !safeAssistantPath(citation.path)
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
      ))}
      {(hidden > 0 || (showAll && (others.length > 0 || compact))) && (
        <div>
          <button
            type="button"
            className="chat-btn chat-btn-xs"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll
              ? "Réduire les sources"
              : `+ ${hidden} autre(s) source(s) consultée(s)`}
          </button>
        </div>
      )}
      {message.turnId && organizationId && (
        <AnswerFeedback
          organizationId={organizationId}
          turnId={message.turnId}
          initial={message.feedback ?? null}
        />
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

/** 👍 / 👎 on an answer, with an optional comment on 👎. */
function AnswerFeedback({
  organizationId,
  turnId,
  initial,
}: {
  organizationId: string;
  turnId: string;
  initial: AssistantFeedback | null;
}) {
  const [rating, setRating] = useState<1 | -1 | null>(initial?.rating ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [askComment, setAskComment] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const save = async (next: 1 | -1 | 0, text?: string) => {
    setState("saving");
    try {
      await sendAssistantFeedback(organizationId, turnId, next, text);
      setRating(next === 0 ? null : next);
      setState("saved");
    } catch {
      setState("error");
    }
  };

  const vote = (next: 1 | -1) => {
    if (rating === next) {
      setAskComment(false);
      void save(0);
      return;
    }
    setAskComment(next === -1);
    void save(next, next === -1 ? comment.trim() || undefined : undefined);
  };

  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Cette réponse est-elle utile ?
        </Typography>
        <button
          type="button"
          className="chat-btn chat-btn-xs"
          aria-pressed={rating === 1}
          aria-label="Réponse utile"
          title="Réponse utile"
          disabled={state === "saving"}
          onClick={() => vote(1)}
          style={
            rating === 1 ? { borderColor: "#1f7a5c", fontWeight: 700 } : {}
          }
        >
          👍
        </button>
        <button
          type="button"
          className="chat-btn chat-btn-xs"
          aria-pressed={rating === -1}
          aria-label="Réponse incorrecte ou inutile"
          title="Réponse incorrecte ou inutile"
          disabled={state === "saving"}
          onClick={() => vote(-1)}
          style={
            rating === -1 ? { borderColor: "#b42318", fontWeight: 700 } : {}
          }
        >
          👎
        </button>
        {state === "saved" && rating !== null && (
          <Typography variant="caption" role="status">
            Merci, avis enregistré.
          </Typography>
        )}
        {state === "error" && (
          <Typography
            variant="caption"
            role="alert"
            sx={{ color: "error.main" }}
          >
            Avis non enregistré, réessayez.
          </Typography>
        )}
      </Stack>
      {askComment && rating === -1 && (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <TextField
            size="small"
            fullWidth
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            placeholder="Qu’est-ce qui ne va pas ? (facultatif)"
            aria-label="Qu’est-ce qui ne va pas ?"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void save(-1, comment.trim() || undefined);
                setAskComment(false);
              }
            }}
          />
          <button
            type="button"
            className="chat-btn chat-btn-xs"
            disabled={state === "saving"}
            onClick={() => {
              void save(-1, comment.trim() || undefined);
              setAskComment(false);
            }}
          >
            Envoyer
          </button>
        </Stack>
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
