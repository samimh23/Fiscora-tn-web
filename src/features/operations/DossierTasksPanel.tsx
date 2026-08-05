import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControlLabel, IconButton, MenuItem, Skeleton, Stack,
  TextField, Tooltip, Typography,
} from '@mui/material';
import {
  AddRounded, AssignmentTurnedInOutlined, ChatBubbleOutlineRounded, EditOutlined,
  FilterAltOutlined, PersonOutlineRounded, PlayArrowRounded, SearchRounded, SendRounded,
  TaskAltOutlined, WarningAmberRounded,
} from '@mui/icons-material';
import { api, ApiError } from '../../api/client';
import type { DossierAssignment, PagedResponse, TaskComment, WorkTask } from '../../types/api';
import { formatDate, taskPriorityLabels, taskStatusLabels } from './options';

const today = new Date().toISOString().slice(0, 10);

function statusColor(status: string): 'default' | 'primary' | 'success' | 'warning' {
  if (status === 'TERMINEE') return 'success';
  if (status === 'PRETE_POUR_REVISION') return 'warning';
  if (status === 'EN_COURS') return 'primary';
  return 'default';
}

function priorityColor(priority: string): 'default' | 'error' | 'warning' {
  if (priority === 'URGENTE') return 'error';
  if (priority === 'HAUTE') return 'warning';
  return 'default';
}

function dueTone(task: WorkTask) {
  if (task.isOverdue) return { label: 'En retard', color: 'error.main', bg: '#fdeaea' };
  const due = new Date(`${task.dueOn.slice(0, 10)}T00:00:00`).getTime();
  const now = new Date(`${today}T00:00:00`).getTime();
  const days = Math.round((due - now) / 86_400_000);
  if (days <= 2) return { label: days <= 0 ? 'Aujourd’hui' : 'Bientôt', color: 'warning.main', bg: '#fff3df' };
  return { label: 'Planifiée', color: 'primary.main', bg: '#e4efe9' };
}

interface TaskFormValues { title: string; description: string; dueOn: string; priority: string; checklist: string }

function TaskFormDialog({ open, onClose, organizationId, dossierId, task }: { open: boolean; onClose: () => void; organizationId: string; dossierId: string; task?: WorkTask | null }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<TaskFormValues>({ title: '', description: '', dueOn: today, priority: 'NORMALE', checklist: '' });
  const [error, setError] = useState('');
  const editing = Boolean(task);

  useEffect(() => {
    if (!open) return;
    setValues(task
      ? { title: task.title, description: task.description ?? '', dueOn: task.dueOn, priority: task.priority, checklist: '' }
      : { title: '', description: '', dueOn: today, priority: 'NORMALE', checklist: '' });
    setError('');
  }, [open, task]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!values.title.trim()) throw new Error('Le titre est obligatoire.');
      const payload = {
        title: values.title.trim(),
        description: values.description.trim() || null,
        dueOn: values.dueOn,
        priority: values.priority,
        ...(editing ? {} : { checklist: values.checklist.split('\n').map((line) => line.trim()).filter(Boolean) }),
      };
      return editing
        ? api.patch<WorkTask>(`/api/organizations/${organizationId}/dossiers/${dossierId}/tasks/${task?.id}`, payload)
        : api.post<WorkTask>(`/api/organizations/${organizationId}/dossiers/${dossierId}/tasks`, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dossier-tasks', organizationId, dossierId] });
      onClose();
    },
    onError: (reason) => setError(reason instanceof ApiError || reason instanceof Error ? reason.message : 'Impossible d’enregistrer la tâche.'),
  });

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Typography variant="h3" sx={{ fontSize: 28 }}>{editing ? 'Modifier la tâche' : 'Créer une tâche'}</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ display: 'grid', gap: 2 }}>
          <TextField label="Titre" value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} required />
          <TextField label="Description" multiline minRows={3} value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField type="date" label="Échéance" value={values.dueOn} onChange={(event) => setValues({ ...values, dueOn: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField select label="Priorité" value={values.priority} onChange={(event) => setValues({ ...values, priority: event.target.value })}>
              {Object.entries(taskPriorityLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
          </Box>
          {!editing && (
            <TextField
              label="Checklist initiale"
              multiline
              minRows={4}
              value={values.checklist}
              onChange={(event) => setValues({ ...values, checklist: event.target.value })}
              helperText="Un élément par ligne : pièce à demander, contrôle à faire, validation attendue…"
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TaskDetailDialog({
  task, open, onClose, organizationId, dossierId, assignments, canManage, canAssign, canValidate,
}: {
  task: WorkTask | null;
  open: boolean;
  onClose: () => void;
  organizationId: string;
  dossierId: string;
  assignments: DossierAssignment[];
  canManage: boolean;
  canAssign: boolean;
  canValidate: boolean;
}) {
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState('');
  const [comment, setComment] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState('');

  const comments = useQuery({
    queryKey: ['task-comments', organizationId, dossierId, task?.id],
    queryFn: () => api.get<TaskComment[]>(`/api/organizations/${organizationId}/dossiers/${dossierId}/tasks/${task?.id}/comments`),
    enabled: Boolean(open && task?.id),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dossier-tasks', organizationId, dossierId] });
    await queryClient.invalidateQueries({ queryKey: ['task-comments', organizationId, dossierId, task?.id] });
  };

  const action = useMutation({
    mutationFn: async ({ type, payload }: { type: string; payload?: unknown }) => {
      if (!task) return;
      const base = `/api/organizations/${organizationId}/dossiers/${dossierId}/tasks/${task.id}`;
      if (type === 'start') return api.patch(base + '/progress', { status: 'EN_COURS' });
      if (type === 'submit') return api.patch(base + '/progress', { status: 'PRETE_POUR_REVISION', comment: comment.trim() || null });
      if (type === 'complete') return api.post(base + '/complete');
      if (type === 'reject') return api.post(base + '/reject', { comment: rejectComment.trim() });
      if (type.startsWith('assign:')) return api.put(base + `/assignee/${type.slice(7)}`);
      if (type.startsWith('check:')) return api.patch(base + `/checklist/${type.slice(6)}`, payload);
      if (type === 'add-check') return api.post(base + '/checklist', { label: newItem.trim() });
      if (type === 'comment') return api.post(base + '/comments', { body: comment.trim() });
    },
    onSuccess: async (_, variables) => {
      setError('');
      if (variables.type === 'add-check') setNewItem('');
      if (variables.type === 'comment' || variables.type === 'submit') setComment('');
      if (variables.type === 'reject') {
        setRejectComment('');
        setRejectOpen(false);
      }
      await refresh();
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : 'Action impossible.'),
  });

  if (!task) return null;
  const closed = ['TERMINEE', 'ANNULEE'].includes(task.status);
  const checklistProgress = task.checklistTotal > 0 ? Math.round((task.checklistCompleted / task.checklistTotal) * 100) : 0;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="overline" color="secondary.main" sx={{ fontWeight: 800 }}>
                {task.type === 'OBLIGATION' ? 'Tâche fiscale' : 'Tâche manuelle'}
              </Typography>
              <Typography variant="h3" sx={{ fontSize: 29 }}>{task.title}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                <Chip label={taskStatusLabels[task.status] ?? task.status} color={statusColor(task.status)} size="small" />
                <Chip label={taskPriorityLabels[task.priority] ?? task.priority} color={priorityColor(task.priority)} size="small" variant="outlined" />
                <Chip label={formatDate(task.dueOn)} size="small" color={task.isOverdue ? 'error' : 'default'} variant="outlined" />
              </Stack>
            </Box>
            {canManage && !closed && (
              <Tooltip title="Modifier">
                <IconButton onClick={() => setEditOpen(true)}><EditOutlined /></IconButton>
              </Tooltip>
            )}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box className="task-detail-grid">
            <Stack spacing={2.5}>
              <Box>
                <Typography sx={{ fontWeight: 800, mb: .5 }}>Description</Typography>
                <Typography color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{task.description || 'Aucune description.'}</Typography>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ fontWeight: 800 }}>Checklist</Typography>
                  <Typography variant="body2" color="text.secondary">{task.checklistCompleted}/{task.checklistTotal} · {checklistProgress}%</Typography>
                </Box>
                {task.checklist.map((item) => (
                  <FormControlLabel
                    key={item.id}
                    sx={{ display: 'flex', mx: 0 }}
                    control={<Checkbox checked={item.isCompleted} disabled={!canManage || closed || action.isPending} onChange={(_, checked) => action.mutate({ type: `check:${item.id}`, payload: { isCompleted: checked } })} />}
                    label={<Typography sx={{ textDecoration: item.isCompleted ? 'line-through' : 'none', color: item.isCompleted ? 'text.secondary' : 'text.primary' }}>{item.label}</Typography>}
                  />
                ))}
                {task.checklist.length === 0 && <Typography variant="body2" color="text.secondary">Aucun contrôle ajouté pour cette tâche.</Typography>}
                {canManage && !closed && (
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <TextField size="small" fullWidth placeholder="Nouvel élément de contrôle…" value={newItem} onChange={(event) => setNewItem(event.target.value)} />
                    <Button onClick={() => action.mutate({ type: 'add-check' })} disabled={!newItem.trim() || action.isPending}>Ajouter</Button>
                  </Box>
                )}
              </Box>

              <Divider />

              <Box>
                <Typography sx={{ fontWeight: 800, mb: 1 }}>Commentaires</Typography>
                {comments.isLoading && <Skeleton height={80} />}
                {comments.data?.map((entry) => (
                  <Box key={entry.id} sx={{ p: 1.5, mb: 1, bgcolor: '#f7f5ef', borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 800 }}>
                      {entry.authorName ?? 'Utilisateur'} · {new Intl.DateTimeFormat('fr-TN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(entry.createdAtUtc))}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: .5, whiteSpace: 'pre-wrap' }}>{entry.body}</Typography>
                  </Box>
                ))}
                {canManage && (
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <TextField size="small" fullWidth multiline maxRows={4} placeholder="Ajouter un commentaire…" value={comment} onChange={(event) => setComment(event.target.value)} />
                    <IconButton color="primary" onClick={() => action.mutate({ type: 'comment' })} disabled={!comment.trim()}><SendRounded /></IconButton>
                  </Box>
                )}
              </Box>
            </Stack>

            <Stack spacing={2}>
              <Card variant="outlined">
                <Box sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Collaborateur</Typography>
                  <Typography sx={{ fontWeight: 800 }}>{task.assigneeName || 'Non affectée'}</Typography>
                  {canAssign && !closed && (
                    <TextField select size="small" fullWidth label="Affecter à" value={task.assigneeMembershipId ?? ''} onChange={(event) => action.mutate({ type: `assign:${event.target.value}` })} sx={{ mt: 2 }}>
                      {assignments.filter((entry) => entry.isActive).map((entry) => <MenuItem key={entry.membershipId} value={entry.membershipId}>{entry.fullName}</MenuItem>)}
                    </TextField>
                  )}
                </Box>
              </Card>

              <Card variant="outlined">
                <Box sx={{ p: 2 }}>
                  <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Prochaine action</Typography>
                  <Stack spacing={1}>
                    {canManage && task.status === 'A_FAIRE' && <Button variant="contained" startIcon={<PlayArrowRounded />} onClick={() => action.mutate({ type: 'start' })}>Démarrer</Button>}
                    {canManage && task.status === 'EN_COURS' && <Button variant="contained" startIcon={<SendRounded />} onClick={() => action.mutate({ type: 'submit' })}>Soumettre pour révision</Button>}
                    {canValidate && task.status === 'PRETE_POUR_REVISION' && <Button variant="contained" color="success" startIcon={<AssignmentTurnedInOutlined />} onClick={() => action.mutate({ type: 'complete' })}>Valider la tâche</Button>}
                    {canValidate && task.status === 'PRETE_POUR_REVISION' && <Button color="error" variant="outlined" onClick={() => setRejectOpen(true)}>Renvoyer en correction</Button>}
                    {closed && <Alert severity="success">Cette tâche est clôturée.</Alert>}
                  </Stack>
                </Box>
              </Card>

              {task.lastComment && <Alert severity="info">{task.lastComment}</Alert>}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Fermer</Button></DialogActions>
      </Dialog>

      <TaskFormDialog open={editOpen} onClose={() => setEditOpen(false)} organizationId={organizationId} dossierId={dossierId} task={task} />

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Renvoyer la tâche</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth multiline minRows={3} label="Motif obligatoire" value={rejectComment} onChange={(event) => setRejectComment(event.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Annuler</Button>
          <Button color="error" variant="contained" disabled={!rejectComment.trim()} onClick={() => action.mutate({ type: 'reject' })}>Renvoyer</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function TaskKpi({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'warning' | 'success' }) {
  const colors = {
    danger: { bg: '#fdeaea', color: 'error.main' },
    warning: { bg: '#fff3df', color: 'warning.main' },
    success: { bg: '#e4efe9', color: 'success.main' },
  }[tone ?? 'success'];
  return (
    <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: colors.bg, minWidth: 130 }}>
      <Typography sx={{ fontWeight: 900, fontSize: 24, lineHeight: 1, color: colors.color }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>{label}</Typography>
    </Box>
  );
}

export function DossierTasksPanel({
  organizationId, dossierId, assignments, archived, canManage, canAssign, canValidate,
}: {
  organizationId: string;
  dossierId: string;
  assignments: DossierAssignment[];
  archived: boolean;
  canManage: boolean;
  canAssign: boolean;
  canValidate: boolean;
}) {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['dossier-tasks', organizationId, dossierId, status],
    queryFn: () => api.get<PagedResponse<WorkTask>>(`/api/organizations/${organizationId}/dossiers/${dossierId}/tasks?page=1&pageSize=100${status ? `&status=${status}` : ''}`),
  });

  const tasks = query.data?.items ?? [];
  const selected = useMemo(() => tasks.find((item) => item.id === selectedId) ?? null, [tasks, selectedId]);
  const visibleTasks = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('fr');
    if (!needle) return tasks;
    return tasks.filter((task) => [
      task.title,
      task.description ?? '',
      task.assigneeName ?? '',
      taskStatusLabels[task.status] ?? task.status,
      taskPriorityLabels[task.priority] ?? task.priority,
    ].join(' ').toLocaleLowerCase('fr').includes(needle));
  }, [tasks, search]);

  const stats = useMemo(() => ({
    overdue: tasks.filter((task) => task.isOverdue && !['TERMINEE', 'ANNULEE'].includes(task.status)).length,
    review: tasks.filter((task) => task.status === 'PRETE_POUR_REVISION').length,
    active: tasks.filter((task) => ['A_FAIRE', 'EN_COURS'].includes(task.status)).length,
    done: tasks.filter((task) => task.status === 'TERMINEE').length,
  }), [tasks]);

  return (
    <>
      <Card>
        <Box sx={{ p: { xs: 2, md: 2.5 } }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="h3" sx={{ fontSize: 24 }}>Production du dossier</Typography>
              <Typography variant="body2" color="text.secondary">
                Les tâches sont organisées comme un circuit de cabinet : affectation, exécution, révision puis validation.
              </Typography>
            </Box>
            {canManage && !archived && (
              <Button variant="contained" startIcon={<AddRounded />} onClick={() => setFormOpen(true)}>Nouvelle tâche</Button>
            )}
          </Box>

          <Stack direction="row" spacing={1.25} sx={{ mt: 2, flexWrap: 'wrap' }}>
            <TaskKpi label="En retard" value={stats.overdue} tone={stats.overdue ? 'danger' : 'success'} />
            <TaskKpi label="À réviser" value={stats.review} tone={stats.review ? 'warning' : 'success'} />
            <TaskKpi label="À produire" value={stats.active} />
            <TaskKpi label="Terminées" value={stats.done} />
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 220px' },
              gap: 1.5,
              mt: 2.5,
            }}
          >
            <TextField
              size="small"
              placeholder="Rechercher une tâche, un collaborateur, une priorité…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              slotProps={{ input: { startAdornment: <SearchRounded sx={{ color: 'text.secondary', mr: 1 }} /> } }}
            />
            <TextField
              select
              size="small"
              label="Statut"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              slotProps={{ input: { startAdornment: <FilterAltOutlined sx={{ color: 'text.secondary', mr: 1 }} /> } }}
            >
              <MenuItem value="">Tous les statuts</MenuItem>
              {Object.entries(taskStatusLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
          </Box>
        </Box>

        {query.isError && <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>Impossible de charger les tâches.</Alert>}
        {query.isLoading && <Box sx={{ p: 2.5 }}><Skeleton height={82} /><Skeleton height={82} /></Box>}

        {!query.isLoading && tasks.length === 0 && (
          <Box sx={{ p: { xs: 4, md: 6 }, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
            <TaskAltOutlined sx={{ fontSize: 42, color: 'text.disabled' }} />
            <Typography sx={{ fontWeight: 900, mt: 1 }}>Aucune tâche pour ce dossier</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mt: .5 }}>
              Créez une première tâche manuelle ou générez les obligations fiscales pour cadrer le travail du mois.
            </Typography>
            {canManage && !archived && <Button variant="contained" sx={{ mt: 2 }} startIcon={<AddRounded />} onClick={() => setFormOpen(true)}>Créer la première tâche</Button>}
          </Box>
        )}

        {!query.isLoading && tasks.length > 0 && visibleTasks.length === 0 && (
          <Box sx={{ p: 5, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
            <SearchRounded sx={{ fontSize: 40, color: 'text.disabled' }} />
            <Typography sx={{ fontWeight: 900, mt: 1 }}>Aucun résultat</Typography>
            <Typography variant="body2" color="text.secondary">Essayez un autre mot-clé ou retirez le filtre de statut.</Typography>
          </Box>
        )}

        {visibleTasks.map((task) => {
          const tone = dueTone(task);
          return (
            <Box
              key={task.id}
              onClick={() => setSelectedId(task.id)}
              sx={{
                px: { xs: 2, md: 3 },
                py: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
                display: 'grid',
                gridTemplateColumns: { xs: '40px minmax(0, 1fr)', md: '44px minmax(0, 1fr) auto' },
                alignItems: 'center',
                gap: 2,
                cursor: 'pointer',
                '&:hover': { bgcolor: '#faf8f2' },
              }}
            >
              <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: tone.bg, color: tone.color, display: 'grid', placeItems: 'center' }}>
                {task.isOverdue ? <WarningAmberRounded /> : task.type === 'OBLIGATION' ? <AssignmentTurnedInOutlined /> : <TaskAltOutlined />}
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ mb: .35, flexWrap: 'wrap' }}>
                  <Chip label={tone.label} size="small" sx={{ height: 22, bgcolor: tone.bg, color: tone.color, fontWeight: 800 }} />
                  <Chip label={taskPriorityLabels[task.priority] ?? task.priority} color={priorityColor(task.priority)} size="small" variant="outlined" sx={{ height: 22 }} />
                </Stack>
                <Typography sx={{ fontWeight: 900 }} noWrap>{task.title}</Typography>
                <Stack direction="row" spacing={1.25} sx={{ mt: .45, color: 'text.secondary', flexWrap: 'wrap' }}>
                  <Typography variant="caption">{formatDate(task.dueOn)}</Typography>
                  <Typography variant="caption">{taskStatusLabels[task.status] ?? task.status}</Typography>
                  {task.assigneeName && <Typography variant="caption"><PersonOutlineRounded sx={{ fontSize: 13, verticalAlign: 'middle' }} /> {task.assigneeName}</Typography>}
                  <Typography variant="caption"><ChatBubbleOutlineRounded sx={{ fontSize: 13, verticalAlign: 'middle' }} /> {task.checklistCompleted}/{task.checklistTotal}</Typography>
                </Stack>
              </Box>

              <Chip
                label={taskStatusLabels[task.status] ?? task.status}
                color={statusColor(task.status)}
                size="small"
                sx={{ display: { xs: 'none', md: 'inline-flex' } }}
              />
            </Box>
          );
        })}
      </Card>

      <TaskFormDialog open={formOpen} onClose={() => setFormOpen(false)} organizationId={organizationId} dossierId={dossierId} />
      <TaskDetailDialog
        task={selected}
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        organizationId={organizationId}
        dossierId={dossierId}
        assignments={assignments}
        canManage={canManage && !archived}
        canAssign={canAssign && !archived}
        canValidate={canValidate && !archived}
      />
    </>
  );
}
