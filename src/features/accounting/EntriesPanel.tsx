import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, Chip, Collapse, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Skeleton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  AddRounded, CheckCircleOutlineRounded, DeleteOutlineRounded, ExpandMoreRounded,
  EditRounded, RateReviewOutlined, ReplayRounded, SendRounded, SwapVertRounded,
} from '@mui/icons-material';
import { api, ApiError } from '../../api/client';
import type { AccountingJournal, JournalEntry, LedgerAccount } from '../../types/api';
import { entryStatusLabels, money, shortDate } from './options';

type DraftLine = { accountId: string; label: string; debit: string; credit: string; thirdPartyName: string };
const emptyLine = (): DraftLine => ({ accountId: '', label: '', debit: '0.000', credit: '0.000', thirdPartyName: '' });

function EntryDialog({ open, onClose, organizationId, dossierId, journals, accounts, entry }: {
  open: boolean; onClose: () => void; organizationId: string; dossierId: string;
  journals: AccountingJournal[]; accounts: LedgerAccount[]; entry?: JournalEntry | null;
}) {
  const queryClient = useQueryClient();
  const [journalId, setJournalId] = useState(entry?.journalId ?? '');
  const [entryDate, setEntryDate] = useState(entry?.entryDate ?? new Date().toISOString().slice(0, 10));
  const [pieceReference, setPieceReference] = useState(entry?.pieceReference ?? '');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [lines, setLines] = useState<DraftLine[]>(entry?.lines.map((line) => ({
    accountId: line.accountId,
    label: line.label,
    debit: line.debit,
    credit: line.credit,
    thirdPartyName: line.thirdPartyName ?? '',
  })) ?? [emptyLine(), emptyLine()]);
  const [error, setError] = useState('');
  const totals = useMemo(() => lines.reduce((sum, line) => ({
    debit: sum.debit + (Number(line.debit) || 0), credit: sum.credit + (Number(line.credit) || 0),
  }), { debit: 0, credit: 0 }), [lines]);
  const difference = totals.debit - totals.credit;
  const updateLine = (index: number, key: keyof DraftLine, value: string) => setLines((current) => current.map((line, position) => position === index ? {
    ...line, [key]: value,
    ...(key === 'debit' && Number(value) > 0 ? { credit: '0.000' } : {}),
    ...(key === 'credit' && Number(value) > 0 ? { debit: '0.000' } : {}),
  } : line));
  const mutation = useMutation({
    mutationFn: () => (entry ? api.put<JournalEntry>(`/api/organizations/${organizationId}/dossiers/${dossierId}/entries/${entry.id}`, {
      journalId, entryDate, pieceReference: pieceReference.trim(), description: description.trim(),
      lines: lines.map((line) => ({ accountId: line.accountId, label: line.label.trim(), debit: line.debit || '0.000', credit: line.credit || '0.000', thirdPartyName: line.thirdPartyName.trim() || undefined })),
    }) : api.post<JournalEntry>(`/api/organizations/${organizationId}/dossiers/${dossierId}/entries`, {
      journalId, entryDate, pieceReference: pieceReference.trim(), description: description.trim(),
      lines: lines.map((line) => ({ accountId: line.accountId, label: line.label.trim(), debit: line.debit || '0.000', credit: line.credit || '0.000', thirdPartyName: line.thirdPartyName.trim() || undefined })),
    })),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['journal-entries', organizationId, dossierId] }); onClose(); },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : `Impossible de ${entry ? 'modifier' : 'créer'} cette écriture.`),
  });
  const validLines = lines.every((line) => line.accountId && line.label.trim() && ((Number(line.debit) > 0) !== (Number(line.credit) > 0)));

  return <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="lg">
    <DialogTitle>{entry ? 'Corriger l’écriture' : 'Nouvelle écriture comptable'}</DialogTitle>
    <DialogContent sx={{ pt: '12px !important' }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: '1.2fr 1fr 1fr 2fr' }, gap: 2 }}>
        <TextField select label="Journal" value={journalId} onChange={(event) => setJournalId(event.target.value)} required>
          <MenuItem value="">Sélectionner…</MenuItem>{journals.map((journal) => <MenuItem key={journal.id} value={journal.id}>{journal.code} — {journal.name}</MenuItem>)}
        </TextField>
        <TextField label="Date" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Référence pièce" value={pieceReference} onChange={(event) => setPieceReference(event.target.value)} />
        <TextField label="Libellé général" value={description} onChange={(event) => setDescription(event.target.value)} />
      </Box>
      <Typography sx={{ fontWeight: 900, mt: 3, mb: 1.5 }}>Mouvements débit / crédit</Typography>
      <Stack spacing={1.2}>{lines.map((line, index) => <Card key={index} variant="outlined" sx={{ p: 1.7 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 2fr 1fr 1fr 1.5fr auto' }, gap: 1.2, alignItems: 'center' }}>
          <TextField select size="small" label="Compte" value={line.accountId} onChange={(event) => updateLine(index, 'accountId', event.target.value)}>
            <MenuItem value="">Sélectionner…</MenuItem>{accounts.filter((account) => account.allowsPosting && account.isActive).map((account) => <MenuItem key={account.id} value={account.id}>{account.code} — {account.name}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Libellé" value={line.label} onChange={(event) => updateLine(index, 'label', event.target.value)} />
          <TextField size="small" label="Débit" value={line.debit} onChange={(event) => updateLine(index, 'debit', event.target.value)} />
          <TextField size="small" label="Crédit" value={line.credit} onChange={(event) => updateLine(index, 'credit', event.target.value)} />
          <TextField size="small" label="Tiers (facultatif)" value={line.thirdPartyName} onChange={(event) => updateLine(index, 'thirdPartyName', event.target.value)} />
          <Tooltip title="Supprimer"><span><IconButton color="error" disabled={lines.length === 2} onClick={() => setLines((current) => current.filter((_, position) => position !== index))}><DeleteOutlineRounded /></IconButton></span></Tooltip>
        </Box>
      </Card>)}</Stack>
      <Button startIcon={<AddRounded />} onClick={() => setLines((current) => [...current, emptyLine()])} sx={{ mt: 1 }}>Ajouter une ligne</Button>
      <Card variant="outlined" sx={{ mt: 2, p: 2, bgcolor: Math.abs(difference) < .0005 && totals.debit > 0 ? 'success.light' : 'warning.light' }}>
        <Stack direction="row" spacing={4} useFlexGap sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Typography>Total débit <strong>{money(totals.debit)}</strong></Typography><Typography>Total crédit <strong>{money(totals.credit)}</strong></Typography>
          <Typography>Écart <strong>{money(Math.abs(difference))}</strong></Typography>
        </Stack>
      </Card>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Annuler</Button><Button variant="contained" disabled={!journalId || !entryDate || !pieceReference.trim() || !description.trim() || !validLines || mutation.isPending} onClick={() => mutation.mutate()}>{entry ? 'Enregistrer les corrections' : 'Enregistrer le brouillon'}</Button></DialogActions>
  </Dialog>;
}

const entryColor = (status: string): 'warning' | 'success' | 'error' | 'info' | 'default' =>
  status === 'BROUILLON' ? 'warning' : status === 'A_VALIDER' ? 'info' : status === 'REJETEE' ? 'error' : status === 'COMPTABILISEE' ? 'success' : 'default';

export function EntriesPanel({ organizationId, dossierId, entries, journals, accounts, loading, archived, canManage, canPost }: {
  organizationId: string; dossierId: string; entries: JournalEntry[]; journals: AccountingJournal[];
  accounts: LedgerAccount[]; loading: boolean; archived: boolean; canManage: boolean; canPost: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [status, setStatus] = useState('TOUS');
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<JournalEntry | null>(null);
  const [comment, setComment] = useState('');
  const filtered = entries.filter((entry) => status === 'TOUS' || entry.status === status);
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['journal-entries', organizationId, dossierId] }),
    queryClient.invalidateQueries({ queryKey: ['accounting-report', organizationId, dossierId] }),
    queryClient.invalidateQueries({ queryKey: ['accounting-periods', organizationId, dossierId] }),
  ]);
  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) => api.post<JournalEntry>(`/api/organizations/${organizationId}/dossiers/${dossierId}/entries/${path}`, body),
    onSuccess: async () => { setError(''); setRejecting(null); setComment(''); await refresh(); },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : 'Action impossible.'),
  });

  return <>
    <Card>
      <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box><Typography variant="h3" sx={{ fontSize: 24 }}>Écritures comptables</Typography><Typography variant="body2" color="text.secondary">Saisie → soumission → validation ou rejet → verrouillage comptable.</Typography></Box>
        <Stack direction="row" spacing={1}>
          <TextField select size="small" label="Statut" value={status} onChange={(event) => setStatus(event.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="TOUS">Tous</MenuItem><MenuItem value="BROUILLON">Brouillons</MenuItem><MenuItem value="A_VALIDER">À valider</MenuItem>
            <MenuItem value="REJETEE">Rejetées</MenuItem><MenuItem value="COMPTABILISEE">Comptabilisées</MenuItem><MenuItem value="EXTOURNEE">Extournées</MenuItem>
          </TextField>
          {canManage && !archived && <Button variant="contained" startIcon={<AddRounded />} onClick={() => { setEditing(null); setOpen(true); }}>Nouvelle écriture</Button>}
        </Stack>
      </Box>
      {error && <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ p: 2.5 }}><Skeleton height={85} /><Skeleton height={85} /></Box>}
      {!loading && filtered.length === 0 && <Box sx={{ p: 6, textAlign: 'center' }}><SwapVertRounded sx={{ fontSize: 46, color: 'text.disabled' }} /><Typography sx={{ fontWeight: 800, mt: 1 }}>Aucune écriture</Typography></Box>}
      {filtered.map((entry) => <Box key={entry.id} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ px: 3, py: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(260px, 1fr) 130px 150px 150px auto' }, gap: 2, alignItems: 'center' }}>
          <Box><Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}><Typography sx={{ fontWeight: 900 }}>{entry.pieceReference}</Typography><Chip label={entry.journal.code} size="small" variant="outlined" /></Stack>
            <Typography variant="body2">{entry.description}</Typography><Typography variant="caption" color="text.secondary">{shortDate(entry.entryDate)} · {entry.lines.length} ligne(s)</Typography>
            {entry.reviewComment && <Alert severity="error" sx={{ mt: 1, py: 0 }}>{entry.reviewComment}</Alert>}
          </Box>
          <Chip label={entryStatusLabels[entry.status]} size="small" color={entryColor(entry.status)} variant="outlined" />
          <Typography>Débit <strong>{money(entry.totalDebit)}</strong></Typography><Typography>Crédit <strong>{money(entry.totalCredit)}</strong></Typography>
          <Stack direction="row" spacing={.5} sx={{ justifyContent: { lg: 'flex-end' } }}>
            {canManage && !archived && ['BROUILLON', 'REJETEE'].includes(entry.status) && <Tooltip title="Corriger"><IconButton onClick={() => { setEditing(entry); setOpen(true); }}><EditRounded /></IconButton></Tooltip>}
            {canManage && !archived && ['BROUILLON', 'REJETEE'].includes(entry.status) && <Button size="small" variant="contained" startIcon={<SendRounded />} onClick={() => action.mutate({ path: `${entry.id}/submit` })}>Soumettre</Button>}
            {canPost && !archived && entry.status === 'A_VALIDER' && <><Button size="small" color="success" variant="contained" startIcon={<CheckCircleOutlineRounded />} onClick={() => action.mutate({ path: `${entry.id}/approve` })}>Valider</Button><Button size="small" color="error" startIcon={<RateReviewOutlined />} onClick={() => setRejecting(entry)}>Rejeter</Button></>}
            {canPost && !archived && entry.status === 'COMPTABILISEE' && <Tooltip title="Extourner aujourd’hui"><IconButton color="warning" onClick={() => action.mutate({ path: `${entry.id}/reverse` })}><ReplayRounded /></IconButton></Tooltip>}
            <IconButton onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}><ExpandMoreRounded sx={{ transform: expanded === entry.id ? 'rotate(180deg)' : 'none', transition: '.2s' }} /></IconButton>
          </Stack>
        </Box>
        <Collapse in={expanded === entry.id}><Box sx={{ mx: 3, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          {entry.lines.map((line) => <Box key={line.id} sx={{ px: 2, py: 1.2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '180px 1fr 130px 130px 100px' }, gap: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>{line.account.code} — {line.account.name}</Typography>
            <Box><Typography variant="body2">{line.label}</Typography>{line.thirdPartyName && <Typography variant="caption" color="text.secondary">{line.thirdPartyName}</Typography>}</Box>
            <Typography variant="body2">Débit {money(line.debit)}</Typography><Typography variant="body2">Crédit {money(line.credit)}</Typography>
            <Typography variant="body2" color="success.main">{line.letterCode ?? 'Non lettré'}</Typography>
          </Box>)}
        </Box></Collapse>
      </Box>)}
    </Card>
    {open && <EntryDialog open={open} onClose={() => { setOpen(false); setEditing(null); }} organizationId={organizationId} dossierId={dossierId} journals={journals} accounts={accounts} entry={editing} />}
    <Dialog open={Boolean(rejecting)} onClose={() => setRejecting(null)} fullWidth maxWidth="sm">
      <DialogTitle>Rejeter l’écriture {rejecting?.pieceReference}</DialogTitle>
      <DialogContent><TextField autoFocus fullWidth multiline minRows={4} label="Motif obligatoire" value={comment} onChange={(event) => setComment(event.target.value)} sx={{ mt: 1 }} /></DialogContent>
      <DialogActions><Button onClick={() => setRejecting(null)}>Annuler</Button><Button color="error" variant="contained" disabled={!comment.trim() || action.isPending} onClick={() => rejecting && action.mutate({ path: `${rejecting.id}/reject`, body: { comment } })}>Confirmer le rejet</Button></DialogActions>
    </Dialog>
  </>;
}
