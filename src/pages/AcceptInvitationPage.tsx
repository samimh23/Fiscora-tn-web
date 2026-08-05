import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowForwardRounded,
  CheckCircleOutlineRounded,
  LockOutlined,
  MailOutlineRounded,
} from "@mui/icons-material";
import { api, ApiError, saveSession } from "../api/client";
import { Brand } from "../components/Brand";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";
import type { AuthResponse, InvitationPreview } from "../types/api";

const schema = z
  .object({
    fullName: z.string().trim().optional(),
    password: z
      .string()
      .min(10, "Au moins 10 caractères.")
      .regex(/[A-Z]/, "Ajoutez une majuscule.")
      .regex(/[a-z]/, "Ajoutez une minuscule.")
      .regex(/[0-9]/, "Ajoutez un chiffre."),
    confirmation: z.string().optional(),
  });

type FormValues = z.infer<typeof schema>;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-TN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AcceptInvitationPage() {
  const { t } = useLanguage();
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", password: "", confirmation: "" },
  });

  const invitation = useQuery({
    queryKey: ["invitation-preview", token],
    enabled: Boolean(token),
    retry: false,
    queryFn: () =>
      api.get<InvitationPreview>(
        `/api/auth/invitations/${encodeURIComponent(token)}`,
      ),
  });

  const preview = invitation.data;
  const isExistingAccount = Boolean(preview?.accountExists);
  const title = isExistingAccount
    ? "Connectez-vous pour rejoindre le cabinet"
    : "Créez votre accès";
  const description = isExistingAccount
    ? "Cette adresse possède déjà un compte Fiscora. Entrez son mot de passe pour accepter l’invitation."
    : "Choisissez vous-même votre mot de passe. L’administrateur du cabinet ne pourra jamais le voir.";

  const submit = handleSubmit(async (values) => {
    setApiError("");
    if (!token || !preview) return;
    if (!isExistingAccount && (values.fullName?.trim().length ?? 0) < 2) {
      setError("fullName", { message: "Saisissez votre nom complet." });
      return;
    }
    if (!isExistingAccount && values.password !== values.confirmation) {
      setError("confirmation", {
        message: "Les mots de passe ne correspondent pas.",
      });
      return;
    }

    try {
      const session = await api.post<AuthResponse>("/api/auth/accept-invitation", {
        token,
        fullName: isExistingAccount
          ? preview.existingFullName ?? preview.email
          : values.fullName?.trim(),
        password: values.password,
      });
      saveSession(session);
      navigate("/", { replace: true });
    } catch (error) {
      setApiError(
        error instanceof ApiError
          ? error.message
          : t("Impossible d’accepter l’invitation."),
      );
    }
  });

  const previewError = useMemo(() => {
    if (!invitation.error) return "";
    return invitation.error instanceof ApiError
      ? invitation.error.message
      : "Impossible de charger l’invitation.";
  }, [invitation.error]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f6f3ea",
        display: "grid",
        placeItems: "center",
        p: 2,
        position: "relative",
      }}
    >
      <Box sx={{ position: "absolute", insetBlockStart: 24, insetInlineEnd: 24 }}>
        <LanguageSwitcher />
      </Box>
      <Card sx={{ width: "min(680px, 100%)", overflow: "hidden" }}>
        <Box sx={{ bgcolor: "#103a2f", color: "white", p: 3 }}>
          <Brand dark />
        </Box>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Typography
            variant="overline"
            color="secondary.main"
            sx={{ fontWeight: 800, letterSpacing: ".14em" }}
          >
            {t("Invitation sécurisée")}
          </Typography>
          <Typography variant="h2" sx={{ fontSize: { xs: 34, sm: 46 }, mt: 1 }}>
            {t(title)}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            {t(description)}
          </Typography>

          {!token && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {t("Le lien d’invitation est incomplet.")}
            </Alert>
          )}
          {invitation.isLoading && (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 3 }}>
              <CircularProgress size={20} />
              <Typography>{t("Vérification de l’invitation…")}</Typography>
            </Stack>
          )}
          {previewError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {previewError}
            </Alert>
          )}
          {apiError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {apiError}
            </Alert>
          )}

          {preview && (
            <Stack spacing={3}>
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 3,
                  p: 2.5,
                  bgcolor: "rgba(255,255,255,.62)",
                }}
              >
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <MailOutlineRounded color="primary" />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t("Adresse invitée")}
                      </Typography>
                      <Typography sx={{ fontWeight: 800 }}>{preview.email}</Typography>
                    </Box>
                  </Stack>
                  <Divider />
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{ justifyContent: "space-between" }}
                  >
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t("Cabinet")}
                      </Typography>
                      <Typography sx={{ fontWeight: 800 }}>{preview.organizationName}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t("Rôle")}
                      </Typography>
                      <Typography sx={{ fontWeight: 800 }}>{preview.roleName}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t("Expire le")}
                      </Typography>
                      <Typography sx={{ fontWeight: 800 }}>{formatDate(preview.expiresAtUtc)}</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    <Chip
                      icon={<LockOutlined />}
                      color={isExistingAccount ? "info" : "success"}
                      label={
                        isExistingAccount
                          ? t("Compte Fiscora existant")
                          : t("Nouveau compte Fiscora")
                      }
                    />
                    <Chip
                      icon={<CheckCircleOutlineRounded />}
                      variant="outlined"
                      label={t("Lien personnel et utilisable une seule fois")}
                    />
                  </Stack>
                </Stack>
              </Box>

              <Box component="form" onSubmit={submit} noValidate>
                <Stack spacing={2}>
                  {!isExistingAccount && (
                    <TextField
                      label={t("Nom complet")}
                      autoComplete="name"
                      error={Boolean(errors.fullName)}
                      helperText={errors.fullName?.message}
                      {...register("fullName")}
                    />
                  )}
                  {isExistingAccount && preview.existingFullName && (
                    <Alert severity="info">
                      {t("Vous continuerez avec le compte existant")}{" "}
                      <strong>{preview.existingFullName}</strong>.
                    </Alert>
                  )}
                  <TextField
                    label={
                      isExistingAccount
                        ? t("Mot de passe du compte existant")
                        : t("Mot de passe")
                    }
                    type="password"
                    autoComplete={isExistingAccount ? "current-password" : "new-password"}
                    error={Boolean(errors.password)}
                    helperText={
                      errors.password?.message ??
                      t("10 caractères minimum avec majuscule, minuscule et chiffre.")
                    }
                    {...register("password")}
                  />
                  {!isExistingAccount && (
                    <TextField
                      label={t("Confirmer le mot de passe")}
                      type="password"
                      autoComplete="new-password"
                      error={Boolean(errors.confirmation)}
                      helperText={errors.confirmation?.message}
                      {...register("confirmation")}
                    />
                  )}
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={!token || !preview || isSubmitting}
                    endIcon={<ArrowForwardRounded />}
                  >
                    {isSubmitting
                      ? t("Activation…")
                      : isExistingAccount
                        ? t("Accepter avec mon compte existant")
                        : t("Créer mon compte et rejoindre le cabinet")}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
