import { useState } from "react";
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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { MailOutlineRounded, SendRounded } from "@mui/icons-material";
import { ApiError, api, readSession } from "../../api/client";
import type { PlatformEmailLog, PlatformEmailStatus } from "../../types/api";

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-TN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Jamais";

const categoryLabel: Record<PlatformEmailLog["category"], string> = {
  INVITATION: "Invitation",
  ADMIN_TEST: "Test admin",
  SYSTEM: "Système",
};

export function PlatformEmailPanel() {
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState(readSession()?.user.email ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["platform-admin", "email-status"],
    queryFn: () =>
      api.get<PlatformEmailStatus>("/api/platform-admin/email/status"),
  });

  const logs = useQuery({
    queryKey: ["platform-admin", "email-logs"],
    queryFn: () =>
      api.get<PlatformEmailLog[]>("/api/platform-admin/email/logs"),
  });

  const testEmail = useMutation({
    mutationFn: () =>
      api.post<PlatformEmailLog>("/api/platform-admin/email/test", {
        recipient: recipient.trim(),
      }),
    onSuccess: async () => {
      setFeedback(`E-mail de test envoyé à ${recipient.trim()}.`);
      await queryClient.invalidateQueries({ queryKey: ["platform-admin"] });
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError
          ? error.message
          : "Impossible d’envoyer l’e-mail de test.",
      );
    },
  });

  const sendDisabled =
    !recipient.trim() || testEmail.isPending || status.data?.configured === false;

  return (
    <Box sx={{ p: 3 }}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
              <MailOutlineRounded sx={{ color: "#145a46" }} />
              <Typography variant="h3" sx={{ fontSize: 24 }}>
                E-mails transactionnels
              </Typography>
              {status.isLoading ? (
                <CircularProgress size={18} />
              ) : (
                <Chip
                  size="small"
                  label={status.data?.configured ? "Configuré" : "Non configuré"}
                  color={status.data?.configured ? "success" : "warning"}
                  variant="outlined"
                />
              )}
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Suivi des invitations, tests SMTP et erreurs de livraison.
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Fournisseur
                </Typography>
                <Typography sx={{ fontWeight: 800 }}>
                  {status.data?.provider ?? "—"}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Expéditeur
                </Typography>
                <Typography sx={{ fontWeight: 800 }}>
                  {status.data?.from ?? "—"}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Envoyés / 24h
                </Typography>
                <Typography sx={{ fontWeight: 800 }}>
                  {status.data?.sentLast24h ?? 0}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Échecs / 24h
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 800,
                    color:
                      (status.data?.failedLast24h ?? 0) > 0
                        ? "error.main"
                        : "text.primary",
                  }}
                >
                  {status.data?.failedLast24h ?? 0}
                </Typography>
              </Box>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
              Hôte SMTP : {status.data?.host ?? "—"} · port{" "}
              {status.data?.port ?? "—"} · dernier succès :{" "}
              {formatDate(status.data?.lastSuccessAtUtc ?? null)}
            </Typography>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ width: { xs: "100%", lg: 390 } }}>
          <CardContent>
            <Typography variant="h4" sx={{ mb: 1 }}>
              Envoyer un test
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Utilise la configuration SMTP actuelle. Le mot de passe Brevo
              reste côté serveur.
            </Typography>
            <Stack spacing={1.2}>
              <TextField
                label="Adresse e-mail de test"
                type="email"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                size="small"
                fullWidth
              />
              <Button
                variant="contained"
                startIcon={<SendRounded />}
                disabled={sendDisabled}
                onClick={() => testEmail.mutate()}
              >
                {testEmail.isPending ? "Envoi…" : "Envoyer le test"}
              </Button>
            </Stack>
            {feedback && (
              <Alert
                severity={feedback.includes("échoué") ? "error" : "success"}
                sx={{ mt: 2 }}
              >
                {feedback}
              </Alert>
            )}
          </CardContent>
        </Card>
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            sx={{ justifyContent: "space-between", mb: 2 }}
          >
            <Box>
              <Typography variant="h3" sx={{ fontSize: 24 }}>
                Journal des e-mails
              </Typography>
              <Typography color="text.secondary">
                Les 100 derniers envois transactionnels.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={() => {
                void status.refetch();
                void logs.refetch();
              }}
            >
              Actualiser
            </Button>
          </Stack>
          {logs.isLoading ? (
            <CircularProgress size={28} />
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Destinataire</TableCell>
                    <TableCell>Cabinet / acteur</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell>Détail</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.data?.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{formatDate(item.createdAtUtc)}</TableCell>
                      <TableCell>{categoryLabel[item.category]}</TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 750 }}>
                          {item.recipient}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.subject}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {item.organizationName ?? "Plateforme"}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block" }}
                        >
                          {item.actorName ?? "Système"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.status === "ENVOYE" ? "Envoyé" : "Échec"}
                          color={item.status === "ENVOYE" ? "success" : "error"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {item.status === "ENVOYE"
                            ? item.providerMessageId || item.smtpResponse || "Accepté par le SMTP"
                            : item.errorMessage || "Erreur non détaillée"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!logs.data?.length && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        Aucun e-mail journalisé pour le moment.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
