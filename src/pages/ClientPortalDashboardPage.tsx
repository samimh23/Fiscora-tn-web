import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider, Skeleton, Stack, Typography,
} from "@mui/material";
import {
  ArrowForwardRounded, BusinessOutlined, CalendarMonthOutlined, DescriptionOutlined,
  ForumOutlined, NotificationsOutlined, UploadFileOutlined,
} from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/PageHeader";
import type { DossierSummary, NotificationItem, PagedResponse } from "../types/api";

export function ClientPortalDashboardPage() {
  const { session, organization } = useAuth();
  const organizationId = organization?.id ?? "";
  const dossiers = useQuery({
    queryKey: ["client-portal-dossiers", organizationId],
    queryFn: () => api.get<PagedResponse<DossierSummary>>(`/api/organizations/${organizationId}/dossiers?page=1&pageSize=50`),
    enabled: Boolean(organizationId),
  });
  const notifications = useQuery({
    queryKey: ["client-portal-notifications", organizationId],
    queryFn: () => api.get<NotificationItem[]>(`/api/organizations/${organizationId}/notifications?unreadOnly=true`),
    enabled: Boolean(organizationId),
  });
  const firstName = session?.user.fullName.split(" ")[0] ?? "";
  return <>
    <PageHeader eyebrow="Espace client sécurisé" title={`Bonjour ${firstName}`} description={`Suivez vos dossiers, transmettez vos pièces et échangez avec ${organization?.name ?? "votre cabinet"}.`} />
    {(dossiers.isError || notifications.isError) && <Alert severity="error" sx={{ mb: 3 }}>Le portail ne peut pas charger toutes vos informations pour le moment.</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2.5, mb: 3 }}>
      <Card><CardContent sx={{ p: 3 }}><BusinessOutlined color="primary" /><Typography variant="h3" sx={{ fontSize: 34, mt: 2 }}>{dossiers.data?.total ?? 0}</Typography><Typography sx={{ fontWeight: 800 }}>Dossier{(dossiers.data?.total ?? 0) > 1 ? "s" : ""} accessible{(dossiers.data?.total ?? 0) > 1 ? "s" : ""}</Typography><Typography variant="body2" color="text.secondary">Uniquement les sociétés qui vous sont attribuées.</Typography></CardContent></Card>
      <Card><CardContent sx={{ p: 3 }}><NotificationsOutlined sx={{ color: "#c47a24" }} /><Typography variant="h3" sx={{ fontSize: 34, mt: 2 }}>{notifications.data?.length ?? 0}</Typography><Typography sx={{ fontWeight: 800 }}>Notification{(notifications.data?.length ?? 0) > 1 ? "s" : ""} non lue{(notifications.data?.length ?? 0) > 1 ? "s" : ""}</Typography><Button component={RouterLink} to="/portail/notifications" size="small" sx={{ mt: 1 }}>Tout consulter</Button></CardContent></Card>
      <Card sx={{ bgcolor: "#153f34", color: "white" }}><CardContent sx={{ p: 3 }}><ForumOutlined sx={{ color: "#f2c56b" }} /><Typography variant="h4" sx={{ mt: 2, fontSize: 24 }}>Besoin d’aide ?</Typography><Typography variant="body2" sx={{ color: "rgba(255,255,255,.72)", mt: 1 }}>Ouvrez un dossier pour écrire directement à votre équipe comptable.</Typography></CardContent></Card>
    </Box>

    <Card><CardContent sx={{ p: 0 }}><Box sx={{ px: 3, py: 2.5 }}><Typography variant="h3" sx={{ fontSize: 26 }}>Mes entreprises</Typography><Typography variant="body2" color="text.secondary">Accès strictement limité aux dossiers autorisés par votre cabinet.</Typography></Box><Divider />
      {dossiers.isLoading && <Stack sx={{ p: 3 }} spacing={2}><Skeleton height={90} /><Skeleton height={90} /></Stack>}
      {!dossiers.isLoading && !dossiers.data?.items.length && <Box sx={{ p: 6, textAlign: "center" }}><BusinessOutlined sx={{ fontSize: 46, color: "text.disabled" }} /><Typography variant="h5" sx={{ mt: 2 }}>Aucun dossier attribué</Typography><Typography color="text.secondary">Demandez au cabinet de vous affecter à votre dossier client.</Typography></Box>}
      {dossiers.data?.items.map((dossier, index) => <Box key={dossier.id}>{index > 0 && <Divider />}<Box sx={{ p: 3, display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2, alignItems: { md: "center" } }}><Box sx={{ width: 52, height: 52, borderRadius: 3, bgcolor: "#e4efe9", color: "primary.main", display: "grid", placeItems: "center", flexShrink: 0 }}><BusinessOutlined /></Box><Box sx={{ flex: 1 }}><Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography variant="h5">{dossier.legalName}</Typography><Chip size="small" label={dossier.status === "ACTIF" ? "Actif" : dossier.status} color="success" variant="outlined" /></Stack><Typography variant="body2" color="text.secondary">{dossier.tradeName || dossier.activitySector || "Dossier société"}{dossier.taxIdentifier ? ` · MF ${dossier.taxIdentifier}` : ""}</Typography><Stack direction="row" spacing={2} sx={{ mt: 1.5, color: "text.secondary" }}><Typography variant="caption"><DescriptionOutlined sx={{ fontSize: 15, verticalAlign: "middle", mr: .5 }} />Documents</Typography><Typography variant="caption"><CalendarMonthOutlined sx={{ fontSize: 15, verticalAlign: "middle", mr: .5 }} />Échéances</Typography><Typography variant="caption"><UploadFileOutlined sx={{ fontSize: 15, verticalAlign: "middle", mr: .5 }} />Dépôt sécurisé</Typography></Stack></Box><Button component={RouterLink} to={`/portail/dossiers/${dossier.id}`} variant="contained" endIcon={<ArrowForwardRounded />}>Ouvrir mon espace</Button></Box></Box>)}
    </CardContent></Card>
  </>;
}
