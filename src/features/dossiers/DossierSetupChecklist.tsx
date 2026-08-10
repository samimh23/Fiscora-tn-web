import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import {
  ArrowForwardRounded,
  CheckCircleRounded,
  RadioButtonUncheckedRounded,
} from "@mui/icons-material";
import { api, ApiError } from "../../api/client";
import type { DossierSetupStatus, DossierSummary } from "../../types/api";

/**
 * Un dossier neuf n'a ni exercice, ni plan comptable, ni tiers : la facture
 * est alors impossible à enregistrer et les listes déroulantes restent vides
 * sans explication. Cette check-list rend les étapes restantes visibles et
 * exécutables en un clic, directement depuis la fiche du dossier.
 */
export function DossierSetupChecklist({
  organizationId,
  dossierId,
  dossier,
  canManage,
  onGoToProduction,
}: {
  organizationId: string;
  dossierId: string;
  dossier: DossierSummary;
  canManage: boolean;
  onGoToProduction: () => void;
}) {
  const queryClient = useQueryClient();
  const base = `/api/organizations/${organizationId}/dossiers/${dossierId}`;

  const status = useQuery({
    queryKey: ["dossier-setup-status", organizationId, dossierId],
    queryFn: () => api.get<DossierSetupStatus>(`${base}/setup-status`),
    enabled: Boolean(organizationId && dossierId),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["dossier-setup-status", organizationId, dossierId],
      }),
      queryClient.invalidateQueries({ queryKey: ["journals"] }),
      queryClient.invalidateQueries({ queryKey: ["ledger-accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["fiscal-years"] }),
    ]);
  };

  // Les trois étapes bloquantes sont automatisables : on les exécute sur
  // place plutôt que d'envoyer le comptable chercher le bon écran.
  const fixers: Record<string, () => Promise<unknown>> = {
    fiscal_year: () => {
      const year = new Date().getFullYear();
      const month = dossier.fiscalYearStartMonth ?? 1;
      const day = dossier.fiscalYearStartDay ?? 1;
      const pad = (value: number) => String(value).padStart(2, "0");
      const startsOn = `${year}-${pad(month)}-${pad(day)}`;
      const end = new Date(Date.UTC(year, month - 1, day));
      end.setUTCFullYear(end.getUTCFullYear() + 1);
      end.setUTCDate(end.getUTCDate() - 1);
      return api.post(`${base}/fiscal-years`, {
        name: `Exercice ${year}`,
        startsOn,
        endsOn: end.toISOString().slice(0, 10),
      });
    },
    chart_of_accounts: () =>
      api.post(`${base}/ledger-accounts/apply-tunisian-chart`, {}),
    journals: () => api.post(`${base}/setup/journals`, {}),
  };

  // Le bouton exécute l'étape sur place ; son libellé doit donc annoncer
  // l'action réelle. Un « Configurer » générique laisse croire à une
  // navigation et fait passer l'exécution pour un clic sans effet.
  const actionLabels: Record<string, string> = {
    fiscal_year: "Créer l’exercice",
    chart_of_accounts: "Installer le plan",
    journals: "Créer les journaux",
  };
  const doneMessages: Record<string, string> = {
    fiscal_year: "Exercice comptable créé.",
    chart_of_accounts: "Plan comptable NC 01 installé.",
    journals: "Journaux comptables créés.",
  };

  const runStep = useMutation({
    mutationFn: (key: string) => fixers[key](),
    onSuccess: refresh,
  });

  if (status.isLoading || !status.data) return null;
  if (status.data.isComplete) return null;

  const { steps, completedCount, totalCount, canRecordInvoices } = status.data;
  const progress = (completedCount / totalCount) * 100;

  return (
    <Card
      sx={{
        mb: 2.5,
        borderColor: canRecordInvoices ? "divider" : "warning.main",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Box>
            <Typography variant="h3">Configuration du dossier</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Terminez ces étapes pour pouvoir saisir les factures et produire
              la comptabilité.
            </Typography>
          </Box>
          <Chip
            label={`${completedCount}/${totalCount} terminé`}
            color={canRecordInvoices ? "success" : "warning"}
            variant="outlined"
          />
        </Stack>

        <LinearProgress
          variant="determinate"
          value={progress}
          color={canRecordInvoices ? "success" : "warning"}
          sx={{ height: 6, mt: 2 }}
        />

        {!canRecordInvoices && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Aucune facture ne peut être enregistrée tant que les étapes marquées
            « bloquant » ne sont pas terminées.
          </Alert>
        )}
        {runStep.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {runStep.error instanceof ApiError
              ? runStep.error.message
              : "L’opération a échoué."}
          </Alert>
        )}
        {runStep.isSuccess && runStep.variables && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {doneMessages[runStep.variables] ?? "Étape terminée."}
          </Alert>
        )}

        <Divider sx={{ my: 2 }} />

        <Stack divider={<Divider />}>
          {steps.map((step) => {
            const pending = runStep.isPending && runStep.variables === step.key;
            const fixable = Boolean(fixers[step.key]) && canManage;
            return (
              <Box
                key={step.key}
                sx={{
                  py: 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                {step.done ? (
                  <CheckCircleRounded
                    sx={{ color: "success.main", fontSize: 20 }}
                  />
                ) : (
                  <RadioButtonUncheckedRounded
                    sx={{ color: "text.disabled", fontSize: 20 }}
                  />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: step.done ? "text.secondary" : "text.primary",
                      }}
                    >
                      {step.label}
                    </Typography>
                    {!step.done && step.blocking && (
                      <Chip label="bloquant" size="small" color="warning" />
                    )}
                    {step.done && step.count > 1 && (
                      <Typography variant="caption" color="text.secondary">
                        {step.count}
                      </Typography>
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {step.description}
                  </Typography>
                </Box>
                {!step.done &&
                  (fixable ? (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={runStep.isPending}
                      onClick={() => runStep.mutate(step.key)}
                      startIcon={
                        pending ? <CircularProgress size={14} /> : undefined
                      }
                      sx={{ flex: "0 0 auto", whiteSpace: "nowrap" }}
                    >
                      {actionLabels[step.key] ?? "Configurer"}
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      onClick={onGoToProduction}
                      endIcon={<ArrowForwardRounded />}
                    >
                      Ouvrir
                    </Button>
                  ))}
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
