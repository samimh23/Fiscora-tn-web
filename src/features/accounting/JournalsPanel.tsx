import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  EditOutlined,
  MenuBookOutlined,
} from "@mui/icons-material";
import { api, ApiError } from "../../api/client";
import type { AccountingJournal } from "../../types/api";
import { journalTypeLabels } from "./options";
import { useFeedback } from "../../feedback/useFeedback";
import { UnsavedChangesDialog } from "../../components/UnsavedChangesDialog";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";

const defaultJournalForm = {
  code: "",
  name: "",
  type: "OPERATIONS_DIVERSES",
};

export function JournalsPanel({
  organizationId,
  dossierId,
  journals,
  archived,
  canManage,
}: {
  organizationId: string;
  dossierId: string;
  journals: AccountingJournal[];
  archived: boolean;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { showFeedback } = useFeedback();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("OPERATIONS_DIVERSES");
  const [initialForm, setInitialForm] = useState(defaultJournalForm);
  const [error, setError] = useState("");
  const closeEditor = () => {
    setOpen(false);
    setEditingId(null);
    setCode("");
    setName("");
    setType("OPERATIONS_DIVERSES");
    setError("");
  };
  const mutation = useMutation({
    mutationFn: () => {
      const path = `/api/organizations/${organizationId}/dossiers/${dossierId}/journals${editingId ? `/${editingId}` : ""}`;
      const payload = { code: code.trim(), name: name.trim(), type };
      return editingId
        ? api.put<AccountingJournal>(path, payload)
        : api.post<AccountingJournal>(path, payload);
    },
    onSuccess: async () => {
      const message = editingId
        ? "Le journal a été modifié."
        : "Le journal a été créé.";
      await queryClient.invalidateQueries({
        queryKey: ["journals", organizationId, dossierId],
      });
      closeEditor();
      showFeedback(message);
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : editingId
            ? "Impossible de modifier le journal."
            : "Impossible de créer le journal.",
      ),
  });
  const isDirty =
    open &&
    JSON.stringify({ code, name, type }) !== JSON.stringify(initialForm);
  const closeGuard = useUnsavedChangesGuard(
    isDirty && !mutation.isPending,
    closeEditor,
  );
  return (
    <>
      <Card>
        <Box
          sx={{
            p: 2.5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box>
            <Typography variant="h3">Paramétrage des journaux</Typography>
            <Typography variant="body2" color="text.secondary">
              Définissez les codes et les types de journaux utilisés lors de la
              saisie comptable. Les mouvements eux-mêmes se consultent dans
              l’onglet Journal comptable.
            </Typography>
          </Box>
          {canManage && !archived && (
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => {
                setError("");
                setEditingId(null);
                setCode("");
                setName("");
                setType("OPERATIONS_DIVERSES");
                setInitialForm(defaultJournalForm);
                setOpen(true);
              }}
            >
              Nouveau journal
            </Button>
          )}
        </Box>
        {journals.length === 0 && (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <MenuBookOutlined sx={{ fontSize: 44, color: "text.disabled" }} />
            <Typography sx={{ fontWeight: 700, mt: 1 }}>
              Aucun journal
            </Typography>
          </Box>
        )}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
          }}
        >
          {journals.map((journal) => (
            <Box
              key={journal.id}
              sx={{
                px: 3,
                py: 2.2,
                borderTop: "1px solid",
                borderRight: { md: "1px solid" },
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 3,
                  bgcolor: "primary.light",
                  color: "primary.main",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                }}
              >
                {journal.code.slice(0, 3)}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>{journal.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Code {journal.code}
                </Typography>
              </Box>
              <Chip
                label={journalTypeLabels[journal.type] ?? journal.type}
                size="small"
                variant="outlined"
              />
              {canManage && !archived && (
                <Button
                  size="small"
                  startIcon={<EditOutlined />}
                  onClick={() => {
                    setEditingId(journal.id);
                    setCode(journal.code);
                    setName(journal.name);
                    setType(journal.type);
                    setInitialForm({
                      code: journal.code,
                      name: journal.name,
                      type: journal.type,
                    });
                    setError("");
                    setOpen(true);
                  }}
                >
                  Modifier
                </Button>
              )}
            </Box>
          ))}
        </Box>
      </Card>
      <Dialog
        open={open}
        onClose={mutation.isPending ? undefined : closeGuard.requestClose}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {editingId ? "Modifier le journal" : "Créer un journal"}
        </DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              required
              sx={{ width: 130 }}
            />
            <TextField
              label="Nom"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              fullWidth
            />
          </Stack>
          <TextField
            select
            label="Type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {Object.entries(journalTypeLabels).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeGuard.requestClose}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!code.trim() || !name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {editingId ? "Enregistrer" : "Créer"}
          </Button>
        </DialogActions>
      </Dialog>
      <UnsavedChangesDialog guard={closeGuard} />
    </>
  );
}
