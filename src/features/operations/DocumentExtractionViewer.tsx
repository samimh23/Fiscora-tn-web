import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
} from "@mui/material";
import { api } from "../../api/client";
import type { DocumentExtractionReviewItem } from "../../types/api";
import { DocumentExtractionReviewDialog } from "./DocumentExtractionReviewDialog";

/** Reopen persisted results, never rerun extraction or submit an approval. */
export function DocumentExtractionViewer({
  organizationId,
  dossierId,
  documentId,
  onClose,
}: {
  organizationId: string;
  dossierId: string;
  documentId: string;
  onClose: () => void;
}) {
  const extraction = useQuery({
    queryKey: [
      "saved-document-extraction",
      organizationId,
      dossierId,
      documentId,
    ],
    queryFn: () =>
      api.get<DocumentExtractionReviewItem>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${documentId}/extraction`,
      ),
    retry: false,
  });
  if (extraction.data?.document && extraction.data.normalizedData)
    return (
      <DocumentExtractionReviewDialog
        key={`${organizationId}:${dossierId}:${documentId}`}
        organizationId={organizationId}
        dossierId={dossierId}
        target={extraction.data}
        readOnly
        onClose={onClose}
      />
    );
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Original et résultats</DialogTitle>
      <DialogContent>
        {extraction.isLoading ? (
          <Skeleton height={100} />
        ) : (
          <Alert severity="warning">
            {extraction.isError
              ? "Impossible de charger les résultats enregistrés. Le document n’a pas été relu ni réimporté."
              : "Aucun résultat enregistré n’est disponible pour cette pièce."}
          </Alert>
        )}
        {extraction.isError && (
          <Button onClick={() => void extraction.refetch()}>Réessayer</Button>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
      </DialogActions>
    </Dialog>
  );
}
