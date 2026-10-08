import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api, readSession } from "../../api/client";

export function TrainingConsentPanel({
  organizationId,
  dossierId,
}: {
  organizationId: string;
  dossierId: string;
}) {
  const owner = readSession()?.organizations.some(
    (organization) =>
      organization.id === organizationId &&
      organization.role === "Propriétaire",
  );
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const path = `/api/organizations/${organizationId}/dossiers/${dossierId}/training-consent`;
  const consent = useQuery({
    queryKey: ["training-consent", organizationId, dossierId],
    enabled: Boolean(owner),
    queryFn: () =>
      api.get<{ enabled: boolean; authorizationReference: string }>(path),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api.patch(path, {
        enabled: !consent.data?.enabled,
        authorizationReference: reference.trim(),
      }),
    onSuccess: () => {
      setOpen(false);
      setConfirmed(false);
      void client.invalidateQueries({
        queryKey: ["training-consent", organizationId, dossierId],
      });
    },
  });
  if (!owner) return null;
  return (
    <Card sx={{ p: 2, gridColumn: "1 / -1" }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <div>
          <Typography sx={{ fontWeight: 600 }}>
            Amélioration de NuExtract — collecte{" "}
            {consent.data?.enabled ? "autorisée" : "désactivée"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Option facultative : copies privées des factures et relevés corrigés
            et approuvés. Aucun entraînement automatique.
          </Typography>
        </div>
        <Button
          variant="outlined"
          disabled={consent.isLoading || consent.isError}
          onClick={() => {
            setReference("");
            setConfirmed(false);
            mutation.reset();
            setOpen(true);
          }}
        >
          {consent.data?.enabled
            ? "Retirer l’autorisation"
            : "Autoriser la collecte"}
        </Button>
      </Stack>
      {consent.isError && (
        <Alert severity="error">
          Impossible de lire l’autorisation de collecte.
        </Alert>
      )}
      <Dialog
        open={open}
        onClose={() => !mutation.isPending && setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {consent.data?.enabled
            ? "Retirer l’autorisation"
            : "Autoriser ce dossier pour le dataset"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              {consent.data?.enabled
                ? "Les prochains téléchargements seront bloqués et les copies de collecte seront supprimées en arrière-plan. Les téléchargements déjà effectués et modèles déjà entraînés ne peuvent pas être rappelés automatiquement."
                : "Les documents contiennent des informations sensibles. Confirmez que vous disposez de l’autorisation du client pour leur utilisation dans l’amélioration du modèle Fiscora, y compris les pièces déjà approuvées. Cette option ne doit pas être activée sans cette autorisation."}
            </Alert>
            <TextField
              label={
                consent.data?.enabled
                  ? "Motif du retrait"
                  : "Référence de l’autorisation du client"
              }
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              multiline
              minRows={2}
              helperText="Exemple : accord signé du client, date et référence. Minimum 8 caractères."
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
              }
              label={
                consent.data?.enabled
                  ? "Je confirme le retrait."
                  : "Je confirme disposer de l’autorisation nécessaire pour ce dossier."
              }
            />
            {mutation.error && (
              <Alert severity="error">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Action impossible."}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button
            variant="contained"
            disabled={
              !confirmed || reference.trim().length < 8 || mutation.isPending
            }
            onClick={() => mutation.mutate()}
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
