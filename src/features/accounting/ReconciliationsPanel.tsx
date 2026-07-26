import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, Checkbox, Chip, MenuItem, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { LinkOffRounded, LinkRounded } from '@mui/icons-material';
import { api, ApiError } from '../../api/client';
import type { AccountReconciliation, JournalEntry, LedgerAccount } from '../../types/api';
import { money, shortDate } from './options';

export function ReconciliationsPanel({
  organizationId, dossierId, entries, accounts, canPost, archived,
}: {
  organizationId: string; dossierId: string; entries: JournalEntry[]; accounts: LedgerAccount[];
  canPost: boolean; archived: boolean;
}) {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const base = `/api/organizations/${organizationId}/dossiers/${dossierId}`;
  const reconciliations = useQuery({
    queryKey: ['reconciliations', organizationId, dossierId],
    queryFn: () => api.get<AccountReconciliation[]>(`${base}/reconciliations`),
  });
  const candidates = useMemo(() => entries
    .filter((entry) => ['COMPTABILISEE', 'EXTOURNEE'].includes(entry.status))
    .flatMap((entry) => entry.lines.map((line) => ({ ...line, entry })))
    .filter((line) => !line.reconciliationId && (!accountId || line.accountId === accountId)), [entries, accountId]);
  const candidateAccounts = useMemo(() => accounts.filter((account) =>
    entries.some((entry) => entry.lines.some((line) => line.accountId === account.id && !line.reconciliationId))), [accounts, entries]);
  const chosen = candidates.filter((line) => selected.includes(line.id));
  const debit = chosen.reduce((sum, line) => sum + Number(line.debit), 0);
  const credit = chosen.reduce((sum, line) => sum + Number(line.credit), 0);
  const balanced = selected.length >= 2 && debit > 0 && Math.abs(debit - credit) < 0.0005;

  const create = useMutation({
    mutationFn: () => api.post<AccountReconciliation>(`${base}/reconciliations`, { accountId, lineIds: selected }),
    onSuccess: async () => {
      setSelected([]); setError('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reconciliations', organizationId, dossierId] }),
        queryClient.invalidateQueries({ queryKey: ['journal-entries', organizationId, dossierId] }),
        queryClient.invalidateQueries({ queryKey: ['accounting-report', organizationId, dossierId] }),
      ]);
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : 'Lettrage impossible.'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${base}/reconciliations/${id}`),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['reconciliations', organizationId, dossierId] }),
      queryClient.invalidateQueries({ queryKey: ['journal-entries', organizationId, dossierId] }),
      queryClient.invalidateQueries({ queryKey: ['accounting-report', organizationId, dossierId] }),
    ]),
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : 'Délettrage impossible.'),
  });

  return <Stack spacing={2}>
    {error && <Alert severity="error">{error}</Alert>}
    <Card sx={{ p: 2.5 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
        <Box sx={{ flex: 1 }}><Typography variant="h3" sx={{ fontSize: 24 }}>Lettrage des comptes</Typography>
          <Typography variant="body2" color="text.secondary">Associez des débits et crédits comptabilisés dont le total est exactement équilibré.</Typography></Box>
        <TextField select size="small" label="Compte à lettrer" value={accountId}
          onChange={(event) => { setAccountId(event.target.value); setSelected([]); }} sx={{ minWidth: 310 }}>
          <MenuItem value="">Sélectionner un compte…</MenuItem>
          {candidateAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.code} — {account.name}</MenuItem>)}
        </TextField>
      </Stack>
      {accountId && <>
        <Box sx={{ overflowX: 'auto', mt: 2 }}><Table size="small">
          <TableHead><TableRow><TableCell padding="checkbox" /><TableCell>Date</TableCell><TableCell>Pièce</TableCell><TableCell>Libellé</TableCell><TableCell>Tiers</TableCell><TableCell align="right">Débit</TableCell><TableCell align="right">Crédit</TableCell></TableRow></TableHead>
          <TableBody>{candidates.map((line) => <TableRow key={line.id} hover>
            <TableCell padding="checkbox"><Checkbox checked={selected.includes(line.id)} onChange={() => setSelected((current) => current.includes(line.id) ? current.filter((id) => id !== line.id) : [...current, line.id])} /></TableCell>
            <TableCell>{shortDate(line.entry.entryDate)}</TableCell><TableCell>{line.entry.pieceReference}</TableCell>
            <TableCell>{line.label}</TableCell><TableCell>{line.thirdPartyName ?? '—'}</TableCell>
            <TableCell align="right">{money(line.debit)}</TableCell><TableCell align="right">{money(line.credit)}</TableCell>
          </TableRow>)}</TableBody>
        </Table></Box>
        {!candidates.length && <Alert severity="info" sx={{ mt: 2 }}>Aucune ligne non lettrée pour ce compte.</Alert>}
        <Stack direction="row" spacing={2} sx={{ mt: 2, justifyContent: 'flex-end', alignItems: 'center' }}>
          <Typography>Débit <strong>{money(debit)}</strong></Typography><Typography>Crédit <strong>{money(credit)}</strong></Typography>
          <Chip label={balanced ? 'Équilibré' : `Écart ${money(Math.abs(debit - credit))}`} color={balanced ? 'success' : 'warning'} variant="outlined" />
          <Button variant="contained" startIcon={<LinkRounded />} disabled={!canPost || archived || !balanced || create.isPending} onClick={() => create.mutate()}>Lettrer</Button>
        </Stack>
      </>}
    </Card>
    <Card sx={{ p: 2.5 }}><Typography variant="h3" sx={{ fontSize: 22, mb: 2 }}>Lettrages réalisés</Typography>
      {(reconciliations.data ?? []).map((item) => <Box key={item.id} sx={{ py: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '150px 1fr 150px 130px auto' }, gap: 2, alignItems: 'center' }}>
        <Chip label={item.code} color="success" variant="outlined" /><Typography>{item.account.code} — {item.account.name}</Typography>
        <Typography>{shortDate(item.reconciliationDate)}</Typography><Typography>{money(item.totalDebit)}</Typography>
        <Button color="error" startIcon={<LinkOffRounded />} disabled={!canPost || archived || remove.isPending} onClick={() => remove.mutate(item.id)}>Délettrer</Button>
      </Box>)}
      {!reconciliations.isLoading && !reconciliations.data?.length && <Typography color="text.secondary">Aucun lettrage enregistré.</Typography>}
    </Card>
  </Stack>;
}
