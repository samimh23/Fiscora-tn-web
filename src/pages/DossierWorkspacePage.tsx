import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider, Skeleton, Stack, Typography,
} from '@mui/material';
import {
  AccountBalanceOutlined, ArticleOutlined, AssignmentTurnedInOutlined, BusinessRounded,
  CalendarMonthRounded, DescriptionOutlined, ReceiptLongOutlined, ShieldOutlined,
} from '@mui/icons-material';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DossierSelector } from '../components/WorkspaceTools';
import { PageHeader } from '../components/PageHeader';
import { DossierTasksPanel } from '../features/operations/DossierTasksPanel';
import { DossierObligationsPanel } from '../features/operations/DossierObligationsPanel';
import { DossierDocumentsPanel } from '../features/operations/DossierDocumentsPanel';
import { DossierCommercialPanel } from '../features/commercial/DossierCommercialPanel';
import { DossierBankReconciliationPanel } from '../features/banking/DossierBankReconciliationPanel';
import { DossierAccountingPanel } from '../features/accounting/DossierAccountingPanel';
import type { DossierAssignment, DossierSummary } from '../types/api';

type WorkspaceModule = 'tasks' | 'obligations' | 'documents' | 'commercial' | 'banking' | 'declarations';

const headings: Record<WorkspaceModule, { eyebrow: string; title: string; description: string }> = {
  tasks: {
    eyebrow: 'Pilotage du travail',
    title: 'Tâches',
    description: 'Planifiez, affectez et validez le travail du dossier sélectionné.',
  },
  obligations: {
    eyebrow: 'Calendrier fiscal',
    title: 'Obligations',
    description: 'Préparez, validez, déposez et suivez les échéances du client.',
  },
  documents: {
    eyebrow: 'Pièces comptables',
    title: 'Documents',
    description: 'Centralisez les fichiers reçus et contrôlez les pièces manquantes.',
  },
  commercial: {
    eyebrow: 'Cycle commercial',
    title: 'Achats & ventes',
    description: 'Gérez les tiers, factures, avoirs, règlements et écritures générées.',
  },
  banking: {
    eyebrow: 'Trésorerie',
    title: 'Banque',
    description: 'Importez les relevés et rapprochez les mouvements avec la comptabilité.',
  },
  declarations: {
    eyebrow: 'Fiscalité périodique',
    title: 'Déclarations',
    description: 'Préparez la déclaration mensuelle depuis les factures comptabilisées.',
  },
};

const moduleSteps: Record<WorkspaceModule, string[]> = {
  tasks: ['Créer le travail', 'Affecter', 'Valider'],
  obligations: ['Préparer', 'Réviser', 'Déposer'],
  documents: ['Collecter', 'Contrôler', 'Classer'],
  commercial: ['Saisir', 'Valider', 'Comptabiliser'],
  banking: ['Importer', 'Matcher', 'Valider'],
  declarations: ['Calculer', 'Contrôler', 'Déclarer'],
};

function statusLabel(status: string) {
  if (status === 'ACTIVE') return 'Actif';
  if (status === 'ARCHIVE') return 'Archivé';
  return status;
}

function DossierContextCard({ dossier, module }: { dossier: DossierSummary; module: WorkspaceModule }) {
  const steps = moduleSteps[module];
  const quickLinks = [
    { label: 'Fiche dossier', icon: <BusinessRounded />, to: `/dossiers/${dossier.id}` },
    { label: 'Documents', icon: <ArticleOutlined />, to: `/documents?dossierId=${dossier.id}` },
    { label: 'Factures', icon: <ReceiptLongOutlined />, to: `/factures?dossierId=${dossier.id}` },
    { label: 'Banque', icon: <AccountBalanceOutlined />, to: `/banque?dossierId=${dossier.id}` },
    { label: 'Qualité', icon: <ShieldOutlined />, to: `/qualite?dossierId=${dossier.id}` },
  ];

  return (
    <Card sx={{ mb: 2.5 }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(320px, .75fr)' },
            gap: 2,
            alignItems: 'center',
          }}
        >
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
              <Chip label={statusLabel(dossier.status)} color={dossier.status === 'ACTIVE' ? 'success' : 'default'} size="small" />
              <Chip label={dossier.legalForm || 'Forme non renseignée'} size="small" variant="outlined" />
              {dossier.isVatSubject && <Chip label="TVA" size="small" variant="outlined" />}
              {dossier.hasVatSuspension && <Chip label="Suspension TVA" size="small" variant="outlined" />}
              {dossier.isTotallyExporting && <Chip label="Export total" size="small" variant="outlined" />}
            </Stack>
            <Typography variant="h3" sx={{ fontSize: { xs: 24, md: 30 }, lineHeight: 1.1 }}>
              {dossier.legalName}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: .75 }}>
              {[dossier.tradeName, dossier.taxIdentifier && `MF ${dossier.taxIdentifier}`, dossier.activitySector]
                .filter(Boolean)
                .join(' · ') || 'Informations administratives à compléter'}
            </Typography>
          </Box>

          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              p: 1.5,
              bgcolor: '#fbfaf6',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: '.08em' }}>
              FLUX DE TRAVAIL
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              {steps.map((step, index) => (
                <Chip
                  key={step}
                  icon={index === 0 ? <DescriptionOutlined /> : index === 1 ? <AssignmentTurnedInOutlined /> : <CalendarMonthRounded />}
                  label={`${index + 1}. ${step}`}
                  variant={index === 0 ? 'filled' : 'outlined'}
                  color={index === 0 ? 'primary' : 'default'}
                  size="small"
                />
              ))}
            </Stack>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {quickLinks.map((link) => (
            <Button
              key={link.label}
              component={RouterLink}
              to={link.to}
              size="small"
              variant="outlined"
              startIcon={link.icon}
              sx={{ borderColor: 'divider', bgcolor: '#fffdf8' }}
            >
              {link.label}
            </Button>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

function NoDossierState() {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }}>
        <BusinessRounded sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="h3" sx={{ fontSize: 28 }}>Choisissez un dossier pour démarrer</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 620, mx: 'auto' }}>
          Toutes les actions de production sont liées à un client précis. Sélectionnez un dossier en haut de l’écran pour afficher son contexte, ses tâches et les prochaines étapes.
        </Typography>
      </CardContent>
    </Card>
  );
}

export function DossierWorkspacePage({ module }: { module: WorkspaceModule }) {
  const { organization, can } = useAuth();
  const organizationId = organization?.id ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const [dossierId, setDossierId] = useState(searchParams.get('dossierId') ?? '');
  useEffect(() => {
    setDossierId(searchParams.get('dossierId') ?? '');
  }, [searchParams]);
  const handleDossierChange = (value: string) => {
    setDossierId(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('dossierId', value);
    else next.delete('dossierId');
    setSearchParams(next, { replace: true });
  };
  const dossier = useQuery({
    queryKey: ['dossier', organizationId, dossierId],
    queryFn: () => api.get<DossierSummary>(`/api/organizations/${organizationId}/dossiers/${dossierId}`),
    enabled: Boolean(organizationId && dossierId),
  });
  const assignments = useQuery({
    queryKey: ['dossier-assignments', organizationId, dossierId],
    queryFn: () => api.get<DossierAssignment[]>(`/api/organizations/${organizationId}/dossiers/${dossierId}/assignments`),
    enabled: Boolean(organizationId && dossierId && module === 'tasks' && can('dossiers.assign')),
  });
  const heading = headings[module];
  const archived = dossier.data?.status === 'ARCHIVE';

  return <>
    <PageHeader eyebrow={heading.eyebrow} title={heading.title} description={heading.description} action={<DossierSelector value={dossierId} onChange={handleDossierChange} />} />
    {!dossierId && <NoDossierState />}
    {dossier.isLoading && <Box><Skeleton height={130} /><Skeleton height={260} sx={{ mt: 2 }} /></Box>}
    {dossier.isError && <Alert severity="error">Impossible de charger le dossier sélectionné.</Alert>}
    {dossier.data && <DossierContextCard dossier={dossier.data} module={module} />}
    {dossier.data && module === 'tasks' && <DossierTasksPanel
      organizationId={organizationId} dossierId={dossierId} assignments={assignments.data ?? []} archived={archived}
      canManage={can('tasks.manage')} canAssign={can('tasks.assign')} canValidate={can('tasks.validate')}
    />}
    {dossier.data && module === 'obligations' && <DossierObligationsPanel
      organizationId={organizationId} dossierId={dossierId} archived={archived}
      canManage={can('obligations.manage')} canValidate={can('obligations.validate')} canFile={can('obligations.file')}
    />}
    {dossier.data && module === 'documents' && <DossierDocumentsPanel
      organizationId={organizationId} dossierId={dossierId} archived={archived} canUpload={can('documents.upload')}
    />}
    {dossier.data && module === 'commercial' && <DossierCommercialPanel
      organizationId={organizationId} dossierId={dossierId} archived={archived}
      canThirdPartiesView={can('third_parties.view')} canThirdPartiesManage={can('third_parties.manage')}
      canInvoicesView={can('business_invoices.view')} canInvoicesManage={can('business_invoices.manage')}
      canInvoicesValidate={can('business_invoices.validate')} canAccountingView={can('accounting.view')}
      canAccountingPost={can('accounting.post')} canAccountsView={can('chart_of_accounts.view')}
      canFiscalSettingsView={can('fiscal_settings.view')} canPaymentsView={can('payments.view')}
      canPaymentsManage={can('payments.manage')}
    />}
    {dossier.data && module === 'banking' && <DossierBankReconciliationPanel
      organizationId={organizationId} dossierId={dossierId} archived={archived}
      canManage={can('bank_reconciliation.manage')} canValidate={can('bank_reconciliation.validate')}
      canAccountsView={can('chart_of_accounts.view')} canAccountingView={can('accounting.view')}
      canAccountingPost={can('accounting.post')} canPaymentsView={can('payments.view')}
    />}
    {dossier.data && module === 'declarations' && <DossierAccountingPanel
      organizationId={organizationId} dossierId={dossierId} archived={archived} initialTab="tax"
      canAccountingView={can('accounting.view')} canAccountingManage={can('accounting.manage')}
      canAccountingPost={can('accounting.post')} canAccountsView={can('chart_of_accounts.view')}
      canReportsView={can('reports.view')} canDeclarationsView={can('declarations.view')}
      canDeclarationsManage={can('declarations.manage')} canDeclarationsValidate={can('declarations.validate')}
      canInvoicesView={can('business_invoices.view')} canPeriodView={can('period_closing.view')}
      canPeriodValidate={can('period_closing.validate')}
    />}
  </>;
}
