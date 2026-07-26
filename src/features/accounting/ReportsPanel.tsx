import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, Chip, Dialog, DialogContent, DialogTitle, IconButton, MenuItem,
  Skeleton, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import {
  AccountBalanceOutlined, DownloadRounded, MenuBookOutlined, PeopleAltOutlined,
  ReceiptLongOutlined, VisibilityOutlined,
} from '@mui/icons-material';
import { api, downloadApiFile } from '../../api/client';
import type { AgedBalanceRow, FinancialSummary, GeneralLedgerRow, JournalEntry, TrialBalanceRow } from '../../types/api';
import { money, shortDate } from './options';

const yearRange = () => { const year = new Date().getFullYear(); return { from: `${year}-01-01`, to: `${year}-12-31` }; };
function SummaryCard({ label, value, tone = 'primary' }: { label: string; value?: string; tone?: 'primary' | 'success' | 'warning' }) {
  return <Card variant="outlined" sx={{ p: 2.2 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h3" sx={{ fontSize: 24, mt: .5, color: `${tone}.dark` }}>{money(value)}</Typography></Card>;
}

export function ReportsPanel({ organizationId, dossierId }: { organizationId: string; dossierId: string }) {
  const initial = yearRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [tab, setTab] = useState<'balance' | 'ledger' | 'aged' | 'entries'>('balance');
  const [accountFilter, setAccountFilter] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const base = `/api/organizations/${organizationId}/dossiers/${dossierId}`;
  const params = `?from=${from}&to=${to}`;
  const summary = useQuery({ queryKey: ['accounting-report', organizationId, dossierId, 'summary', from, to], queryFn: () => api.get<FinancialSummary>(`${base}/reports/financial-summary${params}`), enabled: Boolean(from && to) });
  const trial = useQuery({ queryKey: ['accounting-report', organizationId, dossierId, 'trial', from, to], queryFn: () => api.get<TrialBalanceRow[]>(`${base}/reports/trial-balance${params}`), enabled: Boolean(from && to) });
  const ledger = useQuery({ queryKey: ['accounting-report', organizationId, dossierId, 'ledger', from, to], queryFn: () => api.get<GeneralLedgerRow[]>(`${base}/reports/general-ledger${params}`), enabled: Boolean(from && to) });
  const aged = useQuery({ queryKey: ['accounting-report', organizationId, dossierId, 'aged', from, to], queryFn: () => api.get<AgedBalanceRow[]>(`${base}/reports/aged-balance${params}`), enabled: Boolean(from && to) });
  const entries = useQuery({ queryKey: ['journal-entries', organizationId, dossierId], queryFn: () => api.get<JournalEntry[]>(`${base}/entries`) });
  const selectedEntry = useQuery({ queryKey: ['journal-entry', organizationId, dossierId, selectedEntryId], queryFn: () => api.get<JournalEntry>(`${base}/entries/${selectedEntryId}`), enabled: Boolean(selectedEntryId) });
  const accounts = useMemo(() => [...new Set((ledger.data ?? []).map((row) => `${row.accountCode} — ${row.accountName}`))], [ledger.data]);
  const ledgerRows = (ledger.data ?? []).filter((row) => !accountFilter || `${row.accountCode} — ${row.accountName}` === accountFilter);
  const postedEntries = (entries.data ?? []).filter((entry) => ['COMPTABILISEE', 'EXTOURNEE'].includes(entry.status) && entry.entryDate >= from && entry.entryDate <= to);
  const loading = summary.isLoading || trial.isLoading || ledger.isLoading || aged.isLoading || entries.isLoading;
  const hasError = summary.isError || trial.isError || ledger.isError || aged.isError || entries.isError;
  const report = tab === 'balance' ? 'trial-balance' : tab === 'ledger' ? 'general-ledger' : tab === 'aged' ? 'aged-balance' : 'entries';
  const exportReport = async (format: 'pdf' | 'xlsx') => {
    setDownloadError('');
    try { await downloadApiFile(`${base}/reports/${report}/export?from=${from}&to=${to}&format=${format}`, `${report}-${from}-${to}.${format}`); }
    catch (error) { setDownloadError(error instanceof Error ? error.message : "Impossible de générer l'export."); }
  };
  const drillAccount = (row: TrialBalanceRow) => { setAccountFilter(`${row.code} — ${row.name}`); setTab('ledger'); };

  return <Stack spacing={2}>
    <Card><Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
      <Box><Typography variant="h3" sx={{ fontSize: 24 }}>États comptables</Typography><Typography variant="body2" color="text.secondary">Uniquement les écritures comptabilisées, avec navigation jusqu’à la pièce.</Typography></Box>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <TextField size="small" label="Du" type="date" value={from} onChange={(event) => setFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" label="Au" type="date" value={to} onChange={(event) => setTo(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Button startIcon={<DownloadRounded />} onClick={() => exportReport('pdf')}>PDF</Button>
        <Button startIcon={<DownloadRounded />} onClick={() => exportReport('xlsx')}>Excel</Button>
      </Stack>
    </Box></Card>
    {downloadError && <Alert severity="error">{downloadError}</Alert>}
    {summary.isLoading ? <Skeleton height={105} /> : <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(6, 1fr)' }, gap: 1.5 }}>
      <SummaryCard label="Actif" value={summary.data?.assets} /><SummaryCard label="Passif" value={summary.data?.liabilities} />
      <SummaryCard label="Capitaux propres" value={summary.data?.equity} /><SummaryCard label="Produits" value={summary.data?.revenue} tone="success" />
      <SummaryCard label="Charges" value={summary.data?.expenses} tone="warning" /><SummaryCard label="Résultat net" value={summary.data?.netResult} tone={Number(summary.data?.netResult) >= 0 ? 'success' : 'warning'} />
    </Box>}
    <Card>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable">
        <Tab value="balance" label="Balance générale" icon={<AccountBalanceOutlined />} iconPosition="start" />
        <Tab value="ledger" label="Grand livre" icon={<MenuBookOutlined />} iconPosition="start" />
        <Tab value="aged" label="Balance auxiliaire" icon={<PeopleAltOutlined />} iconPosition="start" />
        <Tab value="entries" label="Journal des écritures" icon={<ReceiptLongOutlined />} iconPosition="start" />
      </Tabs>
      {hasError && <Alert severity="error" sx={{ m: 2 }}>Impossible de charger un ou plusieurs états.</Alert>}
      {loading && <Box sx={{ p: 2.5 }}><Skeleton height={60} /><Skeleton height={60} /><Skeleton height={60} /></Box>}
      {tab === 'balance' && !trial.isLoading && <>
        <Box sx={{ px: 3, py: 1.3, display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) 150px 150px 150px 90px', gap: 2, bgcolor: 'background.default' }}>
          <Typography variant="caption">Compte</Typography><Typography variant="caption">Débit</Typography><Typography variant="caption">Crédit</Typography><Typography variant="caption">Solde</Typography><span />
        </Box>
        {trial.data?.map((row) => <Box key={row.accountId} sx={{ px: 3, py: 1.4, display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) 150px 150px 150px 90px', gap: 2, borderTop: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{row.code} — {row.name}</Typography><Typography variant="body2">{money(row.totalDebit)}</Typography>
          <Typography variant="body2">{money(row.totalCredit)}</Typography><Typography variant="body2" sx={{ fontWeight: 900 }}>{money(row.balance)}</Typography>
          <Button size="small" onClick={() => drillAccount(row)}>Détail</Button>
        </Box>)}
        {!trial.data?.length && <Box sx={{ p: 5, textAlign: 'center' }}><Typography color="text.secondary">Aucun mouvement comptabilisé sur cette période.</Typography></Box>}
      </>}
      {tab === 'ledger' && !ledger.isLoading && <>
        <Box sx={{ p: 2 }}><TextField select size="small" label="Compte" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} sx={{ minWidth: 320 }}>
          <MenuItem value="">Tous les comptes</MenuItem>{accounts.map((account) => <MenuItem key={account} value={account}>{account}</MenuItem>)}
        </TextField></Box>
        {ledgerRows.map((row) => <Box key={row.lineId} sx={{ px: 3, py: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '110px 85px 170px minmax(220px,1fr) 125px 125px 100px 50px' }, gap: 1.5, borderTop: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
          <Typography variant="body2">{shortDate(row.entryDate)}</Typography><Chip label={row.journalCode} size="small" variant="outlined" />
          <Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{row.accountCode}</Typography><Typography variant="caption" color="text.secondary">{row.pieceReference}</Typography></Box>
          <Box><Typography variant="body2">{row.label}</Typography>{row.thirdPartyName && <Typography variant="caption" color="text.secondary">{row.thirdPartyName}</Typography>}</Box>
          <Typography variant="body2">{money(row.debit)}</Typography><Typography variant="body2">{money(row.credit)}</Typography>
          <Chip size="small" label={row.letterCode ?? 'Non lettré'} variant="outlined" color={row.letterCode ? 'success' : 'default'} />
          <IconButton title="Voir l’écriture" onClick={() => setSelectedEntryId(row.entryId)}><VisibilityOutlined /></IconButton>
        </Box>)}
        {!ledgerRows.length && <Box sx={{ p: 5, textAlign: 'center' }}><Typography color="text.secondary">Aucune ligne de grand livre.</Typography></Box>}
      </>}
      {tab === 'aged' && !aged.isLoading && <>
        <Box sx={{ px: 3, py: 1.3, display: 'grid', gridTemplateColumns: 'minmax(240px,1fr) 160px 160px 160px', gap: 2, bgcolor: 'background.default' }}>
          <Typography variant="caption">Tiers</Typography><Typography variant="caption">Débit</Typography><Typography variant="caption">Crédit</Typography><Typography variant="caption">Solde</Typography>
        </Box>
        {aged.data?.map((row) => <Box key={row.thirdPartyName} sx={{ px: 3, py: 1.5, display: 'grid', gridTemplateColumns: 'minmax(240px,1fr) 160px 160px 160px', gap: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 800 }}>{row.thirdPartyName}</Typography><Typography>{money(row.totalDebit)}</Typography><Typography>{money(row.totalCredit)}</Typography><Typography sx={{ fontWeight: 900 }}>{money(row.balance)}</Typography>
        </Box>)}
        {!aged.data?.length && <Box sx={{ p: 5, textAlign: 'center' }}><Typography color="text.secondary">Aucun solde auxiliaire sur la période.</Typography></Box>}
      </>}
      {tab === 'entries' && !entries.isLoading && <>
        <Box sx={{ px: 3, py: 1.3, display: 'grid', gridTemplateColumns: '110px 90px 170px minmax(240px,1fr) 150px 150px 55px', gap: 2, bgcolor: 'background.default' }}>
          <Typography variant="caption">Date</Typography><Typography variant="caption">Journal</Typography><Typography variant="caption">Pièce</Typography>
          <Typography variant="caption">Libellé</Typography><Typography variant="caption">Débit</Typography><Typography variant="caption">Crédit</Typography><span />
        </Box>
        {postedEntries.map((entry) => <Box key={entry.id} sx={{ px: 3, py: 1.5, display: 'grid', gridTemplateColumns: '110px 90px 170px minmax(240px,1fr) 150px 150px 55px', gap: 2, borderTop: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
          <Typography variant="body2">{shortDate(entry.entryDate)}</Typography><Chip label={entry.journal.code} size="small" variant="outlined" />
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{entry.pieceReference}</Typography><Typography variant="body2">{entry.description}</Typography>
          <Typography variant="body2">{money(entry.totalDebit)}</Typography><Typography variant="body2">{money(entry.totalCredit)}</Typography>
          <IconButton title="Voir l’écriture" onClick={() => setSelectedEntryId(entry.id)}><VisibilityOutlined /></IconButton>
        </Box>)}
        {!postedEntries.length && <Box sx={{ p: 5, textAlign: 'center' }}><Typography color="text.secondary">Aucune écriture comptabilisée sur cette période.</Typography></Box>}
      </>}
    </Card>
    <Dialog open={Boolean(selectedEntryId)} onClose={() => setSelectedEntryId(null)} fullWidth maxWidth="md">
      <DialogTitle>Détail de l’écriture {selectedEntry.data?.pieceReference}</DialogTitle>
      <DialogContent>
        {selectedEntry.isLoading && <Skeleton height={150} />}
        {selectedEntry.data && <Stack spacing={1.5}>
          <Stack direction="row" spacing={2}><Chip label={selectedEntry.data.journal.code} /><Typography>{shortDate(selectedEntry.data.entryDate)}</Typography><Chip label={selectedEntry.data.status} variant="outlined" /></Stack>
          <Typography variant="h4">{selectedEntry.data.description}</Typography>
          {selectedEntry.data.lines.map((line) => <Card key={line.id} variant="outlined" sx={{ p: 1.5, display: 'grid', gridTemplateColumns: '220px 1fr 130px 130px', gap: 1 }}>
            <Typography sx={{ fontWeight: 800 }}>{line.account.code} — {line.account.name}</Typography><Typography>{line.label}</Typography>
            <Typography>Débit {money(line.debit)}</Typography><Typography>Crédit {money(line.credit)}</Typography>
          </Card>)}
          {selectedEntry.data.sourceDocumentId && <Alert severity="info">Cette écriture est rattachée à une pièce justificative. Ouvrez l’onglet Documents du dossier pour l’aperçu.</Alert>}
        </Stack>}
      </DialogContent>
    </Dialog>
  </Stack>;
}
