import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert, Box, Button, Card, CardContent, Divider, FormControlLabel, Stack,
  Switch, TextField, Typography,
} from "@mui/material";
import { LockOutlined, NotificationsOutlined, PersonOutlined } from "@mui/icons-material";
import { api, readSession, saveSession } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface Preferences {
  emailMessages: boolean;
  emailDeadlines: boolean;
  emailDocuments: boolean;
  weeklySummary: boolean;
  preferredLanguage: "fr" | "ar";
}

export function ClientPortalSettingsPage() {
  const { session } = useAuth();
  const [fullName, setFullName] = useState(session?.user.fullName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const preferences = useQuery({
    queryKey: ["client-portal-preferences"],
    queryFn: () => api.get<Preferences>("/api/client-portal/preferences"),
  });
  const [prefs, setPrefs] = useState<Preferences>({
    emailMessages: true, emailDeadlines: true, emailDocuments: true,
    weeklySummary: true, preferredLanguage: "fr",
  });
  useEffect(() => { if (preferences.data) setPrefs(preferences.data); }, [preferences.data]);

  const profile = useMutation({
    mutationFn: () => api.put<{ id: string; email: string; fullName: string }>("/api/auth/profile", { fullName }),
    onSuccess: (me) => {
      const current = readSession();
      if (current) saveSession({ ...current, user: { ...current.user, fullName: me.fullName } });
    },
  });
  const password = useMutation({
    mutationFn: () => api.post<{ message: string }>("/api/auth/change-password", { currentPassword, newPassword }),
    onSuccess: () => { setCurrentPassword(""); setNewPassword(""); },
  });
  const savePreferences = useMutation({
    mutationFn: () => api.put<Preferences>("/api/client-portal/preferences", prefs),
  });
  const toggle = (field: keyof Preferences) => (_: unknown, checked: boolean) =>
    setPrefs((current) => ({ ...current, [field]: checked }));

  return <>
    <Typography variant="overline" color="primary" sx={{ fontWeight: 900 }}>Mon compte</Typography>
    <Typography variant="h2" sx={{ fontSize: { xs: 38, md: 52 } }}>Profil, sécurité et notifications</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>Gérez vos informations personnelles et la façon dont le cabinet vous informe.</Typography>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2.5 }}>
      <Stack spacing={2.5}>
        <Card><CardContent sx={{ p: 3 }}><Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}><PersonOutlined color="primary" /><Typography variant="h4">Identité</Typography></Stack><Stack spacing={2}><TextField label="Nom complet" value={fullName} onChange={(event) => setFullName(event.target.value)} /><TextField label="Adresse e-mail" value={session?.user.email ?? ""} disabled helperText="L’adresse e-mail d’accès est protégée. Contactez le cabinet pour la modifier." />{profile.isSuccess && <Alert severity="success">Votre profil a été enregistré.</Alert>}{profile.isError && <Alert severity="error">{profile.error.message}</Alert>}<Button variant="contained" disabled={!fullName.trim() || profile.isPending} onClick={() => profile.mutate()}>Enregistrer le profil</Button></Stack></CardContent></Card>
        <Card><CardContent sx={{ p: 3 }}><Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}><LockOutlined color="primary" /><Typography variant="h4">Mot de passe</Typography></Stack><Stack spacing={2}><Alert severity="info">Après la modification, toutes les sessions — y compris celle-ci — devront se reconnecter à l’expiration de leur jeton d’accès.</Alert><TextField type="password" label="Mot de passe actuel" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /><TextField type="password" label="Nouveau mot de passe" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} helperText="10 caractères minimum, avec majuscule, minuscule et chiffre." />{password.isSuccess && <Alert severity="success">{password.data.message}</Alert>}{password.isError && <Alert severity="error">{password.error.message}</Alert>}<Button variant="contained" disabled={!currentPassword || !newPassword || password.isPending} onClick={() => password.mutate()}>Changer le mot de passe</Button></Stack></CardContent></Card>
      </Stack>
      <Card><CardContent sx={{ p: 3 }}><Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}><NotificationsOutlined color="primary" /><Typography variant="h4">Notifications</Typography></Stack><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Ces préférences préparent les envois automatiques par e-mail. Les notifications importantes restent visibles dans Fiscora.</Typography><Divider sx={{ mb: 1 }} />
        <FormControlLabel control={<Switch checked={prefs.emailMessages} onChange={toggle("emailMessages")} />} label="Nouveaux messages du cabinet" />
        <FormControlLabel control={<Switch checked={prefs.emailDeadlines} onChange={toggle("emailDeadlines")} />} label="Rappels d’échéances fiscales et sociales" />
        <FormControlLabel control={<Switch checked={prefs.emailDocuments} onChange={toggle("emailDocuments")} />} label="Documents demandés ou ajoutés" />
        <FormControlLabel control={<Switch checked={prefs.weeklySummary} onChange={toggle("weeklySummary")} />} label="Résumé hebdomadaire de mes dossiers" />
        {savePreferences.isSuccess && <Alert severity="success" sx={{ mt: 2 }}>Préférences enregistrées.</Alert>}
        {savePreferences.isError && <Alert severity="error" sx={{ mt: 2 }}>{savePreferences.error.message}</Alert>}
        <Button fullWidth variant="contained" sx={{ mt: 2 }} disabled={savePreferences.isPending} onClick={() => savePreferences.mutate()}>Enregistrer les préférences</Button>
        <Alert severity="warning" sx={{ mt: 3 }}>La double authentification n’est pas encore activée. Elle sera ajoutée avec un fournisseur d’identité sécurisé avant la mise en production.</Alert>
      </CardContent></Card>
    </Box>
  </>;
}
