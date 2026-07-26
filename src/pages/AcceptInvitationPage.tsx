import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowForwardRounded, CheckCircleOutlineRounded } from "@mui/icons-material";
import { api, ApiError, saveSession } from "../api/client";
import { Brand } from "../components/Brand";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";
import type { AuthResponse } from "../types/api";

const schema = z.object({
  fullName: z.string().min(2, "Saisissez votre nom complet."),
  password: z.string().min(10, "Au moins 10 caractères.").regex(/[A-Z]/, "Ajoutez une majuscule.").regex(/[a-z]/, "Ajoutez une minuscule.").regex(/[0-9]/, "Ajoutez un chiffre."),
  confirmation: z.string(),
}).refine((values) => values.password === values.confirmation, {
  message: "Les mots de passe ne correspondent pas.",
  path: ["confirmation"],
});
type FormValues = z.infer<typeof schema>;

export function AcceptInvitationPage() {
  const { t } = useLanguage();
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", password: "", confirmation: "" },
  });
  const submit = handleSubmit(async (values) => {
    setApiError("");
    try {
      const session = await api.post<AuthResponse>("/api/auth/accept-invitation", {
        token,
        fullName: values.fullName,
        password: values.password,
      });
      saveSession(session);
      navigate("/", { replace: true });
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : t("Impossible d’accepter l’invitation."));
    }
  });

  return <Box sx={{ minHeight: "100vh", bgcolor: "#f6f3ea", display: "grid", placeItems: "center", p: 2, position: "relative" }}>
    <Box sx={{ position: "absolute", insetBlockStart: 24, insetInlineEnd: 24 }}><LanguageSwitcher /></Box>
    <Card sx={{ width: "min(620px, 100%)", overflow: "hidden" }}>
      <Box sx={{ bgcolor: "#103a2f", color: "white", p: 3 }}><Brand dark /></Box>
      <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
        <Typography variant="overline" color="secondary.main" sx={{ fontWeight: 800, letterSpacing: ".14em" }}>{t("Invitation sécurisée")}</Typography>
        <Typography variant="h2" sx={{ fontSize: { xs: 34, sm: 46 }, mt: 1 }}>{t("Créez votre accès")}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{t("Choisissez vous-même votre mot de passe. L’administrateur du cabinet ne pourra jamais le voir.")}</Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 3 }}><CheckCircleOutlineRounded color="success" /><Typography variant="body2">{t("Lien personnel, temporaire et utilisable une seule fois")}</Typography></Stack>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
        {!token && <Alert severity="error" sx={{ mb: 2 }}>{t("Le lien d’invitation est incomplet.")}</Alert>}
        <Box component="form" onSubmit={submit} noValidate>
          <Stack spacing={2}>
            <TextField label={t("Nom complet")} autoComplete="name" error={Boolean(errors.fullName)} helperText={errors.fullName?.message} {...register("fullName")} />
            <TextField label={t("Mot de passe")} type="password" autoComplete="new-password" error={Boolean(errors.password)} helperText={errors.password?.message ?? t("10 caractères minimum avec majuscule, minuscule et chiffre.")} {...register("password")} />
            <TextField label={t("Confirmer le mot de passe")} type="password" autoComplete="new-password" error={Boolean(errors.confirmation)} helperText={errors.confirmation?.message} {...register("confirmation")} />
            <Button type="submit" variant="contained" size="large" disabled={!token || isSubmitting} endIcon={<ArrowForwardRounded />}>{isSubmitting ? t("Activation…") : t("Accepter et rejoindre le cabinet")}</Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  </Box>;
}
