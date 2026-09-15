import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import type { UnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";

export function UnsavedChangesDialog({
  guard,
}: {
  guard: UnsavedChangesGuard;
}) {
  return (
    <Dialog
      open={guard.confirmationOpen}
      onClose={guard.keepEditing}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Modifications non enregistrées</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mt: 1 }}>
          Les informations saisies seront perdues si vous quittez maintenant.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={guard.keepEditing}>Continuer la saisie</Button>
        <Button color="error" onClick={guard.discardChanges}>
          Quitter sans enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
