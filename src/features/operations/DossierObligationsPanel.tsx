import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import {
  CalendarMonthOutlined, CheckCircleOutlineRounded, PaymentsOutlined,
  PlayArrowRounded, SendRounded, UploadFileOutlined,
} from '@mui/icons-material';
import { api, ApiError } from '../../api/client';
import type { FiscalObligation } from '../../types/api';
import { formatDate, obligationStatusLabels } from './options';

type ActionType = 'reject' | 'file' | 'pay';

const money = (value?: string | null) => value ? new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', minimumFractionDigits: 3 }).format(Number(value)) : '—';
const periodLabel = (item: FiscalObligation) => item.periodMonth ? `${String(item.periodMonth).padStart(2, '0')}/${item.periodYear}` : item.periodQuarter ? `T${item.periodQuarter} ${item.periodYear}` : String(item.periodYear);

function statusColor(status: string): 'default' | 'primary' | 'success' | 'warning' {
  if (status === 'PAYEE' || status === 'DEPOSEE') return 'success';
  if (status === 'VALIDEE') return 'primary';
  if (status === 'PRETE_POUR_REVISION') return 'warning';
  return 'default';
}

export function DossierObligationsPanel({ organizationId, dossierId, archived, canManage, canValidate, canFile }: { organizationId: string; dossierId: string; archived: boolean; canManage: boolean; canValidate: boolean; canFile: boolean }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selected, setSelected] = useState<FiscalObligation | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [comment, setComment] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['dossier-obligations', organizationId, dossierId, year], queryFn: () => api.get<FiscalObligation[]>(`/api/organizations/${organizationId}/dossiers/${dossierId}/obligations?year=${year}`) });
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['dossier-obligations', organizationId, dossierId] }); await queryClient.invalidateQueries({ queryKey: ['dossier-tasks', organizationId, dossierId] }); };
  const mutation = useMutation({ mutationFn: async ({ type, item }: { type: string; item?: FiscalObligation }) => {
    const target = item ?? selected;
    if (type === 'generate') return api.post(`/api/organizations/${organizationId}/dossiers/${dossierId}/obligations/generate`, { year });
    if (!target) return;
    const base = `/api/organizations/${organizationId}/dossiers/${dossierId}/obligations/${target.id}`;
    if (type === 'start') return api.patch(base + '/progress', { status: 'EN_COURS' });
    if (type === 'submit') return api.patch(base + '/progress', { status: 'PRETE_POUR_REVISION' });
    if (type === 'validate') return api.post(base + '/validate');
    if (type === 'reject') return api.post(base + '/reject', { comment: comment.trim() });
    if (type === 'file') return api.post(base + '/file', { amountDue: amount.trim() || null, notes: comment.trim() || null });
    if (type === 'pay') return api.post(base + '/pay', { amountPaid: amount.trim(), paymentReference: reference.trim() || null });
  }, onSuccess: async () => { setError(''); setSelected(null); setActionType(null); setComment(''); setAmount(''); setReference(''); await refresh(); }, onError: (reason) => setError(reason instanceof ApiError ? reason.message : 'Action impossible.') });
  const openAction = (type: ActionType, item: FiscalObligation) => { setSelected(item); setActionType(type); setComment(''); setAmount(type === 'pay' ? item.amountDue ?? '' : item.amountDue ?? ''); setReference(item.paymentReference ?? ''); setError(''); };

  return <><Card><Box sx={{ p: 2.5, display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}><Box><Typography variant="h3" sx={{ fontSize: 24 }}>Calendrier fiscal</Typography><Typography variant="body2" color="text.secondary">Échéances, préparation, validation, dépôt et paiement.</Typography></Box><Stack direction="row" spacing={1}><TextField select size="small" label="Année" value={year} onChange={(event) => setYear(Number(event.target.value))}>{[currentYear - 1, currentYear, currentYear + 1].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>{canManage && !archived && <Button variant="contained" startIcon={<CalendarMonthOutlined />} onClick={() => mutation.mutate({ type: 'generate' })} disabled={mutation.isPending}>Générer {year}</Button>}</Stack></Box>{error && <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>{error}</Alert>}{query.isLoading && <Box sx={{ p: 2.5 }}><Skeleton height={85} /><Skeleton height={85} /><Skeleton height={85} /></Box>}{query.isError && <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>Impossible de charger le calendrier fiscal.</Alert>}{!query.isLoading && !query.data?.length && <Box sx={{ p: 6, textAlign: 'center' }}><CalendarMonthOutlined sx={{ fontSize: 44, color: 'text.disabled' }} /><Typography sx={{ fontWeight: 800, mt: 1 }}>Calendrier non généré</Typography><Typography variant="body2" color="text.secondary">Générez les obligations applicables au profil fiscal de ce client.</Typography></Box>}{query.data?.map((item) => <Box key={item.id} sx={{ px: 3, py: 2.2, borderTop: '1px solid', borderColor: 'divider', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(250px, 1fr) 150px 170px auto' }, gap: 2, alignItems: 'center', bgcolor: item.isLate ? '#fff8f6' : 'transparent' }}><Box><Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}><Typography sx={{ fontWeight: 800 }}>{item.name}</Typography><Chip label={periodLabel(item)} size="small" variant="outlined" />{item.isLate && <Chip label="En retard" color="error" size="small" />}</Box><Typography variant="caption" color="text.secondary">{item.code} · Échéance {formatDate(item.dueOn)}</Typography>{item.lastComment && <Typography variant="body2" color="error.main" sx={{ mt: .5 }}>{item.lastComment}</Typography>}</Box><Box><Typography variant="caption" color="text.secondary">Montant dû</Typography><Typography sx={{ fontWeight: 800 }}>{money(item.amountDue)}</Typography></Box><Chip label={obligationStatusLabels[item.status] ?? item.status} color={statusColor(item.status)} variant="outlined" /><Stack direction="row" spacing={.5} sx={{ justifyContent: { md: 'flex-end' }, flexWrap: 'wrap' }}>{canManage && !archived && item.status === 'NON_COMMENCEE' && <Button size="small" startIcon={<PlayArrowRounded />} onClick={() => mutation.mutate({ type: 'start', item })}>Démarrer</Button>}{canManage && !archived && item.status === 'EN_COURS' && <Button size="small" startIcon={<SendRounded />} onClick={() => mutation.mutate({ type: 'submit', item })}>Soumettre</Button>}{canValidate && !archived && item.status === 'PRETE_POUR_REVISION' && <Button size="small" color="success" startIcon={<CheckCircleOutlineRounded />} onClick={() => mutation.mutate({ type: 'validate', item })}>Valider</Button>}{canValidate && !archived && item.status === 'PRETE_POUR_REVISION' && <Button size="small" color="error" onClick={() => openAction('reject', item)}>Rejeter</Button>}{canFile && !archived && item.status === 'VALIDEE' && <Button size="small" startIcon={<UploadFileOutlined />} onClick={() => openAction('file', item)}>Déposer</Button>}{canFile && !archived && ['DEPOSEE', 'PAYEE'].includes(item.status) && <Button size="small" startIcon={<PaymentsOutlined />} onClick={() => openAction('pay', item)}>Paiement</Button>}</Stack></Box>)}</Card><Dialog open={Boolean(actionType)} onClose={mutation.isPending ? undefined : () => setActionType(null)} fullWidth maxWidth="xs"><DialogTitle>{actionType === 'reject' ? 'Rejeter la préparation' : actionType === 'file' ? 'Enregistrer le dépôt' : 'Enregistrer le paiement'}</DialogTitle><DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>{error && <Alert severity="error">{error}</Alert>}{actionType !== 'reject' && <TextField label={actionType === 'file' ? 'Montant dû (TND)' : 'Montant payé (TND)'} value={amount} onChange={(event) => setAmount(event.target.value)} required={actionType === 'pay'} />}{actionType === 'pay' && <TextField label="Référence de paiement" value={reference} onChange={(event) => setReference(event.target.value)} />}{actionType !== 'pay' && <TextField label={actionType === 'reject' ? 'Motif obligatoire' : 'Notes'} multiline minRows={3} value={comment} onChange={(event) => setComment(event.target.value)} />}</DialogContent><DialogActions><Button onClick={() => setActionType(null)}>Annuler</Button><Button variant="contained" color={actionType === 'reject' ? 'error' : 'primary'} disabled={mutation.isPending || (actionType === 'reject' && !comment.trim()) || (actionType === 'pay' && !amount.trim())} onClick={() => actionType && mutation.mutate({ type: actionType })}>Enregistrer</Button></DialogActions></Dialog></>;
}
