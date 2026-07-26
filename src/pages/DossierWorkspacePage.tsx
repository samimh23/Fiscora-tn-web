import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Skeleton } from '@mui/material';
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
  tasks: { eyebrow: 'Pilotage du travail', title: 'Tâches', description: 'Planifiez, affectez et validez le travail du dossier sélectionné.' },
  obligations: { eyebrow: 'Calendrier fiscal', title: 'Obligations', description: 'Préparez, validez, déposez et suivez les échéances du client.' },
  documents: { eyebrow: 'Pièces comptables', title: 'Documents', description: 'Centralisez les fichiers reçus et contrôlez les pièces manquantes.' },
  commercial: { eyebrow: 'Cycle commercial', title: 'Achats & ventes', description: 'Gérez les tiers, factures, avoirs, règlements et écritures générées.' },
  banking: { eyebrow: 'Trésorerie', title: 'Banque', description: 'Importez les relevés et rapprochez les mouvements avec la comptabilité.' },
  declarations: { eyebrow: 'Fiscalité périodique', title: 'Déclarations', description: 'Préparez la déclaration mensuelle depuis les factures comptabilisées.' },
};

export function DossierWorkspacePage({ module }: { module: WorkspaceModule }) {
  const { organization, can } = useAuth();
  const organizationId = organization?.id ?? '';
  const [dossierId, setDossierId] = useState('');
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
    <PageHeader eyebrow={heading.eyebrow} title={heading.title} description={heading.description} action={<DossierSelector value={dossierId} onChange={setDossierId} />} />
    {!dossierId && <Alert severity="info">Choisissez un dossier client pour commencer.</Alert>}
    {dossier.isLoading && <Box><Skeleton height={90} /><Skeleton height={260} /></Box>}
    {dossier.isError && <Alert severity="error">Impossible de charger le dossier sélectionné.</Alert>}
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
