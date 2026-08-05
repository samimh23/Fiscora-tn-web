import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import {
  AddRounded,
  CheckRounded,
  PlayArrowRounded,
  SendRounded,
  TimerOutlined,
  WarningAmberRounded,
} from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DossierSelector, QueryState } from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";
import { useWorkSession } from "../time-tracking/WorkSessionContext";
import type { PagedResponse, TimeEntry, WorkTask } from "../types/api";

const today = new Date().toISOString().slice(0, 10);

const anomalyLabels: Record<string, string> = {
  SAISIE_MANUELLE: "Saisie manuelle",
  DUREE_CORRIGEE: "Durée corrigée",
  SESSION_LONGUE: "Session longue",
  SANS_TACHE: "Sans tâche liée",
};

export function TimeTrackingPage() {
  const { organization, can } = useAuth();
  const workSession = useWorkSession();
  const queryClient = useQueryClient();
  const [dossierId, setDossierId] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [trackingForm, setTrackingForm] = useState({
    taskId: "",
    description: "",
    billable: true,
  });
  const [manualForm, setManualForm] = useState({
    workDate: today,
    durationMinutes: 60,
    billable: true,
    description: "",
    taskId: "",
  });

  const base =
    organization?.id && dossierId
      ? `/api/organizations/${organization.id}/dossiers/${dossierId}/time-entries`
      : "";

  const tasks = useQuery({
    queryKey: ["time-tracking-tasks", organization?.id, dossierId],
    queryFn: () =>
      api.get<PagedResponse<WorkTask>>(
        `/api/organizations/${organization?.id}/dossiers/${dossierId}/tasks?page=1&pageSize=100`,
      ),
    enabled: Boolean(organization?.id && dossierId),
  });

  const entries = useQuery({
    queryKey: ["time-entries", organization?.id, dossierId, status],
    queryFn: () =>
      api.get<TimeEntry[]>(`${base}${status ? `?status=${status}` : ""}`),
    enabled: Boolean(base),
  });

  const selectedTask = useMemo(
    () => tasks.data?.items.find((task) => task.id === trackingForm.taskId),
    [tasks.data, trackingForm.taskId],
  );

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ["time-entries"] });

  const createManual = useMutation({
    mutationFn: () =>
      api.post(base, {
        ...manualForm,
        taskId: manualForm.taskId || null,
      }),
    onSuccess: () => {
      setManualOpen(false);
      setManualForm((current) => ({ ...current, description: "" }));
      refresh();
    },
  });

  const action = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      type === "submit"
        ? api.post(`${base}/${id}/submit`)
        : api.post(`${base}/${id}/review`, {
            decision: type === "approve" ? "APPROUVER" : "REJETER",
            comment: type === "reject" ? "À corriger" : "",
          }),
    onSuccess: refresh,
  });

  const startAutomatic = async () => {
    if (!dossierId) return;
    const description =
      selectedTask?.title || trackingForm.description.trim();
    if (!description) return;
    await workSession.start({
      dossierId,
      taskId: trackingForm.taskId || null,
      description,
      billable: trackingForm.billable,
    });
  };

  const error = createManual.error ?? action.error;

  return (
    <>
      <PageHeader
        eyebrow="Production"
        title="Temps de travail"
        description="Mesurez le travail actif dans Fiscora, rattachez-le aux tâches et ne retenez que les temps validés dans la rentabilité."
        action={
          <Stack direction="row" spacing={1}>
            <DossierSelector value={dossierId} onChange={setDossierId} />
            <Button
              variant="outlined"
              startIcon={<AddRounded />}
              disabled={!base || !can("time_tracking.manage")}
              onClick={() => setManualOpen(true)}
            >
              Saisie manuelle
            </Button>
          </Stack>
        }
      />

      {(error || workSession.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error
            ? error.message
            : workSession.error || "Une erreur est survenue."}
        </Alert>
      )}

      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ alignItems: { md: "center" } }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2.5,
                bgcolor: "#e4efe9",
                color: "primary.main",
                display: "grid",
                placeItems: "center",
              }}
            >
              <TimerOutlined />
            </Box>
            <Box sx={{ minWidth: 230 }}>
              <Typography sx={{ fontWeight: 800 }}>
                Suivi automatique dans Fiscora
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pause après 2 minutes d’inactivité. Aucun texte saisi, écran ou
                autre application n’est enregistré.
              </Typography>
            </Box>
            <TextField
              select
              size="small"
              label="Tâche"
              value={trackingForm.taskId}
              onChange={(event) =>
                setTrackingForm({
                  ...trackingForm,
                  taskId: event.target.value,
                  description: "",
                })
              }
              disabled={!dossierId || tasks.isLoading}
              sx={{ minWidth: 240 }}
            >
              <MenuItem value="">Travail hors tâche</MenuItem>
              {tasks.data?.items
                .filter((task) => !["TERMINEE", "ANNULEE"].includes(task.status))
                .map((task) => (
                  <MenuItem key={task.id} value={task.id}>
                    {task.title}
                  </MenuItem>
                ))}
            </TextField>
            {!trackingForm.taskId && (
              <TextField
                size="small"
                label="Travail effectué"
                value={trackingForm.description}
                onChange={(event) =>
                  setTrackingForm({
                    ...trackingForm,
                    description: event.target.value,
                  })
                }
                sx={{ minWidth: 230, flex: 1 }}
              />
            )}
            <Button
              variant="contained"
              startIcon={<PlayArrowRounded />}
              disabled={
                !dossierId ||
                (!trackingForm.taskId && !trackingForm.description.trim()) ||
                workSession.loading ||
                !can("time_tracking.manage")
              }
              onClick={() => void startAutomatic().catch(() => undefined)}
            >
              Démarrer
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" sx={{ mb: 2, justifyContent: "flex-end" }}>
            <TextField
              select
              size="small"
              label="Statut"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Tous</MenuItem>
              {["BROUILLON", "SOUMIS", "APPROUVE", "REJETE"].map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <QueryState
            loading={entries.isLoading}
            error={entries.isError}
            empty={!entries.data?.length}
          />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Collaborateur</TableCell>
                <TableCell>Travail effectué</TableCell>
                <TableCell>Durée</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Contrôle</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.data?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.workDate}</TableCell>
                  <TableCell>{entry.fullName || "Moi"}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {entry.taskTitle || entry.description}
                    </Typography>
                    {entry.taskTitle && (
                      <Typography variant="caption" color="text.secondary">
                        {entry.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{entry.durationHours} h</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={entry.source === "AUTOMATIQUE" ? "success" : "default"}
                      label={
                        entry.source === "AUTOMATIQUE"
                          ? "Activité Fiscora"
                          : "Manuel"
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {entry.requiresReview ? (
                      <Chip
                        size="small"
                        color="warning"
                        icon={<WarningAmberRounded />}
                        label={
                          anomalyLabels[entry.anomalyCode || ""] || "À vérifier"
                        }
                      />
                    ) : (
                      <Chip size="small" color="success" label="Cohérent" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={entry.status} />
                  </TableCell>
                  <TableCell>
                    {entry.status === "BROUILLON" && (
                      <Button
                        size="small"
                        startIcon={<SendRounded />}
                        disabled={!can("time_tracking.manage")}
                        onClick={() =>
                          action.mutate({ id: entry.id, type: "submit" })
                        }
                      >
                        Soumettre
                      </Button>
                    )}
                    {entry.status === "SOUMIS" &&
                      can("time_tracking.approve") && (
                        <>
                          <Button
                            size="small"
                            color="success"
                            startIcon={<CheckRounded />}
                            onClick={() =>
                              action.mutate({ id: entry.id, type: "approve" })
                            }
                          >
                            Approuver
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() =>
                              action.mutate({ id: entry.id, type: "reject" })
                            }
                          >
                            Rejeter
                          </Button>
                        </>
                      )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Saisir un temps exceptionnel</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
            Cette saisie sera identifiée comme manuelle et devra être validée par
            un responsable avant d’entrer dans la rentabilité.
          </Alert>
          <Stack spacing={2}>
            <TextField
              type="date"
              label="Date"
              value={manualForm.workDate}
              onChange={(event) =>
                setManualForm({ ...manualForm, workDate: event.target.value })
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              select
              label="Tâche liée"
              value={manualForm.taskId}
              onChange={(event) =>
                setManualForm({ ...manualForm, taskId: event.target.value })
              }
            >
              <MenuItem value="">Aucune</MenuItem>
              {tasks.data?.items.map((task) => (
                <MenuItem key={task.id} value={task.id}>
                  {task.title}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="number"
              label="Durée en minutes"
              value={manualForm.durationMinutes}
              onChange={(event) =>
                setManualForm({
                  ...manualForm,
                  durationMinutes: Number(event.target.value),
                })
              }
            />
            <TextField
              multiline
              minRows={3}
              label="Travail effectué et raison de la saisie manuelle"
              value={manualForm.description}
              onChange={(event) =>
                setManualForm({
                  ...manualForm,
                  description: event.target.value,
                })
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={manualForm.billable}
                  onChange={(event) =>
                    setManualForm({
                      ...manualForm,
                      billable: event.target.checked,
                    })
                  }
                />
              }
              label="Temps facturable au client"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!manualForm.description.trim() || createManual.isPending}
            onClick={() => createManual.mutate()}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
