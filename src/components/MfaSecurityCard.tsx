import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ContentCopyRounded,
  DownloadRounded,
  SecurityRounded,
} from "@mui/icons-material";
import { api, readSession, saveSession } from "../api/client";

interface MfaStatus {
  enabled: boolean;
  enabledAtUtc: string | null;
  recoveryCodesRemaining: number;
}

interface MfaSetup {
  secret: string;
  otpAuthUri: string;
  qrCodeDataUrl: string;
}

type ProtectedAction = "regenerate" | "disable";

function updateStoredMfaStatus(enabled: boolean) {
  const session = readSession();
  if (!session) return;
  saveSession({
    ...session,
    user: { ...session.user, mfaEnabled: enabled },
  });
}

export function MfaSecurityCard() {
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [action, setAction] = useState<ProtectedAction | null>(null);
  const [actionCode, setActionCode] = useState("");

  const status = useQuery({
    queryKey: ["mfa-status"],
    queryFn: () => api.get<MfaStatus>("/api/auth/mfa/status"),
  });
  const beginSetup = useMutation({
    mutationFn: () => api.post<MfaSetup>("/api/auth/mfa/setup"),
    onSuccess: (result) => {
      setSetup(result);
      setSetupCode("");
    },
  });
  const confirmSetup = useMutation({
    mutationFn: () =>
      api.post<{ message: string; recoveryCodes: string[] }>(
        "/api/auth/mfa/confirm",
        { code: setupCode },
      ),
    onSuccess: async (result) => {
      setSetup(null);
      setSetupCode("");
      setRecoveryCodes(result.recoveryCodes);
      updateStoredMfaStatus(true);
      await queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
    },
  });
  const protectedAction = useMutation({
    mutationFn: async () => {
      if (action === "regenerate") {
        return api.post<{ recoveryCodes: string[] }>(
          "/api/auth/mfa/recovery-codes",
          { code: actionCode },
        );
      }
      return api.post<{ message: string }>("/api/auth/mfa/disable", {
        code: actionCode,
      });
    },
    onSuccess: async (result) => {
      if ("recoveryCodes" in result) setRecoveryCodes(result.recoveryCodes);
      if (action === "disable") {
        saveSession(null);
        window.location.assign("/connexion");
        return;
      }
      setAction(null);
      setActionCode("");
      await queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
    },
  });

  const submitSetup = (event: FormEvent) => {
    event.preventDefault();
    if (setupCode.trim()) confirmSetup.mutate();
  };
  const submitAction = (event: FormEvent) => {
    event.preventDefault();
    if (actionCode.trim()) protectedAction.mutate();
  };
  const recoveryText = recoveryCodes.join("\n");

  return (
    <>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center", mb: 1.5 }}
          >
            <SecurityRounded color="primary" />
            <Typography variant="h4">Double authentification</Typography>
            {status.data && (
              <Chip
                size="small"
                color={status.data.enabled ? "success" : "default"}
                label={status.data.enabled ? "Activée" : "Désactivée"}
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Protégez votre compte avec Microsoft Authenticator, Google
            Authenticator, Authy ou toute autre application TOTP compatible.
          </Typography>
          {status.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {status.error.message}
            </Alert>
          )}
          {beginSetup.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {beginSetup.error.message}
            </Alert>
          )}
          {status.data?.enabled ? (
            <Stack spacing={1.5}>
              <Alert severity="success">
                La double authentification protège vos prochaines connexions.
                Il reste {status.data.recoveryCodesRemaining} code(s) de
                récupération.
              </Alert>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setAction("regenerate");
                    setActionCode("");
                  }}
                >
                  Renouveler les codes de récupération
                </Button>
                <Button
                  color="error"
                  onClick={() => {
                    setAction("disable");
                    setActionCode("");
                  }}
                >
                  Désactiver
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Alert severity="warning">
                Sans MFA, le mot de passe reste le seul contrôle protégeant le
                compte.
              </Alert>
              <Button
                variant="contained"
                disabled={beginSetup.isPending || status.isLoading}
                onClick={() => beginSetup.mutate()}
              >
                Activer la double authentification
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(setup)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={submitSetup}>
          <DialogTitle>Configurer l’application d’authentification</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ alignItems: "center" }}>
              <Typography color="text.secondary">
                Scannez ce QR code, puis saisissez le code à six chiffres
                affiché par l’application.
              </Typography>
              {setup && (
                <Box
                  component="img"
                  src={setup.qrCodeDataUrl}
                  alt="QR code de configuration MFA"
                  sx={{ width: 240, height: 240 }}
                />
              )}
              <TextField
                fullWidth
                label="Clé manuelle"
                value={setup?.secret ?? ""}
                slotProps={{ input: { readOnly: true } }}
              />
              <TextField
                fullWidth
                autoFocus
                label="Code à six chiffres"
                value={setupCode}
                onChange={(event) => setSetupCode(event.target.value)}
                autoComplete="one-time-code"
                slotProps={{
                  htmlInput: { inputMode: "numeric", maxLength: 6 },
                }}
              />
              {confirmSetup.isError && (
                <Alert severity="error" sx={{ width: "100%" }}>
                  {confirmSetup.error.message}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setSetup(null)}
              disabled={confirmSetup.isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!/^\d{6}$/.test(setupCode.trim()) || confirmSetup.isPending}
            >
              Confirmer l’activation
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={recoveryCodes.length > 0} fullWidth maxWidth="sm">
        <DialogTitle>Enregistrez vos codes de récupération</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Ces codes ne seront plus affichés. Chaque code ne fonctionne qu’une
            seule fois. Conservez-les dans un gestionnaire de mots de passe.
          </Alert>
          <Box
            component="pre"
            sx={{
              bgcolor: "grey.100",
              borderRadius: 2,
              p: 2,
              m: 0,
              columns: { sm: 2 },
              fontFamily: "monospace",
              lineHeight: 1.8,
            }}
          >
            {recoveryText}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<ContentCopyRounded />}
            onClick={() => void navigator.clipboard.writeText(recoveryText)}
          >
            Copier
          </Button>
          <Button
            startIcon={<DownloadRounded />}
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([recoveryText], { type: "text/plain;charset=utf-8" }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = "fiscora-codes-recuperation.txt";
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Télécharger
          </Button>
          <Button variant="contained" onClick={() => setRecoveryCodes([])}>
            J’ai enregistré les codes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(action)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={submitAction}>
          <DialogTitle>
            {action === "disable"
              ? "Désactiver la double authentification"
              : "Renouveler les codes de récupération"}
          </DialogTitle>
          <DialogContent dividers>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Confirmez cette action avec un code de votre application ou un
              code de récupération.
            </Typography>
            <TextField
              fullWidth
              autoFocus
              label="Code d’authentification"
              value={actionCode}
              onChange={(event) => setActionCode(event.target.value)}
              autoComplete="one-time-code"
            />
            {protectedAction.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {protectedAction.error.message}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setAction(null)}
              disabled={protectedAction.isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="contained"
              color={action === "disable" ? "error" : "primary"}
              disabled={!actionCode.trim() || protectedAction.isPending}
            >
              Confirmer
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
