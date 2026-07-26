import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Skeleton, Stack, Typography } from "@mui/material";
import { DoneAllRounded, NotificationsNoneOutlined } from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/PageHeader";
import type { NotificationItem } from "../types/api";

export function ClientPortalNotificationsPage() {
  const { organization } = useAuth();
  const qc = useQueryClient();
  const id = organization?.id ?? "";
  const query = useQuery({ queryKey: ["client-notifications", id], queryFn: () => api.get<NotificationItem[]>(`/api/organizations/${id}/notifications`), enabled: Boolean(id) });
  const mark = useMutation({ mutationFn: (notificationId: string) => api.patch(`/api/organizations/${id}/notifications/${notificationId}/read`), onSuccess: () => void qc.invalidateQueries({ queryKey: ["client-notifications"] }) });
  const all = useMutation({ mutationFn: () => api.patch(`/api/organizations/${id}/notifications/read-all`), onSuccess: () => void qc.invalidateQueries({ queryKey: ["client-notifications"] }) });
  return <><PageHeader eyebrow="Suivi" title="Notifications" description="Messages du cabinet, échéances et mises à jour importantes." action={<Button startIcon={<DoneAllRounded />} onClick={() => all.mutate()} disabled={!query.data?.some((x) => !x.readAtUtc)}>Tout marquer comme lu</Button>} />
    {query.isError && <Alert severity="error">Impossible de charger les notifications.</Alert>}
    <Card><CardContent sx={{ p: 0 }}>{query.isLoading && <Stack sx={{ p: 3 }}><Skeleton height={90} /><Skeleton height={90} /></Stack>}{!query.isLoading && !query.data?.length && <Box sx={{ p: 7, textAlign: "center" }}><NotificationsNoneOutlined sx={{ fontSize: 50, color: "text.disabled" }} /><Typography variant="h5" sx={{ mt: 2 }}>Aucune notification</Typography></Box>}{query.data?.map((item, index) => <Box key={item.id}>{index > 0 && <Divider />}<Box sx={{ p: 3, display: "flex", gap: 2, bgcolor: item.readAtUtc ? "transparent" : "#fff9ec" }}><Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: item.readAtUtc ? "grey.300" : "secondary.main", mt: 1 }} /><Box sx={{ flex: 1 }}><Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Typography sx={{ fontWeight: 800 }}>{item.title}</Typography>{!item.readAtUtc && <Chip label="Nouveau" size="small" color="secondary" />}</Stack><Typography color="text.secondary" sx={{ mt: .5 }}>{item.message}</Typography><Typography variant="caption" color="text.disabled">{new Intl.DateTimeFormat("fr-TN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAtUtc))}</Typography></Box>{!item.readAtUtc && <Button size="small" onClick={() => mark.mutate(item.id)}>Marquer comme lu</Button>}</Box></Box>)}</CardContent></Card>
  </>;
}
