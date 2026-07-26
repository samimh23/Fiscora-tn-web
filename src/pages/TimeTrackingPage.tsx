import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
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
} from "@mui/material";
import { AddRounded, CheckRounded, SendRounded } from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DossierSelector, QueryState } from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";
interface TimeEntry {
  id: string;
  fullName: string | null;
  workDate: string;
  durationMinutes: number;
  durationHours: string;
  billable: boolean;
  description: string;
  status: string;
  reviewComment: string | null;
}
export function TimeTrackingPage() {
  const { organization, can } = useAuth();
  const qc = useQueryClient();
  const [dossierId, setDossierId] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    workDate: today,
    durationMinutes: 60,
    billable: true,
    description: "",
  });
  const base =
    organization?.id && dossierId
      ? `/api/organizations/${organization.id}/dossiers/${dossierId}/time-entries`
      : "";
  const query = useQuery({
    queryKey: ["time-entries", organization?.id, dossierId, status],
    queryFn: () =>
      api.get<TimeEntry[]>(`${base}${status ? `?status=${status}` : ""}`),
    enabled: Boolean(base),
  });
  const refresh = () =>
    void qc.invalidateQueries({ queryKey: ["time-entries"] });
  const create = useMutation({
    mutationFn: () => api.post(base, form),
    onSuccess: () => {
      setOpen(false);
      setForm({ ...form, description: "" });
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
  const error = create.error ?? action.error;
  return (
    <>
      <PageHeader
        eyebrow="Production"
        title="Temps de travail"
        description="Saisissez le temps passé par dossier, soumettez-le au responsable et validez les heures utiles à la rentabilité."
        action={
          <Stack direction="row" spacing={1}>
            <DossierSelector value={dossierId} onChange={setDossierId} />
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              disabled={!base || !can("time_tracking.manage")}
              onClick={() => setOpen(true)}
            >
              Saisir du temps
            </Button>
          </Stack>
        }
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : "Erreur"}
        </Alert>
      )}
      <Card>
        <CardContent>
          <Stack direction="row" sx={{ mb: 2, justifyContent: "flex-end" }}>
            <TextField
              select
              size="small"
              label="Statut"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Tous</MenuItem>
              {["BROUILLON", "SOUMIS", "APPROUVE", "REJETE"].map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <QueryState
            loading={query.isLoading}
            error={query.isError}
            empty={!query.data?.length}
          />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Collaborateur</TableCell>
                <TableCell>Travail effectué</TableCell>
                <TableCell>Durée</TableCell>
                <TableCell>Facturable</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {query.data?.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.workDate}</TableCell>
                  <TableCell>{e.fullName || "Moi"}</TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell>{e.durationHours} h</TableCell>
                  <TableCell>{e.billable ? "Oui" : "Non"}</TableCell>
                  <TableCell>
                    <Chip size="small" label={e.status} />
                  </TableCell>
                  <TableCell>
                    {e.status === "BROUILLON" && (
                      <Button
                        size="small"
                        startIcon={<SendRounded />}
                        disabled={!can("time_tracking.manage")}
                        onClick={() =>
                          action.mutate({ id: e.id, type: "submit" })
                        }
                      >
                        Soumettre
                      </Button>
                    )}
                    {e.status === "SOUMIS" && can("time_tracking.approve") && (
                      <>
                        <Button
                          size="small"
                          color="success"
                          startIcon={<CheckRounded />}
                          onClick={() =>
                            action.mutate({ id: e.id, type: "approve" })
                          }
                        >
                          Approuver
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() =>
                            action.mutate({ id: e.id, type: "reject" })
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
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Saisir du temps</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              type="date"
              label="Date"
              value={form.workDate}
              onChange={(e) => setForm({ ...form, workDate: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              type="number"
              label="Durée en minutes"
              value={form.durationMinutes}
              onChange={(e) =>
                setForm({ ...form, durationMinutes: Number(e.target.value) })
              }
            />
            <TextField
              multiline
              minRows={3}
              label="Travail effectué"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.billable}
                  onChange={(e) =>
                    setForm({ ...form, billable: e.target.checked })
                  }
                />
              }
              label="Temps facturable au client"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!form.description || create.isPending}
            onClick={() => create.mutate()}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
