import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Chip, InputAdornment, Stack,
  TextField, Typography,
} from "@mui/material";
import {
  ArrowForwardRounded, BusinessOutlined, SearchRounded,
} from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { DossierSummary, PagedResponse } from "../types/api";

export function ClientPortalDossiersPage() {
  const { organization } = useAuth();
  const organizationId = organization?.id ?? "";
  const [search, setSearch] = useState("");
  const dossiers = useQuery({
    queryKey: ["client-portal-dossiers", organizationId],
    queryFn: () => api.get<PagedResponse<DossierSummary>>(
      `/api/organizations/${organizationId}/dossiers?page=1&pageSize=100`,
    ),
    enabled: Boolean(organizationId),
  });
  const visible = useMemo(() => {
    const value = search.trim().toLocaleLowerCase("fr");
    return (dossiers.data?.items ?? []).filter((item) =>
      !value || [item.legalName, item.tradeName, item.taxIdentifier, item.activitySector]
        .some((field) => field?.toLocaleLowerCase("fr").includes(value)),
    );
  }, [dossiers.data?.items, search]);

  return <>
    <Typography variant="overline" color="primary" sx={{ fontWeight: 900 }}>Mes sociétés</Typography>
    <Typography variant="h2" sx={{ fontSize: { xs: 38, md: 52 } }}>Dossiers partagés avec moi</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>Vous ne voyez que les entreprises auxquelles votre cabinet vous a explicitement donné accès.</Typography>
    <TextField
      fullWidth value={search} onChange={(event) => setSearch(event.target.value)}
      placeholder="Rechercher par nom, matricule fiscal ou activité"
      slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }}
      sx={{ maxWidth: 680, mb: 3 }}
    />
    {dossiers.isError && <Alert severity="error">Impossible de charger vos dossiers.</Alert>}
    {!dossiers.isLoading && !visible.length &&
      <Card><CardContent sx={{ p: 6, textAlign: "center" }}><BusinessOutlined sx={{ fontSize: 48, color: "text.disabled" }} /><Typography variant="h4" sx={{ mt: 2 }}>Aucun dossier trouvé</Typography><Typography color="text.secondary">Votre cabinet peut vous attribuer une société depuis son espace équipe.</Typography></CardContent></Card>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,1fr)" }, gap: 2.5 }}>
      {visible.map((dossier) =>
        <Card key={dossier.id}><CardContent sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
            <Box sx={{ width: 52, height: 52, borderRadius: 3, bgcolor: "#e5efe9", color: "primary.main", display: "grid", placeItems: "center" }}><BusinessOutlined /></Box>
            <Box sx={{ flex: 1 }}><Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography variant="h4" sx={{ fontSize: 23 }}>{dossier.legalName}</Typography><Chip size="small" label={dossier.status === "ACTIF" ? "Actif" : dossier.status} color="success" variant="outlined" /></Stack><Typography variant="body2" color="text.secondary">{dossier.tradeName || dossier.activitySector || "Entreprise"}{dossier.taxIdentifier ? ` · MF ${dossier.taxIdentifier}` : ""}</Typography></Box>
          </Stack>
          <Button fullWidth component={RouterLink} to={`/portail/dossiers/${dossier.id}`} variant="contained" endIcon={<ArrowForwardRounded />} sx={{ mt: 3 }}>Ouvrir l’espace</Button>
        </CardContent></Card>,
      )}
    </Box>
  </>;
}
