import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider, LinearProgress,
  Skeleton, Stack, Typography,
} from '@mui/material';
import {
  ArrowForwardRounded, FolderOutlined, NotificationsOutlined, PaidOutlined,
  QueryStatsOutlined, TaskAltOutlined,
} from '@mui/icons-material';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import type { BillingSummary, DossierSummary, NotificationItem, PagedResponse, ProfitabilitySummary, WorkTask } from '../types/api';

const money = (value?: string) => new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', minimumFractionDigits: 3 }).format(Number(value ?? 0));
const date = (value: string) => new Intl.DateTimeFormat('fr-TN', { day: '2-digit', month: 'short' }).format(new Date(`${value}T00:00:00`));

export function DashboardPage() {
  const { session, organization, can } = useAuth();
  const id = organization?.id;
  const now = new Date();
  const profitabilityFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const profitabilityTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const dossiers = useQuery({
    queryKey: ['dossiers', id, 'dashboard'],
    queryFn: () => api.get<PagedResponse<DossierSummary>>(`/api/organizations/${id}/dossiers?page=1&pageSize=6`),
    enabled: Boolean(id && can('dossiers.view')),
  });
  const tasks = useQuery({
    queryKey: ['tasks', id, 'overdue'],
    queryFn: () => api.get<PagedResponse<WorkTask>>(`/api/organizations/${id}/tasks?overdue=true&page=1&pageSize=6`),
    enabled: Boolean(id && can('tasks.view')),
  });
  const billing = useQuery({
    queryKey: ['billing-summary', id],
    queryFn: () => api.get<BillingSummary>(`/api/organizations/${id}/billing/summary`),
    enabled: Boolean(id && can('billing.view')),
  });
  const notifications = useQuery({
    queryKey: ['notifications', id, 'unread'],
    queryFn: () => api.get<NotificationItem[]>(`/api/organizations/${id}/notifications?unreadOnly=true`),
    enabled: Boolean(id && can('notifications.view')),
  });
  const profitability = useQuery({
    queryKey: ['profitability-summary', id],
    queryFn: () => api.get<ProfitabilitySummary>(`/api/organizations/${id}/profitability?from=${profitabilityFrom}&to=${profitabilityTo}`),
    enabled: Boolean(id && can('profitability.view')),
  });

  const hasError = [dossiers, tasks, billing, notifications, profitability].some((query) => query.isError);
  const firstName = session?.user.fullName.split(' ')[0] ?? '';

  return (
    <>
      <PageHeader eyebrow="Vue d’ensemble" title={`Bonjour ${firstName}`} description={`Voici ce qui demande votre attention aujourd’hui dans ${organization?.name ?? 'votre cabinet'}.`} action={<Button component={RouterLink} to="/dossiers" variant="contained" endIcon={<ArrowForwardRounded />} disabled={!can('dossiers.view')}>Voir les dossiers</Button>} />
      {hasError && <Alert severity="warning" sx={{ mb: 2.5 }}>Certaines données ne sont pas encore disponibles. Vérifiez que le backend est démarré.</Alert>}

      <div className="metric-grid">
        <MetricCard label="Dossiers actifs" value={dossiers.data?.total ?? 0} hint="Clients accessibles" icon={FolderOutlined} loading={dossiers.isLoading} />
        <MetricCard label="Tâches en retard" value={tasks.data?.total ?? 0} hint="À traiter en priorité" icon={TaskAltOutlined} color="#bd4f4f" loading={tasks.isLoading} />
        <MetricCard label="Honoraires à encaisser" value={money(billing.data?.outstanding)} hint="Solde facturé non réglé" icon={PaidOutlined} color="#c47a24" loading={billing.isLoading} />
        <MetricCard label="Marge du mois" value={money(profitability.data?.totals.marginOnBilled)} hint={can('profitability.view') ? 'Sur honoraires facturés' : 'Accès propriétaire'} icon={QueryStatsOutlined} color="#6a5acd" loading={profitability.isLoading} />
      </div>

      <Box className="dashboard-grid" sx={{ mt: 2.5 }}>
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 3, py: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box><Typography variant="h3" sx={{ fontSize: 24 }}>Urgences du cabinet</Typography><Typography variant="body2" color="text.secondary">Tâches échues qui ne sont pas terminées</Typography></Box>
              <Button component={RouterLink} to="/taches" endIcon={<ArrowForwardRounded />} disabled={!can('tasks.view')}>Tout voir</Button>
            </Box>
            <Divider />
            {tasks.isLoading && <Box sx={{ p: 3 }}><Skeleton height={70} /><Skeleton height={70} /><Skeleton height={70} /></Box>}
            {!tasks.isLoading && !tasks.data?.items.length && <Box sx={{ p: 5, textAlign: 'center' }}><TaskAltOutlined sx={{ color: 'success.main', fontSize: 38 }} /><Typography sx={{ mt: 1, fontWeight: 700 }}>Aucune tâche en retard</Typography><Typography variant="body2" color="text.secondary">Le planning est à jour.</Typography></Box>}
            {tasks.data?.items.map((task, index) => (
              <Box key={task.id}>
                <Box sx={{ px: 3, py: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: 5, bgcolor: task.priority === 'URGENTE' ? 'error.main' : 'warning.main', flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}><Typography noWrap sx={{ fontWeight: 700 }}>{task.title}</Typography><Typography variant="body2" color="text.secondary" noWrap>{task.dossierName ?? 'Dossier'} · {task.assigneeName ?? 'Non affectée'}</Typography></Box>
                  <Chip label={date(task.dueOn)} size="small" color="error" variant="outlined" />
                </Box>
                {index < (tasks.data?.items.length ?? 0) - 1 && <Divider />}
              </Box>
            ))}
          </CardContent>
        </Card>

        <Stack spacing={2.5}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2 }}><NotificationsOutlined color="primary" /><Typography variant="h3" sx={{ fontSize: 22 }}>Notifications</Typography><Chip label={notifications.data?.length ?? 0} size="small" /></Box>
              {notifications.isLoading && <Skeleton height={90} />}
              {!notifications.isLoading && !notifications.data?.length && <Typography variant="body2" color="text.secondary">Aucune nouvelle notification.</Typography>}
              {notifications.data?.slice(0, 4).map((item) => <Box key={item.id} sx={{ py: 1.2 }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{item.title}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.message}</Typography></Box>)}
            </CardContent>
          </Card>
          {can('billing.view') && <Card><CardContent sx={{ p: 3 }}><Typography variant="h3" sx={{ fontSize: 22, mb: 2 }}>Encaissement</Typography><Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}><Typography variant="body2" color="text.secondary">Encaissé</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{money(billing.data?.paid)}</Typography></Box><LinearProgress variant="determinate" value={Math.min(100, Number(billing.data?.billed) ? Number(billing.data?.paid) / Number(billing.data?.billed) * 100 : 0)} sx={{ height: 9, borderRadius: 5 }} /><Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}><Typography variant="caption" color="text.secondary">Facturé</Typography><Typography variant="caption" color="text.secondary">{money(billing.data?.billed)}</Typography></Box></CardContent></Card>}
        </Stack>
      </Box>
    </>
  );
}
