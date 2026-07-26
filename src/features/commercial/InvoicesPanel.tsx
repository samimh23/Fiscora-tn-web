import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, MenuItem, Skeleton, Stack, TextField,
  Tooltip, Typography,
} from '@mui/material';
import {
  AddRounded, CheckCircleOutlineRounded, DeleteOutlineRounded, EditOutlined,
  PostAddRounded, ReceiptLongOutlined,
} from '@mui/icons-material';
import { api, ApiError } from '../../api/client';
import type { AccountingJournal, BusinessInvoice, BusinessInvoiceLine, FiscalVatRate, FiscalWithholdingRate, LedgerAccount, ThirdParty } from '../../types/api';
import { invoiceStatusLabels, money, settlementStatusLabels, shortDate } from './options';

type DraftLine = Pick<BusinessInvoiceLine, 'accountId' | 'description' | 'quantity' | 'unitPrice' | 'discountRate'> & { vatCode: string; vatRate: string };
type Form = {
  type: 'ACHAT' | 'VENTE'; nature: 'BIENS' | 'SERVICES' | 'MIXTE'; kind: 'FACTURE' | 'AVOIR'; number: string; invoiceDate: string;
  dueDate: string; thirdPartyId: string; originalInvoiceId: string; journalId: string;
  thirdPartyAccountId: string; vatAccountId: string; stampAccountId: string;
  withholdingAccountId: string; stampDuty: string; withholdingNature: string;
  withholdingBase: string; notes: string; lines: DraftLine[];
};
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): DraftLine => ({ accountId: '', description: '', quantity: '1.000', unitPrice: '', discountRate: '0.00000', vatCode: '', vatRate: '0.19000' });
const emptyForm = (): Form => ({ type: 'VENTE', nature: 'SERVICES', kind: 'FACTURE', number: '', invoiceDate: today(), dueDate: '', thirdPartyId: '', originalInvoiceId: '', journalId: '', thirdPartyAccountId: '', vatAccountId: '', stampAccountId: '', withholdingAccountId: '', stampDuty: '', withholdingNature: '', withholdingBase: '', notes: '', lines: [emptyLine()] });

function statusColor(status: BusinessInvoice['status']): 'default' | 'warning' | 'primary' | 'success' {
  if (status === 'BROUILLON') return 'warning';
  if (status === 'VALIDEE') return 'primary';
  if (status === 'COMPTABILISEE') return 'success';
  return 'default';
}

function InvoiceDialog({ open, onClose, organizationId, dossierId, invoice, invoices, parties, accounts, journals, vatRates, withholdingRates }: {
  open: boolean; onClose: () => void; organizationId: string; dossierId: string;
  invoice: BusinessInvoice | null; invoices: BusinessInvoice[]; parties: ThirdParty[];
  accounts: LedgerAccount[]; journals: AccountingJournal[]; vatRates: FiscalVatRate[]; withholdingRates: FiscalWithholdingRate[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => invoice ? {
    type: invoice.type, nature: invoice.nature ?? 'MIXTE', kind: invoice.kind, number: invoice.number, invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate ?? '', thirdPartyId: invoice.thirdPartyId ?? '', originalInvoiceId: invoice.originalInvoiceId ?? '',
    journalId: invoice.journalId, thirdPartyAccountId: invoice.thirdPartyAccountId, vatAccountId: invoice.vatAccountId ?? '',
    stampAccountId: invoice.stampAccountId ?? '', withholdingAccountId: invoice.withholdingAccountId ?? '',
    stampDuty: invoice.stampDuty, withholdingNature: '', withholdingBase: invoice.withholdingBase, notes: invoice.notes ?? '',
    lines: invoice.lines.map((line) => ({ accountId: line.accountId, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountRate: line.discountRate, vatCode: line.vatCode ?? '', vatRate: line.vatRate })),
  } : emptyForm());
  const [error, setError] = useState('');
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const postingAccounts = accounts.filter((account) => account.isActive && account.allowsPosting);
  const availableParties = parties.filter((party) => party.type === 'CLIENT_ET_FOURNISSEUR' || (form.type === 'VENTE' ? party.type === 'CLIENT' : party.type === 'FOURNISSEUR'));
  const availableJournals = journals.filter((journal) => journal.type === (form.type === 'VENTE' ? 'VENTES' : 'ACHATS'));
  const originals = invoices.filter((item) => item.type === form.type && item.kind === 'FACTURE' && item.status === 'COMPTABILISEE' && Number(item.outstandingAmount) > 0);
  const selectedParty = parties.find((party) => party.id === form.thirdPartyId);
  const applicableVatRates = vatRates.filter((rate) => rate.effectiveFrom <= form.invoiceDate && (!rate.effectiveTo || rate.effectiveTo >= form.invoiceDate));
  const applicableWithholdingRates = withholdingRates.filter((rate) => rate.effectiveFrom <= form.invoiceDate && (!rate.effectiveTo || rate.effectiveTo >= form.invoiceDate));
  const calculation = useMemo(() => form.lines.reduce((total, line) => {
    const quantity = Number(line.quantity) || 0;
    const price = Number(line.unitPrice) || 0;
    const discount = Number(line.discountRate) || 0;
    const net = quantity * price * (1 - discount);
    const vat = net * (Number(line.vatRate) || 0);
    return { net: total.net + net, vat: total.vat + vat };
  }, { net: 0, vat: 0 }), [form.lines]);
  const changeType = (type: Form['type']) => setForm((current) => ({ ...current, type, thirdPartyId: '', originalInvoiceId: '', journalId: '', thirdPartyAccountId: '' }));
  const selectParty = (id: string) => {
    const party = parties.find((entry) => entry.id === id);
    setForm((current) => ({ ...current, thirdPartyId: id, thirdPartyAccountId: party ? (current.type === 'VENTE' ? party.receivableAccountId : party.payableAccountId) ?? '' : '' }));
  };
  const updateLine = (index: number, key: keyof DraftLine, value: string) => setForm((current) => ({ ...current, lines: current.lines.map((line, position) => position === index ? { ...line, [key]: value } : line) }));
  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedParty) throw new Error('Sélectionnez un client ou fournisseur.');
      const body = {
        type: form.type, nature: form.nature, kind: form.kind, number: form.number.trim(), invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined, thirdPartyId: form.thirdPartyId,
        originalInvoiceId: form.kind === 'AVOIR' ? form.originalInvoiceId || undefined : undefined,
        thirdPartyName: selectedParty.name, thirdPartyTaxIdentifier: selectedParty.taxIdentifier || undefined,
        journalId: form.journalId, thirdPartyAccountId: form.thirdPartyAccountId,
        vatAccountId: form.vatAccountId || undefined, stampAccountId: form.stampAccountId || undefined,
        withholdingAccountId: form.withholdingAccountId || undefined, stampDuty: form.stampDuty || undefined,
        withholdingNature: form.withholdingNature.trim() || undefined, withholdingBase: form.withholdingBase || undefined,
        notes: form.notes.trim() || undefined,
        lines: form.lines.map((line) => ({
          accountId: line.accountId, description: line.description.trim(), quantity: line.quantity,
          unitPrice: line.unitPrice, discountRate: line.discountRate,
          vatCode: line.vatCode || undefined, vatRate: line.vatCode ? undefined : line.vatRate || undefined,
        })),
      };
      const base = `/api/organizations/${organizationId}/dossiers/${dossierId}/business-invoices`;
      return invoice ? api.put<BusinessInvoice>(`${base}/${invoice.id}`, body) : api.post<BusinessInvoice>(base, body);
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['business-invoices', organizationId, dossierId] }); onClose(); },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : reason instanceof Error ? reason.message : 'Impossible d’enregistrer la facture.'),
  });
  const valid = Boolean(form.number.trim() && form.invoiceDate && form.thirdPartyId && form.journalId && form.thirdPartyAccountId && form.lines.length && form.lines.every((line) => line.accountId && line.description.trim() && line.unitPrice));

  return <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="lg">
    <DialogTitle>{invoice ? `Modifier ${invoice.number}` : 'Nouvelle facture ou avoir'}</DialogTitle>
    <DialogContent sx={{ pt: '12px !important' }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        <TextField select label="Flux" value={form.type} onChange={(event) => changeType(event.target.value as Form['type'])}><MenuItem value="VENTE">Vente</MenuItem><MenuItem value="ACHAT">Achat</MenuItem></TextField>
        <TextField select label="Nature" value={form.nature} onChange={(event) => set('nature', event.target.value as Form['nature'])} helperText={form.type === 'VENTE' && form.invoiceDate >= '2026-01-01' && form.nature !== 'BIENS' ? 'Services inclus dans le champ e-facture depuis 2026 (art. 53)' : 'Détermine les contrôles fiscaux et TTN'}><MenuItem value="BIENS">Biens</MenuItem><MenuItem value="SERVICES">Services</MenuItem><MenuItem value="MIXTE">Biens et services</MenuItem></TextField>
        <TextField select label="Document" value={form.kind} onChange={(event) => set('kind', event.target.value as Form['kind'])}><MenuItem value="FACTURE">Facture</MenuItem><MenuItem value="AVOIR">Avoir</MenuItem></TextField>
        <TextField label="Numéro" value={form.number} onChange={(event) => set('number', event.target.value)} required />
        <TextField label="Date" type="date" value={form.invoiceDate} onChange={(event) => set('invoiceDate', event.target.value)} slotProps={{ inputLabel: { shrink: true } }} required />
        <TextField label="Échéance" type="date" value={form.dueDate} onChange={(event) => set('dueDate', event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField select label={form.type === 'VENTE' ? 'Client' : 'Fournisseur'} value={form.thirdPartyId} onChange={(event) => selectParty(event.target.value)} required><MenuItem value="">Sélectionner…</MenuItem>{availableParties.map((party) => <MenuItem key={party.id} value={party.id}>{party.name}</MenuItem>)}</TextField>
        <TextField select label="Journal" value={form.journalId} onChange={(event) => set('journalId', event.target.value)} required><MenuItem value="">Sélectionner…</MenuItem>{availableJournals.map((journal) => <MenuItem key={journal.id} value={journal.id}>{journal.code} — {journal.name}</MenuItem>)}</TextField>
        <TextField select label="Compte tiers" value={form.thirdPartyAccountId} onChange={(event) => set('thirdPartyAccountId', event.target.value)} required><MenuItem value="">Sélectionner…</MenuItem>{postingAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.code} — {account.name}</MenuItem>)}</TextField>
        {form.kind === 'AVOIR' && <TextField select label="Facture d’origine" value={form.originalInvoiceId} onChange={(event) => set('originalInvoiceId', event.target.value)} required sx={{ gridColumn: { md: 'span 2' } }}><MenuItem value="">Sélectionner…</MenuItem>{originals.map((item) => <MenuItem key={item.id} value={item.id}>{item.number} — {item.thirdPartyName} — solde {money(item.outstandingAmount)}</MenuItem>)}</TextField>}
      </Box>

      <Divider sx={{ my: 3 }}><Chip label="Lignes comptables" /></Divider>
      <Stack spacing={1.5}>{form.lines.map((line, index) => <Card key={index} variant="outlined" sx={{ p: 2 }}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 2fr .8fr 1fr 1fr 1fr auto' }, gap: 1.5, alignItems: 'center' }}>
        <TextField select size="small" label="Compte" value={line.accountId} onChange={(event) => updateLine(index, 'accountId', event.target.value)}><MenuItem value="">Sélectionner…</MenuItem>{postingAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.code} — {account.name}</MenuItem>)}</TextField>
        <TextField size="small" label="Description" value={line.description} onChange={(event) => updateLine(index, 'description', event.target.value)} />
        <TextField size="small" label="Qté" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} />
        <TextField size="small" label="PU HT" value={line.unitPrice} onChange={(event) => updateLine(index, 'unitPrice', event.target.value)} />
        <TextField select size="small" label="Remise" value={line.discountRate} onChange={(event) => updateLine(index, 'discountRate', event.target.value)}><MenuItem value="0.00000">0 %</MenuItem><MenuItem value="0.05000">5 %</MenuItem><MenuItem value="0.10000">10 %</MenuItem></TextField>
        <TextField select size="small" label="TVA" value={line.vatCode || `manual:${line.vatRate}`} onChange={(event) => { const value = event.target.value; if (value.startsWith('manual:')) { updateLine(index, 'vatCode', ''); updateLine(index, 'vatRate', value.slice(7)); } else { const configured = applicableVatRates.find((rate) => rate.code === value); updateLine(index, 'vatCode', value); if (configured) updateLine(index, 'vatRate', configured.rate); } }}><MenuItem value="manual:0.00000">Exonéré / 0 %</MenuItem>{applicableVatRates.map((rate) => <MenuItem key={rate.id} value={rate.code}>{rate.label} — {(Number(rate.rate) * 100).toFixed(0)} %</MenuItem>)}<MenuItem value="manual:0.07000">7 % (manuel)</MenuItem><MenuItem value="manual:0.13000">13 % (manuel)</MenuItem><MenuItem value="manual:0.19000">19 % (manuel)</MenuItem></TextField>
        <Tooltip title="Supprimer la ligne"><span><IconButton color="error" disabled={form.lines.length === 1} onClick={() => set('lines', form.lines.filter((_, position) => position !== index))}><DeleteOutlineRounded /></IconButton></span></Tooltip>
      </Box></Card>)}</Stack>
      <Button startIcon={<AddRounded />} sx={{ mt: 1 }} onClick={() => set('lines', [...form.lines, emptyLine()])}>Ajouter une ligne</Button>

      <Divider sx={{ my: 3 }}><Chip label="Taxes et retenue" /></Divider>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        <TextField select label="Compte TVA" value={form.vatAccountId} onChange={(event) => set('vatAccountId', event.target.value)}><MenuItem value="">Aucun</MenuItem>{postingAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.code} — {account.name}</MenuItem>)}</TextField>
        <TextField select label="Compte timbre" value={form.stampAccountId} onChange={(event) => set('stampAccountId', event.target.value)}><MenuItem value="">Aucun</MenuItem>{postingAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.code} — {account.name}</MenuItem>)}</TextField>
        <TextField label="Timbre manuel (TND)" value={form.stampDuty} onChange={(event) => set('stampDuty', event.target.value)} helperText="Vide = taux officiel configuré" />
        <TextField select label="Nature de retenue" value={form.withholdingNature} onChange={(event) => set('withholdingNature', event.target.value)} helperText="Taux officiel applicable à la date"><MenuItem value="">Aucune retenue</MenuItem>{applicableWithholdingRates.map((rate) => <MenuItem key={rate.id} value={rate.natureCode}>{rate.label} — {(Number(rate.rate) * 100).toLocaleString('fr-TN')} %</MenuItem>)}</TextField>
        {form.withholdingNature && <><TextField label="Base de retenue" value={form.withholdingBase} onChange={(event) => set('withholdingBase', event.target.value)} helperText="Vide = total HT" /><TextField select label="Compte retenue" value={form.withholdingAccountId} onChange={(event) => set('withholdingAccountId', event.target.value)}><MenuItem value="">Sélectionner…</MenuItem>{postingAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.code} — {account.name}</MenuItem>)}</TextField></>}
        <TextField label="Notes" multiline minRows={2} value={form.notes} onChange={(event) => set('notes', event.target.value)} sx={{ gridColumn: { sm: 'span 2' } }} />
      </Box>
      <Card variant="outlined" sx={{ mt: 3, p: 2.5, bgcolor: 'primary.light' }}><Stack direction="row" spacing={4} useFlexGap sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}><Box><Typography variant="caption">Total HT estimé</Typography><Typography sx={{ fontWeight: 900 }}>{money(calculation.net)}</Typography></Box><Box><Typography variant="caption">TVA estimée</Typography><Typography sx={{ fontWeight: 900 }}>{money(calculation.vat)}</Typography></Box><Box><Typography variant="caption">TTC estimé hors timbre</Typography><Typography sx={{ fontWeight: 900, color: 'primary.dark' }}>{money(calculation.net + calculation.vat)}</Typography></Box></Stack></Card>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Annuler</Button><Button variant="contained" disabled={!valid || mutation.isPending || (form.kind === 'AVOIR' && !form.originalInvoiceId)} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Enregistrement…' : 'Enregistrer le brouillon'}</Button></DialogActions>
  </Dialog>;
}

export function InvoicesPanel({ organizationId, dossierId, invoices, parties, accounts, journals, vatRates, withholdingRates, loading, archived, canManage, canValidate, canPost }: {
  organizationId: string; dossierId: string; invoices: BusinessInvoice[]; parties: ThirdParty[]; accounts: LedgerAccount[]; journals: AccountingJournal[];
  vatRates: FiscalVatRate[]; withholdingRates: FiscalWithholdingRate[]; loading: boolean; archived: boolean; canManage: boolean; canValidate: boolean; canPost: boolean;
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<BusinessInvoice | null>(null);
  const [filter, setFilter] = useState('TOUTES');
  const [error, setError] = useState('');
  const filtered = invoices.filter((invoice) => filter === 'TOUTES' || invoice.type === filter);
  const action = useMutation({
    mutationFn: ({ type, invoice }: { type: 'validate' | 'post'; invoice: BusinessInvoice }) => api.post<BusinessInvoice>(`/api/organizations/${organizationId}/dossiers/${dossierId}/business-invoices/${invoice.id}/${type}`),
    onSuccess: async () => { setError(''); await queryClient.invalidateQueries({ queryKey: ['business-invoices', organizationId, dossierId] }); await queryClient.invalidateQueries({ queryKey: ['third-parties', organizationId, dossierId] }); },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : 'Action impossible.'),
  });

  return <>
    <Card>
      <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}><Box><Typography variant="h3" sx={{ fontSize: 24 }}>Factures d’achat et de vente</Typography><Typography variant="body2" color="text.secondary">TVA, retenues, validation et génération automatique des écritures.</Typography></Box><Stack direction="row" spacing={1}><TextField select size="small" label="Flux" value={filter} onChange={(event) => setFilter(event.target.value)} sx={{ minWidth: 130 }}><MenuItem value="TOUTES">Toutes</MenuItem><MenuItem value="VENTE">Ventes</MenuItem><MenuItem value="ACHAT">Achats</MenuItem></TextField>{canManage && !archived && <Button variant="contained" startIcon={<AddRounded />} onClick={() => { setSelected(null); setDialogOpen(true); }}>Nouvelle facture</Button>}</Stack></Box>
      {error && <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ p: 2.5 }}><Skeleton height={90} /><Skeleton height={90} /></Box>}
      {!loading && filtered.length === 0 && <Box sx={{ p: 6, textAlign: 'center' }}><ReceiptLongOutlined sx={{ fontSize: 46, color: 'text.disabled' }} /><Typography sx={{ fontWeight: 800, mt: 1 }}>Aucune facture</Typography><Typography variant="body2" color="text.secondary">Créez la première facture d’achat ou de vente de ce dossier.</Typography></Box>}
      {filtered.map((invoice) => <Box key={invoice.id} sx={{ px: 3, py: 2.2, borderTop: '1px solid', borderColor: 'divider', display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(250px, 1fr) 125px 150px 155px auto' }, gap: 2, alignItems: 'center' }}>
        <Box><Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}><Typography sx={{ fontWeight: 900 }}>{invoice.kind === 'AVOIR' ? 'Avoir' : 'Facture'} {invoice.number}</Typography><Chip size="small" label={invoice.type === 'VENTE' ? 'Vente' : 'Achat'} color={invoice.type === 'VENTE' ? 'success' : 'info'} variant="outlined" /><Chip size="small" label={invoice.nature === 'BIENS' ? 'Biens' : invoice.nature === 'SERVICES' ? 'Services' : 'Mixte'} /></Stack><Typography variant="body2">{invoice.thirdPartyName}</Typography><Typography variant="caption" color="text.secondary">{shortDate(invoice.invoiceDate)} · échéance {shortDate(invoice.dueDate)}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Net à payer</Typography><Typography sx={{ fontWeight: 900 }}>{money(invoice.netPayable)}</Typography></Box>
        <Stack spacing={.5}><Chip size="small" label={invoiceStatusLabels[invoice.status]} color={statusColor(invoice.status)} variant="outlined" /><Chip size="small" label={settlementStatusLabels[invoice.settlementStatus]} color={invoice.settlementStatus === 'REGLEE' ? 'success' : 'default'} variant="outlined" /></Stack>
        <Box><Typography variant="caption" color="text.secondary">Solde</Typography><Typography sx={{ fontWeight: 900, color: Number(invoice.outstandingAmount) > 0 ? 'warning.dark' : 'success.dark' }}>{money(invoice.outstandingAmount)}</Typography><Typography variant="caption" color="text.secondary">TVA {money(invoice.vatAmount)}</Typography></Box>
        <Stack direction="row" spacing={.5} sx={{ justifyContent: { lg: 'flex-end' }, flexWrap: 'wrap' }}>{canManage && !archived && invoice.status === 'BROUILLON' && <Tooltip title="Modifier"><IconButton onClick={() => { setSelected(invoice); setDialogOpen(true); }}><EditOutlined /></IconButton></Tooltip>}{canValidate && !archived && invoice.status === 'BROUILLON' && <Button size="small" startIcon={<CheckCircleOutlineRounded />} onClick={() => action.mutate({ type: 'validate', invoice })}>Valider</Button>}{canPost && !archived && invoice.status === 'VALIDEE' && <Button size="small" color="success" variant="contained" startIcon={<PostAddRounded />} onClick={() => action.mutate({ type: 'post', invoice })}>Comptabiliser</Button>}</Stack>
      </Box>)}
    </Card>
    {dialogOpen && <InvoiceDialog key={selected?.id ?? 'new'} open={dialogOpen} onClose={() => setDialogOpen(false)} organizationId={organizationId} dossierId={dossierId} invoice={selected} invoices={invoices} parties={parties} accounts={accounts} journals={journals} vatRates={vatRates} withholdingRates={withholdingRates} />}
  </>;
}
