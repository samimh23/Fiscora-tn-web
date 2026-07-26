import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, Skeleton, Stack, Tab, Tabs,
  Tooltip, Typography,
} from '@mui/material';
import {
  AddRounded, ArrowBackRounded, ArchiveOutlined, BusinessOutlined, EditOutlined,
  EmailOutlined, GroupsOutlined, LanguageOutlined, PhoneOutlined, ReceiptLongOutlined,
  ScheduleOutlined, WhatsApp,
  ForumOutlined,
} from '@mui/icons-material';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { AssignmentDialog } from '../features/dossiers/AssignmentDialog';
import { ContactDialog } from '../features/dossiers/ContactDialog';
import { DossierFormDialog } from '../features/dossiers/DossierFormDialog';
import { DossierTasksPanel } from '../features/operations/DossierTasksPanel';
import { DossierObligationsPanel } from '../features/operations/DossierObligationsPanel';
import { DossierDocumentsPanel } from '../features/operations/DossierDocumentsPanel';
import { DossierCommercialPanel } from '../features/commercial/DossierCommercialPanel';
import { DossierAccountingPanel } from '../features/accounting/DossierAccountingPanel';
import { DossierBankReconciliationPanel } from '../features/banking/DossierBankReconciliationPanel';
import { DossierClientMessagesPanel } from '../features/operations/DossierClientMessagesPanel';
import {
  billingFrequencyLabel, dossierStatusLabels, legalFormLabel, taxRegimeLabel,
} from '../features/dossiers/options';
import type {
  DossierAssignment, DossierContact, DossierSummary, OrganizationMember,
} from '../types/api';

const money = (value?: string | null) => value ? new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', minimumFractionDigits: 3 }).format(Number(value)) : '—';

function InfoItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{ fontWeight: 700, mt: .2 }}>{value || '—'}</Typography></Box>;
}

export function DossierDetailPage() {
  const { dossierId = '' } = useParams();
  const { organization, can } = useAuth();
  const organizationId = organization?.id ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<DossierContact | null>(null);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<DossierAssignment | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const dossier = useQuery({
    queryKey: ['dossier', organizationId, dossierId],
    queryFn: () => api.get<DossierSummary>(`/api/organizations/${organizationId}/dossiers/${dossierId}`),
    enabled: Boolean(organizationId && dossierId && can('dossiers.view')),
  });
  const contacts = useQuery({
    queryKey: ['dossier-contacts', organizationId, dossierId],
    queryFn: () => api.get<DossierContact[]>(`/api/organizations/${organizationId}/dossiers/${dossierId}/contacts`),
    enabled: Boolean(organizationId && dossierId && can('dossiers.view')),
  });
  const assignments = useQuery({
    queryKey: ['dossier-assignments', organizationId, dossierId],
    queryFn: () => api.get<DossierAssignment[]>(`/api/organizations/${organizationId}/dossiers/${dossierId}/assignments`),
    enabled: Boolean(organizationId && dossierId && can('dossiers.assign')),
  });
  const members = useQuery({
    queryKey: ['organization-members', organizationId],
    queryFn: () => api.get<OrganizationMember[]>(`/api/organizations/${organizationId}/members`),
    enabled: Boolean(organizationId && can('dossiers.assign') && can('users.view')),
  });

  const archive = useMutation({
    mutationFn: () => api.post<DossierSummary>(`/api/organizations/${organizationId}/dossiers/${dossierId}/archive`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dossiers', organizationId] });
      setArchiveOpen(false);
      navigate('/dossiers');
    },
  });

  if (!can('dossiers.view')) return <Alert severity="error">Vous n’avez pas l’autorisation de consulter les dossiers clients.</Alert>;
  if (dossier.isLoading) return <Box><Skeleton width={220} height={50} /><Skeleton height={170} /><Skeleton height={300} /></Box>;
  if (dossier.isError || !dossier.data) return <Alert severity="error">{dossier.error instanceof ApiError ? dossier.error.message : 'Impossible de charger ce dossier.'}</Alert>;

  const item = dossier.data;
  const archived = item.status === 'ARCHIVE';
  const statusColor = item.status === 'ACTIF' ? 'success' : item.status === 'SUSPENDU' ? 'warning' : 'default';

  return (
    <>
      <Button component={RouterLink} to="/dossiers" startIcon={<ArrowBackRounded />} sx={{ mb: 1 }}>Retour aux dossiers</Button>
      <PageHeader
        eyebrow="Dossier client"
        title={item.legalName}
        description={[item.tradeName, item.taxIdentifier && `MF ${item.taxIdentifier}`, item.activitySector].filter(Boolean).join(' · ') || 'Informations générales du client'}
        action={<Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Chip label={dossierStatusLabels[item.status] ?? item.status} color={statusColor} variant="outlined" />
          {can('dossiers.manage') && !archived && <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setEditOpen(true)}>Modifier</Button>}
          {can('dossiers.create') && !archived && <Button color="error" startIcon={<ArchiveOutlined />} onClick={() => setArchiveOpen(true)}>Archiver</Button>}
        </Stack>}
      />

      <Card sx={{ mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, value: string) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ px: 1 }}>
          <Tab value="overview" label="Vue d’ensemble" icon={<BusinessOutlined />} iconPosition="start" />
          <Tab value="contacts" label={`Contacts (${contacts.data?.length ?? 0})`} icon={<PhoneOutlined />} iconPosition="start" />
          {can('dossiers.assign') && <Tab value="team" label={`Équipe (${assignments.data?.filter((entry) => entry.isActive).length ?? 0})`} icon={<GroupsOutlined />} iconPosition="start" />}
          {can('tasks.view') && <Tab value="tasks" label="Tâches" icon={<ScheduleOutlined />} iconPosition="start" />}
          {can('obligations.view') && <Tab value="obligations" label="Obligations" icon={<LanguageOutlined />} iconPosition="start" />}
          {can('documents.view') && <Tab value="documents" label="Documents" icon={<ReceiptLongOutlined />} iconPosition="start" />}
          {can('client_portal.view') && <Tab value="client-messages" label="Messages client" icon={<ForumOutlined />} iconPosition="start" />}
          {(can('business_invoices.view') || can('third_parties.view') || can('payments.view')) && <Tab value="commercial" label="Achats & ventes" icon={<ReceiptLongOutlined />} iconPosition="start" />}
          {(can('accounting.view') || can('reports.view') || can('declarations.view') || can('period_closing.view')) && <Tab value="accounting" label="Comptabilité" icon={<BusinessOutlined />} iconPosition="start" />}
          {can('bank_reconciliation.view') && <Tab value="banking" label="Banque" icon={<BusinessOutlined />} iconPosition="start" />}
        </Tabs>
      </Card>

      {tab === 'overview' && (
        <Box className="dossier-detail-grid">
          <Stack spacing={2.5}>
            <Card><CardContent sx={{ p: 3 }}>
              <Typography variant="h3" sx={{ fontSize: 24, mb: 2.5 }}>Identité et fiscalité</Typography>
              <Box className="info-grid">
                <InfoItem label="Raison sociale" value={item.legalName} />
                <InfoItem label="Nom commercial" value={item.tradeName} />
                <InfoItem label="Matricule fiscal" value={item.taxIdentifier} />
                <InfoItem label="Numéro RNE" value={item.rneNumber} />
                <InfoItem label="Forme juridique" value={legalFormLabel(item.legalForm)} />
                <InfoItem label="Régime fiscal" value={taxRegimeLabel(item.taxRegime)} />
                <InfoItem label="Code TVA" value={item.vatCode} />
                <InfoItem label="Code en douane" value={item.customsCode} />
                <InfoItem label="Matricule employeur CNSS" value={item.cnssEmployerNumber} />
                <InfoItem label="Effectif déclaré" value={item.employeeCount} />
              </Box>
              <Divider sx={{ my: 2.5 }} />
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Chip label={item.isVatSubject ? 'Assujetti TVA' : 'Non assujetti TVA'} color={item.isVatSubject ? 'success' : 'default'} variant="outlined" />
                {item.hasVatSuspension && <Chip label="Suspension de TVA" color="warning" variant="outlined" />}
                {item.isTotallyExporting && <Chip label="Totalement exportateur" color="info" variant="outlined" />}
                {item.tags.map((tag) => <Chip key={tag} label={tag} size="small" />)}
              </Stack>
            </CardContent></Card>

            <Card><CardContent sx={{ p: 3 }}>
              <Typography variant="h3" sx={{ fontSize: 24, mb: 2.5 }}>Organisation comptable</Typography>
              <Box className="info-grid">
                <InfoItem label="Début de l’exercice" value={`${String(item.fiscalYearStartDay ?? 1).padStart(2, '0')}/${String(item.fiscalYearStartMonth ?? 1).padStart(2, '0')}`} />
                <InfoItem label="Secteur d’activité" value={item.activitySector} />
                <InfoItem label="Honoraires mensuels" value={money(item.monthlyFee)} />
                <InfoItem label="Honoraires annuels" value={money(item.annualFee)} />
                <InfoItem label="Facturation" value={billingFrequencyLabel(item.billingFrequency)} />
              </Box>
              {item.internalNotes && <><Divider sx={{ my: 2.5 }} /><Typography variant="caption" color="text.secondary">Notes internes</Typography><Typography sx={{ whiteSpace: 'pre-wrap', mt: .5 }}>{item.internalNotes}</Typography></>}
            </CardContent></Card>
          </Stack>

          <Stack spacing={2.5}>
            <Card><CardContent sx={{ p: 3 }}><Typography variant="h3" sx={{ fontSize: 22, mb: 2 }}>Accès rapides</Typography><Stack spacing={1}><Button component={RouterLink} to="/documents" variant="outlined" startIcon={<ReceiptLongOutlined />} fullWidth>Documents du client</Button><Button component={RouterLink} to="/obligations" variant="outlined" startIcon={<ScheduleOutlined />} fullWidth>Obligations fiscales</Button><Button component={RouterLink} to="/factures" variant="outlined" startIcon={<LanguageOutlined />} fullWidth>Factures d’achat et vente</Button></Stack></CardContent></Card>
            <Card><CardContent sx={{ p: 3 }}><Typography variant="h3" sx={{ fontSize: 22, mb: 2 }}>Contact principal</Typography>{contacts.isLoading && <Skeleton height={80} />}{!contacts.isLoading && !contacts.data?.find((contact) => contact.isPrimary && contact.isActive) && <Typography variant="body2" color="text.secondary">Aucun contact principal défini.</Typography>}{contacts.data?.filter((contact) => contact.isPrimary && contact.isActive).map((contact) => <Box key={contact.id}><Typography sx={{ fontWeight: 800 }}>{contact.fullName}</Typography><Typography variant="body2" color="text.secondary">{contact.role || 'Contact client'}</Typography>{contact.phone && <Typography variant="body2" sx={{ mt: 1 }}>{contact.phone}</Typography>}{contact.email && <Typography variant="body2">{contact.email}</Typography>}</Box>)}</CardContent></Card>
          </Stack>
        </Box>
      )}

      {tab === 'contacts' && (
        <Card><CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}><Box><Typography variant="h3" sx={{ fontSize: 24 }}>Contacts du client</Typography><Typography variant="body2" color="text.secondary">Dirigeants et interlocuteurs administratifs.</Typography></Box>{can('dossiers.contacts.manage') && !archived && <Button variant="contained" startIcon={<AddRounded />} onClick={() => { setSelectedContact(null); setContactOpen(true); }}>Ajouter</Button>}</Box>
          {contacts.isError && <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>Impossible de charger les contacts.</Alert>}
          {contacts.isLoading && <Box sx={{ p: 2.5 }}><Skeleton height={80} /><Skeleton height={80} /></Box>}
          {!contacts.isLoading && !contacts.data?.length && <Box sx={{ p: 6, textAlign: 'center' }}><PhoneOutlined sx={{ fontSize: 40, color: 'text.disabled' }} /><Typography sx={{ fontWeight: 800, mt: 1 }}>Aucun contact</Typography><Typography variant="body2" color="text.secondary">Ajoutez le gérant ou votre interlocuteur principal.</Typography></Box>}
          {contacts.data?.map((contact) => <Box key={contact.id} sx={{ px: 3, py: 2.2, borderTop: '1px solid', borderColor: 'divider', opacity: contact.isActive ? 1 : .55, display: 'flex', gap: 2, alignItems: 'center' }}><Box sx={{ width: 44, height: 44, bgcolor: contact.isPrimary ? 'secondary.main' : 'primary.light', color: contact.isPrimary ? '#fff' : 'primary.main', borderRadius: 3, display: 'grid', placeItems: 'center', fontWeight: 800 }}>{contact.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</Box><Box sx={{ flex: 1, minWidth: 0 }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Typography sx={{ fontWeight: 800 }}>{contact.fullName}</Typography>{contact.isPrimary && <Chip label="Principal" size="small" color="secondary" />}{!contact.isActive && <Chip label="Inactif" size="small" />}</Box><Typography variant="body2" color="text.secondary">{contact.role || 'Contact client'}</Typography><Stack direction="row" spacing={2} sx={{ mt: .6, flexWrap: 'wrap' }}>{contact.phone && <Typography variant="caption"><PhoneOutlined sx={{ fontSize: 14, verticalAlign: 'middle', mr: .5 }} />{contact.phone}</Typography>}{contact.email && <Typography variant="caption"><EmailOutlined sx={{ fontSize: 14, verticalAlign: 'middle', mr: .5 }} />{contact.email}</Typography>}{contact.whatsappNumber && <Typography variant="caption"><WhatsApp sx={{ fontSize: 14, verticalAlign: 'middle', mr: .5 }} />{contact.whatsappNumber}</Typography>}</Stack></Box>{can('dossiers.contacts.manage') && !archived && <Tooltip title="Modifier"><IconButton onClick={() => { setSelectedContact(contact); setContactOpen(true); }}><EditOutlined /></IconButton></Tooltip>}</Box>)}
        </CardContent></Card>
      )}

      {tab === 'team' && can('dossiers.assign') && (
        <Card><CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}><Box><Typography variant="h3" sx={{ fontSize: 24 }}>Équipe affectée</Typography><Typography variant="body2" color="text.secondary">Responsabilités et budget mensuel par collaborateur.</Typography></Box>{!archived && <Button variant="contained" startIcon={<AddRounded />} onClick={() => { setSelectedAssignment(null); setAssignmentOpen(true); }}>Affecter</Button>}</Box>
          {assignments.isError && <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>Impossible de charger les affectations.</Alert>}
          {assignments.isLoading && <Box sx={{ p: 2.5 }}><Skeleton height={80} /><Skeleton height={80} /></Box>}
          {!assignments.isLoading && !assignments.data?.length && <Box sx={{ p: 6, textAlign: 'center' }}><GroupsOutlined sx={{ fontSize: 42, color: 'text.disabled' }} /><Typography sx={{ fontWeight: 800, mt: 1 }}>Aucun collaborateur affecté</Typography><Typography variant="body2" color="text.secondary">Affectez un responsable et, si nécessaire, des personnes en support.</Typography></Box>}
          {assignments.data?.map((assignment) => <Box key={assignment.id} sx={{ px: 3, py: 2.2, borderTop: '1px solid', borderColor: 'divider', opacity: assignment.isActive ? 1 : .55, display: 'flex', gap: 2, alignItems: 'center' }}><Box sx={{ width: 44, height: 44, bgcolor: 'primary.main', color: '#fff', borderRadius: 3, display: 'grid', placeItems: 'center', fontWeight: 800 }}>{assignment.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</Box><Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 800 }}>{assignment.fullName}</Typography><Typography variant="body2" color="text.secondary">{assignment.email} · {assignment.cabinetRole}</Typography></Box><Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}><Chip label={assignment.assignmentRole === 'RESPONSABLE' ? 'Responsable' : 'Support'} size="small" color={assignment.assignmentRole === 'RESPONSABLE' ? 'primary' : 'default'} /><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .5 }}>{((assignment.monthlyTimeBudgetMinutes ?? 0) / 60).toFixed(2)} h / mois</Typography></Box>{!archived && <Tooltip title="Modifier"><IconButton onClick={() => { setSelectedAssignment(assignment); setAssignmentOpen(true); }}><EditOutlined /></IconButton></Tooltip>}</Box>)}
        </CardContent></Card>
      )}

      {tab === 'tasks' && can('tasks.view') && (
        <DossierTasksPanel
          organizationId={organizationId}
          dossierId={dossierId}
          assignments={assignments.data ?? []}
          archived={archived}
          canManage={can('tasks.manage')}
          canAssign={can('tasks.assign')}
          canValidate={can('tasks.validate')}
        />
      )}

      {tab === 'obligations' && can('obligations.view') && (
        <DossierObligationsPanel
          organizationId={organizationId}
          dossierId={dossierId}
          archived={archived}
          canManage={can('obligations.manage')}
          canValidate={can('obligations.validate')}
          canFile={can('obligations.file')}
        />
      )}

      {tab === 'documents' && can('documents.view') && (
        <DossierDocumentsPanel
          organizationId={organizationId}
          dossierId={dossierId}
          archived={archived}
          canUpload={can('documents.upload')}
        />
      )}

      {tab === 'client-messages' && can('client_portal.view') && (
        <DossierClientMessagesPanel organizationId={organizationId} dossierId={dossierId} />
      )}

      {tab === 'commercial' && (can('business_invoices.view') || can('third_parties.view') || can('payments.view')) && (
        <DossierCommercialPanel
          organizationId={organizationId}
          dossierId={dossierId}
          archived={archived}
          canThirdPartiesView={can('third_parties.view')}
          canThirdPartiesManage={can('third_parties.manage')}
          canInvoicesView={can('business_invoices.view')}
          canInvoicesManage={can('business_invoices.manage')}
          canInvoicesValidate={can('business_invoices.validate')}
          canAccountingView={can('accounting.view')}
          canAccountingPost={can('accounting.post')}
          canAccountsView={can('chart_of_accounts.view')}
          canFiscalSettingsView={can('fiscal_settings.view')}
          canPaymentsView={can('payments.view')}
          canPaymentsManage={can('payments.manage')}
        />
      )}

      {tab === 'accounting' && (can('accounting.view') || can('reports.view') || can('declarations.view') || can('period_closing.view')) && (
        <DossierAccountingPanel
          organizationId={organizationId}
          dossierId={dossierId}
          archived={archived}
          canAccountingView={can('accounting.view')}
          canAccountingManage={can('accounting.manage')}
          canAccountingPost={can('accounting.post')}
          canAccountsView={can('chart_of_accounts.view')}
          canReportsView={can('reports.view')}
          canDeclarationsView={can('declarations.view')}
          canDeclarationsManage={can('declarations.manage')}
          canDeclarationsValidate={can('declarations.validate')}
          canInvoicesView={can('business_invoices.view')}
          canPeriodView={can('period_closing.view')}
          canPeriodValidate={can('period_closing.validate')}
        />
      )}

      {tab === 'banking' && can('bank_reconciliation.view') && (
        <DossierBankReconciliationPanel
          organizationId={organizationId}
          dossierId={dossierId}
          archived={archived}
          canManage={can('bank_reconciliation.manage')}
          canValidate={can('bank_reconciliation.validate')}
          canAccountsView={can('chart_of_accounts.view')}
          canAccountingView={can('accounting.view')}
          canAccountingPost={can('accounting.post')}
          canPaymentsView={can('payments.view')}
        />
      )}

      <DossierFormDialog open={editOpen} onClose={() => setEditOpen(false)} organizationId={organizationId} dossier={item} />
      <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} organizationId={organizationId} dossierId={dossierId} contact={selectedContact} />
      <AssignmentDialog open={assignmentOpen} onClose={() => setAssignmentOpen(false)} organizationId={organizationId} dossierId={dossierId} members={members.data ?? []} assignment={selectedAssignment} />

      <Dialog open={archiveOpen} onClose={archive.isPending ? undefined : () => setArchiveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Archiver ce dossier ?</DialogTitle>
        <DialogContent><Typography>Le dossier <strong>{item.legalName}</strong> deviendra en lecture seule. Son historique restera conservé.</Typography>{archive.isError && <Alert severity="error" sx={{ mt: 2 }}>{archive.error instanceof ApiError ? archive.error.message : 'Impossible d’archiver le dossier.'}</Alert>}</DialogContent>
        <DialogActions><Button onClick={() => setArchiveOpen(false)} disabled={archive.isPending}>Annuler</Button><Button color="error" variant="contained" onClick={() => archive.mutate()} disabled={archive.isPending}>{archive.isPending ? 'Archivage…' : 'Archiver'}</Button></DialogActions>
      </Dialog>
    </>
  );
}
