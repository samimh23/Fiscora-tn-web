import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Card, Tab, Tabs } from '@mui/material';
import {
  AccountBalanceOutlined, CalculateOutlined, LinkRounded, LockOutlined,
  MenuBookOutlined, SwapVertRounded,
} from '@mui/icons-material';
import { api } from '../../api/client';
import type { AccountingJournal, JournalEntry, LedgerAccount } from '../../types/api';
import { EntriesPanel } from './EntriesPanel';
import { JournalsPanel } from './JournalsPanel';
import { PeriodClosingPanel } from './PeriodClosingPanel';
import { ReconciliationsPanel } from './ReconciliationsPanel';
import { ReportsPanel } from './ReportsPanel';
import { VatDeclarationsPanel } from './VatDeclarationsPanel';

type AccountingTab = 'entries' | 'journals' | 'reconciliations' | 'reports' | 'tax' | 'periods';

export function DossierAccountingPanel(props: {
  organizationId: string; dossierId: string; archived: boolean;
  canAccountingView: boolean; canAccountingManage: boolean; canAccountingPost: boolean;
  canAccountsView: boolean; canReportsView: boolean; canDeclarationsView: boolean;
  canDeclarationsManage: boolean; canDeclarationsValidate: boolean; canInvoicesView: boolean;
  canPeriodView: boolean; canPeriodValidate: boolean; initialTab?: AccountingTab;
}) {
  const {
    organizationId, dossierId, archived, canAccountingView, canAccountingManage,
    canAccountingPost, canAccountsView, canReportsView, canDeclarationsView,
    canDeclarationsManage, canDeclarationsValidate, canInvoicesView,
    canPeriodView, canPeriodValidate,
  } = props;
  const initial = props.initialTab ?? (canAccountingView ? 'entries' : canReportsView ? 'reports' : canDeclarationsView ? 'tax' : 'periods');
  const [tab, setTab] = useState<AccountingTab>(initial);
  const base = `/api/organizations/${organizationId}/dossiers/${dossierId}`;
  const journals = useQuery({
    queryKey: ['journals', organizationId, dossierId],
    queryFn: () => api.get<AccountingJournal[]>(`${base}/journals`), enabled: canAccountingView,
  });
  const entries = useQuery({
    queryKey: ['journal-entries', organizationId, dossierId],
    queryFn: () => api.get<JournalEntry[]>(`${base}/entries`), enabled: canAccountingView,
  });
  const accounts = useQuery({
    queryKey: ['ledger-accounts', organizationId, dossierId],
    queryFn: () => api.get<LedgerAccount[]>(`${base}/ledger-accounts`), enabled: canAccountsView,
  });

  return <Box>
    <Card sx={{ mb: 2 }}><Tabs value={tab} onChange={(_, value: AccountingTab) => setTab(value)} variant="scrollable" scrollButtons="auto">
      {canAccountingView && <Tab value="entries" label={`Écritures (${entries.data?.length ?? 0})`} icon={<SwapVertRounded />} iconPosition="start" />}
      {canAccountingView && <Tab value="journals" label={`Journaux (${journals.data?.length ?? 0})`} icon={<MenuBookOutlined />} iconPosition="start" />}
      {canAccountingView && <Tab value="reconciliations" label="Lettrage" icon={<LinkRounded />} iconPosition="start" />}
      {canReportsView && <Tab value="reports" label="États comptables" icon={<AccountBalanceOutlined />} iconPosition="start" />}
      {canDeclarationsView && <Tab value="tax" label="Déclaration mensuelle" icon={<CalculateOutlined />} iconPosition="start" />}
      {canPeriodView && <Tab value="periods" label="Clôture" icon={<LockOutlined />} iconPosition="start" />}
    </Tabs></Card>
    {!canAccountsView && (canAccountingManage || canPeriodValidate) && <Alert severity="warning" sx={{ mb: 2 }}>L’accès au plan comptable du dossier est requis.</Alert>}
    {tab === 'entries' && canAccountingView && <EntriesPanel organizationId={organizationId} dossierId={dossierId}
      entries={entries.data ?? []} journals={journals.data ?? []} accounts={accounts.data ?? []}
      loading={entries.isLoading || journals.isLoading || accounts.isLoading} archived={archived}
      canManage={canAccountingManage && canAccountsView} canPost={canAccountingPost} />}
    {tab === 'journals' && canAccountingView && <JournalsPanel organizationId={organizationId} dossierId={dossierId} journals={journals.data ?? []} archived={archived} canManage={canAccountingManage} />}
    {tab === 'reconciliations' && canAccountingView && <ReconciliationsPanel organizationId={organizationId} dossierId={dossierId} entries={entries.data ?? []} accounts={accounts.data ?? []} canPost={canAccountingPost} archived={archived} />}
    {tab === 'reports' && canReportsView && <ReportsPanel organizationId={organizationId} dossierId={dossierId} />}
    {tab === 'tax' && canDeclarationsView && <VatDeclarationsPanel organizationId={organizationId} dossierId={dossierId} archived={archived} canManage={canDeclarationsManage} canValidate={canDeclarationsValidate} canInvoicesView={canInvoicesView} />}
    {tab === 'periods' && canPeriodView && <PeriodClosingPanel organizationId={organizationId} dossierId={dossierId} journals={journals.data ?? []} accounts={accounts.data ?? []} archived={archived} canValidate={canPeriodValidate && canAccountsView} />}
  </Box>;
}
