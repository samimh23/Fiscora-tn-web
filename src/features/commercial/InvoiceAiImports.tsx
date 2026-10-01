import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Chip, CircularProgress, Stack, Typography,
} from "@mui/material";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { AccountingDocument, BusinessInvoice } from "../../types/api";

const statuses = {
  EN_ATTENTE: { label: "Extraction en attente", color: "info" },
  EN_COURS: { label: "Extraction en cours", color: "info" },
  A_REVOIR: { label: "Prête à vérifier", color: "warning" },
  VALIDEE: { label: "Prête à préparer", color: "success" },
  ECHEC: { label: "Extraction échouée", color: "error" },
} as const;

export function InvoiceAiImports({
  organizationId, dossierId, invoices, canPrepare, preparing, onPrepare,
}: {
  organizationId: string;
  dossierId: string;
  invoices: BusinessInvoice[];
  canPrepare: boolean;
  preparing: boolean;
  onPrepare: (documentId: string) => void;
}) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const base = `/api/organizations/${organizationId}/dossiers/${dossierId}/documents`;
  const queryKey = ["dossier-documents", organizationId, dossierId, "invoice-imports"];
  const documents = useQuery({
    queryKey,
    queryFn: async () => (
      await Promise.all(["FACTURES_ACHATS", "FACTURES_VENTES"].map((category) =>
        api.get<AccountingDocument[]>(`${base}?category=${category}`),
      ))
    ).flat(),
    enabled: can("documents.view"),
    refetchInterval: (query) => (query.state.data ?? []).some((document) =>
      ["EN_ATTENTE", "EN_COURS"].includes(document.extractionStatus),
    ) ? 2500 : 30_000,
  });
  const retry = useMutation({
    mutationFn: (documentId: string) => api.post(`${base}/${documentId}/extraction`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const linkedDocuments = new Set(invoices.map((invoice) => invoice.sourceDocumentId));
  const imports = (documents.data ?? []).filter((document) =>
    !linkedDocuments.has(document.id) && document.extractionStatus in statuses,
  ).sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc));

  if (!can("documents.view")) return null;
  if (documents.isError) return (
    <Alert severity="warning" sx={{ mx: 2.5, mb: 2 }}
      action={<Button onClick={() => void documents.refetch()}>Réessayer</Button>}>
      Impossible de charger les imports IA du dossier.
    </Alert>
  );
  if (!imports.length) return null;

  return (
    <Box component="section" aria-label="Imports IA" sx={{ mx: 2.5, mb: 2.5 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography sx={{ fontWeight: 700 }}>Imports IA ({imports.length})</Typography>
        <Button size="small" disabled={documents.isFetching}
          onClick={() => void documents.refetch()}>Actualiser</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        La lecture continue en arrière-plan. Les originaux restent dans Collecte ;
        aucune facture n’est créée avant votre vérification et l’enregistrement du brouillon.
      </Typography>
      {retry.isError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {retry.error instanceof ApiError ? retry.error.message : "Impossible de relancer l’extraction."}
        </Alert>
      )}
      {imports.map((document) => {
        const status = statuses[document.extractionStatus as keyof typeof statuses];
        const processing = ["EN_ATTENTE", "EN_COURS"].includes(document.extractionStatus);
        const ready = ["A_REVOIR", "VALIDEE"].includes(document.extractionStatus);
        const actionable = canPrepare && can("documents.validate");
        return (
          <Box key={document.id} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
              sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{document.originalName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {document.category === "FACTURES_VENTES" ? "Vente" : "Achat"} · Document source
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                {processing && <CircularProgress size={18} aria-label="Traitement IA" />}
                <Chip size="small" variant="outlined" label={status.label} color={status.color} />
                {ready && actionable && (
                  <Button size="small" variant="outlined" disabled={preparing}
                    onClick={() => onPrepare(document.id)}>Préparer la facture</Button>
                )}
                {document.extractionStatus === "ECHEC" && actionable && (
                  <Button size="small" disabled={retry.isPending}
                    onClick={() => retry.mutate(document.id)}>Relancer l’extraction</Button>
                )}
              </Stack>
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}
