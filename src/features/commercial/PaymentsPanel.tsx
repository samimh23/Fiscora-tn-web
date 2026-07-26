import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, Checkbox, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, MenuItem, Skeleton, Stack,
  TextField, Typography,
} from '@mui/material';
import { AddRounded, AccountBalanceWalletOutlined, PostAddRounded } from '@mui/icons-material';
import { api, ApiError } from '../../api/client';
import type { AccountingJournal, BusinessInvoice, LedgerAccount, ThirdParty, ThirdPartyPayment } from '../../types/api';
import { money, paymentStatusLabels, shortDate } from './options';

type AllocationMap = Record<string, string>;

function PaymentDialog({ open, onClose, organizationId, dossierId, parties, invoices, accounts, journals }: {
  open: boolean; onClose: () => void; organizationId: string; dossierId: string; parties: ThirdParty[];
  invoices: BusinessInvoice[]; accounts: LedgerAccount[]; journals: AccountingJournal[];
}) {
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<'ENCAISSEMENT' | 'DECAISSEMENT'>('ENCAISSEMENT');
  const [thirdPartyId, setThirdPartyId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('Virement');
  const [reference, setReference] = useState('');
  const [journalId, setJournalId] = useState('');
  const [cashAccountId, setCashAccountId] = useState('');
  const [thirdPartyAccountId, setThirdPartyAccountId] = useState('');
  const [allocations, setAllocations] = useState<AllocationMap>({});
  const [error, setError] = useState('');
  const receipt = direction === 'ENCAISSEMENT';
  const availableParties = parties.filter((party) => party.type === 'CLIENT_ET_FOURNISSEUR' || (receipt ? party.type === 'CLIENT' : party.type === 'FOURNISSEUR'));
  const openInvoices = invoices.filter((invoice) => invoice.kind === 'FACTURE' && invoice.status === 'COMPTABILISEE' && invoice.type === (receipt ? 'VENTE' : 'ACHAT') && invoice.thirdPartyId === thirdPartyId && Number(invoice.outstandingAmount) > 0);
  const paymentJournals = journals.filter((journal) => ['BANQUE', 'CAISSE'].includes(journal.type));
  const postingAccounts = accounts.filter((account) => account.isActive && account.allowsPosting);
  const total = useMemo(() => Object.values(allocations).reduce((sum, value) => sum + (Number(value) || 0), 0), [allocations]);
  const changeDirection = (value: 'ENCAISSEMENT' | 'DECAISSEMENT') => { setDirection(value); setThirdPartyId(''); setThirdPartyAccountId(''); setAllocations({}); };
  const changeParty = (id: string) => {
    const party = parties.find((entry) => entry.id === id);
    setThirdPartyId(id); setThirdPartyAccountId(party ? (receipt ? party.receivableAccountId : party.payableAccountId) ?? '' : ''); setAllocations({});
  };
  const toggleInvoice = (invoice: BusinessInvoice, checked: boolean) => setAllocations((current) => {
    const next = { ...current };
    if (checked) next[invoice.id] = invoice.outstandingAmount;
    else delete next[invoice.id];
    return next;
  });
  const mutation = useMutation({
    mutationFn: () => api.post<ThirdPartyPayment>(`/api/organizations/${organizationId}/dossiers/${dossierId}/payments`, {
      thirdPartyId, direction, paymentDate, amount: total.toFixed(3), method: method.trim(),
      reference: reference.trim() || undefined, journalId, cashAccountId, thirdPartyAccountId,
      allocations: Object.entries(allocations).map(([invoiceId, amount]) => ({ invoiceId, amount })),
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['third-party-payments', organizationId, dossierId] }); onClose(); },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : 'Impossible d’enregistrer le règlement.'),
  });
  const valid = Boolean(thirdPartyId && paymentDate && method.trim() && journalId && cashAccountId && thirdPartyAccountId && total > 0 && Object.keys(allocations).length);

  return <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="md">
    <DialogTitle>Nouveau règlement</DialogTitle>
    <DialogContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, pt: '12px !important' }}>
      {error && <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>{error}</Alert>}
      <TextField select label="Opération" value={direction} onChange={(event) => changeDirection(event.target.value as typeof direction)}><MenuItem value="ENCAISSEMENT">Encaissement client</MenuItem><MenuItem value="DECAISSEMENT">Décaissement fournisseur</MenuItem></TextField>
      <TextField select label={receipt ? 'Client' : 'Fournisseur'} value={thirdPartyId} onChange={(event) => changeParty(event.target.value)}><MenuItem value="">Sélectionner…</MenuItem>{availableParties.map((party) => <MenuItem key={party.id} value={party.id}>{party.name}</MenuItem>)}</TextField>
      <TextField label="Date" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField select label="Mode" value={method} onChange={(event) => setMethod(event.target.value)}><MenuItem value="Virement">Virement</MenuItem><MenuItem value="Chèque">Chèque</MenuItem><MenuItem value="Espèces">Espèces</MenuItem><MenuItem value="Traite">Traite</MenuItem><MenuItem value="Carte bancaire">Carte bancaire</MenuItem></TextField>
      <TextField label="Référence" value={reference} onChange={(event) => setReference(event.target.value)} />
      <TextField select label="Journal banque / caisse" value={journalId} onChange={(event) => setJournalId(event.target.value)}><MenuItem value="">Sélectionner…</MenuItem>{paymentJournals.map((journal) => <MenuItem key={journal.id} value={journal.id}>{journal.code} — {journal.name}</MenuItem>)}</TextField>
      <TextField select label="Compte banque / caisse" value={cashAccountId} onChange={(event) => setCashAccountId(event.target.value)}><MenuItem value="">Sélectionner…</MenuItem>{postingAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.code} — {account.name}</MenuItem>)}</TextField>
      <TextField select label="Compte tiers" value={thirdPartyAccountId} onChange={(event) => setThirdPartyAccountId(event.target.value)}><MenuItem value="">Sélectionner…</MenuItem>{postingAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.code} — {account.name}</MenuItem>)}</TextField>
      <Box sx={{ gridColumn: '1 / -1', mt: 1 }}><Typography sx={{ fontWeight: 900, mb: 1 }}>Affectation aux factures</Typography>{!thirdPartyId && <Typography variant="body2" color="text.secondary">Sélectionnez d’abord un tiers.</Typography>}{thirdPartyId && !openInvoices.length && <Alert severity="info">Aucune facture comptabilisée avec un solde ouvert pour ce tiers.</Alert>}<Stack spacing={1}>{openInvoices.map((invoice) => {
        const checked = allocations[invoice.id] !== undefined;
        return <Card key={invoice.id} variant="outlined" sx={{ px: 2, py: 1.3, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(220px, 1fr) 160px 150px' }, gap: 1.5, alignItems: 'center' }}><FormControlLabel control={<Checkbox checked={checked} onChange={(event) => toggleInvoice(invoice, event.target.checked)} />} label={<Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{invoice.number} — {shortDate(invoice.invoiceDate)}</Typography><Typography variant="caption" color="text.secondary">Net {money(invoice.netPayable)}</Typography></Box>} /><Box><Typography variant="caption" color="text.secondary">Solde ouvert</Typography><Typography sx={{ fontWeight: 800 }}>{money(invoice.outstandingAmount)}</Typography></Box><TextField size="small" label="Montant affecté" value={allocations[invoice.id] ?? ''} disabled={!checked} onChange={(event) => setAllocations((current) => ({ ...current, [invoice.id]: event.target.value }))} /></Card>;
      })}</Stack></Box>
      <Card sx={{ gridColumn: '1 / -1', p: 2.2, bgcolor: 'primary.light', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Typography sx={{ fontWeight: 800 }}>Montant total du règlement</Typography><Typography variant="h3" sx={{ fontSize: 25, color: 'primary.dark' }}>{money(total)}</Typography></Card>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Annuler</Button><Button variant="contained" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Enregistrement…' : 'Créer le règlement'}</Button></DialogActions>
  </Dialog>;
}

export function PaymentsPanel({ organizationId, dossierId, payments, parties, invoices, accounts, journals, loading, archived, canManage, canPost }: {
  organizationId: string; dossierId: string; payments: ThirdPartyPayment[]; parties: ThirdParty[]; invoices: BusinessInvoice[]; accounts: LedgerAccount[]; journals: AccountingJournal[];
  loading: boolean; archived: boolean; canManage: boolean; canPost: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const post = useMutation({
    mutationFn: (payment: ThirdPartyPayment) => api.post<ThirdPartyPayment>(`/api/organizations/${organizationId}/dossiers/${dossierId}/payments/${payment.id}/post`),
    onSuccess: async () => { setError(''); await Promise.all([queryClient.invalidateQueries({ queryKey: ['third-party-payments', organizationId, dossierId] }), queryClient.invalidateQueries({ queryKey: ['business-invoices', organizationId, dossierId] }), queryClient.invalidateQueries({ queryKey: ['third-parties', organizationId, dossierId] })]); },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : 'Comptabilisation impossible.'),
  });
  return <>
    <Card><Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}><Box><Typography variant="h3" sx={{ fontSize: 24 }}>Règlements clients et fournisseurs</Typography><Typography variant="body2" color="text.secondary">Encaissements, décaissements et lettrage des factures.</Typography></Box>{canManage && !archived && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setOpen(true)}>Nouveau règlement</Button>}</Box>
      {error && <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ p: 2.5 }}><Skeleton height={80} /><Skeleton height={80} /></Box>}
      {!loading && payments.length === 0 && <Box sx={{ p: 6, textAlign: 'center' }}><AccountBalanceWalletOutlined sx={{ fontSize: 46, color: 'text.disabled' }} /><Typography sx={{ fontWeight: 800, mt: 1 }}>Aucun règlement</Typography><Typography variant="body2" color="text.secondary">Les règlements seront affectés aux factures comptabilisées.</Typography></Box>}
      {payments.map((payment) => <Box key={payment.id} sx={{ px: 3, py: 2.2, borderTop: '1px solid', borderColor: 'divider', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(230px, 1fr) 155px 180px auto' }, gap: 2, alignItems: 'center' }}><Box><Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}><Typography sx={{ fontWeight: 900 }}>{payment.thirdParty.name}</Typography><Chip size="small" label={payment.direction === 'ENCAISSEMENT' ? 'Encaissement' : 'Décaissement'} color={payment.direction === 'ENCAISSEMENT' ? 'success' : 'warning'} variant="outlined" /></Stack><Typography variant="caption" color="text.secondary">{shortDate(payment.paymentDate)} · {payment.method}{payment.reference ? ` · ${payment.reference}` : ''}</Typography></Box><Box><Typography variant="caption" color="text.secondary">Montant</Typography><Typography sx={{ fontWeight: 900 }}>{money(payment.amount)}</Typography></Box><Box><Chip size="small" label={paymentStatusLabels[payment.status]} color={payment.status === 'COMPTABILISE' ? 'success' : 'warning'} variant="outlined" /><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .5 }}>{payment.allocations.length} facture(s) affectée(s)</Typography></Box>{canPost && !archived && payment.status === 'BROUILLON' && <Button size="small" color="success" variant="contained" startIcon={<PostAddRounded />} onClick={() => post.mutate(payment)}>Comptabiliser</Button>}</Box>)}
    </Card>
    {open && <PaymentDialog open={open} onClose={() => setOpen(false)} organizationId={organizationId} dossierId={dossierId} parties={parties} invoices={invoices} accounts={accounts} journals={journals} />}
  </>;
}
