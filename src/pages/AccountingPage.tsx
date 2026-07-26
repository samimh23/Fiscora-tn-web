import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, InputAdornment, MenuItem, Stack,
  Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import { AddRounded, AutoAwesomeRounded, EditOutlined, SearchRounded } from '@mui/icons-material';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DossierSelector, QueryState } from '../components/WorkspaceTools';
import { PageHeader } from '../components/PageHeader';
import { DossierAccountingPanel } from '../features/accounting/DossierAccountingPanel';
import type { DossierSummary, LedgerAccount } from '../types/api';

interface AccountForm {
  code: string; name: string; description: string; type: string; normalBalance: string;
  parentAccountId: string; allowsPosting: boolean; isActive: boolean;
}

const emptyAccount: AccountForm = {
  code: '', name: '', description: '', type: 'Asset', normalBalance: 'Debit',
  parentAccountId: '', allowsPosting: true, isActive: true,
};

const accountTypeLabels: Record<string, string> = {
  Asset: 'Actif', Liability: 'Passif', Equity: 'Capitaux propres', Revenue: 'Produit',
  Expense: 'Charge', OffBalanceSheet: 'Hors bilan',
};

export function AccountingPage() {
  const { organization, can } = useAuth();
  const organizationId = organization?.id ?? '';
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('chart');
  const [dossierId, setDossierId] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerAccount | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyAccount);

  const base = `/api/organizations/${organizationId}/dossiers/${dossierId}`;
  const accounts = useQuery({
    queryKey: ['ledger-accounts', organizationId, dossierId, true],
    queryFn: () => api.get<LedgerAccount[]>(`${base}/ledger-accounts?includeInactive=true`),
    enabled: Boolean(organizationId && dossierId && can('chart_of_accounts.view')),
  });
  const dossier = useQuery({
    queryKey: ['dossier', organizationId, dossierId],
    queryFn: () => api.get<DossierSummary>(`${base}`),
    enabled: Boolean(organizationId && dossierId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ledger-accounts', organizationId, dossierId] });
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, description: form.description.trim() || null, parentAccountId: form.parentAccountId || null };
      return editing ? api.put(`${base}/ledger-accounts/${editing.id}`, payload) : api.post(`${base}/ledger-accounts`, payload);
    },
    onSuccess: async () => { await refresh(); setDialogOpen(false); },
  });
  const install = useMutation({
    mutationFn: () => api.post<{ added: number; skipped: number; total: number; reference: string }>(`${base}/ledger-accounts/apply-tunisian-chart`),
    onSuccess: refresh,
  });

  const filtered = useMemo(() => (accounts.data ?? []).filter((item) => {
    const matches = `${item.code} ${item.name}`.toLowerCase().includes(search.toLowerCase());
    return matches && (showInactive || item.isActive);
  }), [accounts.data, search, showInactive]);

  const openCreate = () => { setEditing(null); setForm(emptyAccount); setDialogOpen(true); };
  const openEdit = (account: LedgerAccount) => {
    setEditing(account);
    setForm({
      code: account.code, name: account.name, description: account.description ?? '', type: account.type,
      normalBalance: account.normalBalance, parentAccountId: account.parentAccountId ?? '',
      allowsPosting: account.allowsPosting, isActive: account.isActive,
    });
    setDialogOpen(true);
  };
  const error = save.error ?? install.error;

  return <>
    <PageHeader
      eyebrow="Production comptable"
      title="Comptabilité"
      description="Plan NC 01, exercices, écritures, contrôle et rapports propres à chaque dossier client."
      action={<DossierSelector value={dossierId} onChange={setDossierId} />}
    />
    {!dossierId && <Alert severity="info" sx={{ mb: 2 }}>Choisissez d’abord un dossier : son plan comptable et ses exercices sont totalement séparés des autres clients.</Alert>}
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error instanceof Error ? error.message : 'Une erreur est survenue.'}</Alert>}
    {install.data && <Alert severity="success" sx={{ mb: 2 }}>Plan {install.data.reference} installé : {install.data.added} compte(s) ajouté(s), {install.data.skipped} déjà présent(s).</Alert>}
    <Card sx={{ mb: 2 }}>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2 }}>
        <Tab value="chart" label="Plan comptable du dossier" />
        <Tab value="dossier" label="Production comptable" />
      </Tabs>
    </Card>

    {tab === 'chart' && dossierId && <Card><CardContent sx={{ p: 0 }}>
      <Box sx={{ p: 2.5, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="Rechercher un code ou un libellé…" value={search}
          onChange={(event) => setSearch(event.target.value)} sx={{ minWidth: { xs: '100%', sm: 330 } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
        <FormControlLabel control={<Checkbox checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />} label="Afficher les comptes inactifs" />
        <Box sx={{ flex: 1 }} />
        <Button startIcon={<AutoAwesomeRounded />} disabled={!can('chart_of_accounts.manage') || install.isPending}
          onClick={() => install.mutate()}>Installer le plan tunisien NC 01</Button>
        <Button variant="contained" startIcon={<AddRounded />} disabled={!can('chart_of_accounts.manage')} onClick={openCreate}>Nouveau compte</Button>
      </Box>
      <Alert severity="info" sx={{ mx: 2.5, mb: 2 }}>Le référentiel général NC 01 est installé sans écraser vos subdivisions personnalisées. Le responsable comptable peut ajouter des sous-comptes adaptés à l’activité du client.</Alert>
      <QueryState loading={accounts.isLoading} error={accounts.isError} empty={!filtered.length} emptyText="Le plan du dossier est vide. Installez le plan tunisien ou créez un compte." />
      {filtered.length > 0 && <Box sx={{ overflowX: 'auto' }}><Table size="small">
        <TableHead><TableRow><TableCell>Code</TableCell><TableCell>Compte</TableCell><TableCell>Type</TableCell><TableCell>Sens</TableCell><TableCell>Saisie</TableCell><TableCell>Statut</TableCell><TableCell /></TableRow></TableHead>
        <TableBody>{filtered.map((account) => <TableRow key={account.id}>
          <TableCell><Typography sx={{ fontWeight: 850 }}>{account.code}</Typography></TableCell>
          <TableCell><Typography sx={{ fontWeight: 700 }}>{account.name}</Typography>{account.description && <Typography variant="caption" color="text.secondary">{account.description}</Typography>}</TableCell>
          <TableCell>{accountTypeLabels[account.type] ?? account.type}</TableCell><TableCell>{account.normalBalance === 'Debit' ? 'Débit' : 'Crédit'}</TableCell>
          <TableCell>{account.allowsPosting ? 'Autorisée' : 'Collectif'}</TableCell>
          <TableCell><Chip size="small" label={account.isActive ? 'Actif' : 'Inactif'} color={account.isActive ? 'success' : 'default'} variant="outlined" /></TableCell>
          <TableCell><Button size="small" startIcon={<EditOutlined />} disabled={!can('chart_of_accounts.manage')} onClick={() => openEdit(account)}>Modifier</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table></Box>}
    </CardContent></Card>}

    {tab === 'dossier' && <>
      {!dossierId && <Alert severity="info">Choisissez un dossier client.</Alert>}
      {dossier.isError && <Alert severity="error">Impossible de charger le dossier sélectionné.</Alert>}
      {dossier.data && <DossierAccountingPanel
        organizationId={organizationId} dossierId={dossierId} archived={dossier.data.status === 'ARCHIVE'}
        canAccountingView={can('accounting.view')} canAccountingManage={can('accounting.manage')}
        canAccountingPost={can('accounting.post')} canAccountsView={can('chart_of_accounts.view')}
        canReportsView={can('reports.view')} canDeclarationsView={can('declarations.view')}
        canDeclarationsManage={can('declarations.manage')} canDeclarationsValidate={can('declarations.validate')}
        canInvoicesView={can('business_invoices.view')} canPeriodView={can('period_closing.view')}
        canPeriodValidate={can('period_closing.validate')} />}
    </>}

    <Dialog open={dialogOpen} onClose={save.isPending ? undefined : () => setDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? 'Modifier le compte' : 'Nouveau compte comptable'}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField label="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
          <TextField fullWidth label="Libellé" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Stack>
        <TextField multiline minRows={2} label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField select fullWidth label="Type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            {Object.entries(accountTypeLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label="Sens normal" value={form.normalBalance} onChange={(event) => setForm({ ...form, normalBalance: event.target.value })}>
            <MenuItem value="Debit">Débit</MenuItem><MenuItem value="Credit">Crédit</MenuItem>
          </TextField>
        </Stack>
        <TextField select label="Compte parent" value={form.parentAccountId} onChange={(event) => setForm({ ...form, parentAccountId: event.target.value })}>
          <MenuItem value="">Aucun</MenuItem>{accounts.data?.filter((item) => item.id !== editing?.id).map((item) => <MenuItem key={item.id} value={item.id}>{item.code} — {item.name}</MenuItem>)}
        </TextField>
        <FormControlLabel control={<Checkbox checked={form.allowsPosting} onChange={(event) => setForm({ ...form, allowsPosting: event.target.checked })} />} label="Autoriser la saisie directe sur ce compte" />
        {editing && <FormControlLabel control={<Checkbox checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />} label="Compte actif" />}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setDialogOpen(false)}>Annuler</Button><Button variant="contained" disabled={!form.code.trim() || !form.name.trim() || save.isPending} onClick={() => save.mutate()}>Enregistrer</Button></DialogActions>
    </Dialog>
  </>;
}
