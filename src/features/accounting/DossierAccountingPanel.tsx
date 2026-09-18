import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Card, Tab, Tabs } from "@mui/material";
import {
  AccountBalanceOutlined,
  LinkRounded,
  LockOutlined,
  MenuBookOutlined,
  SettingsOutlined,
  SwapVertRounded,
} from "@mui/icons-material";
import { api } from "../../api/client";
import type {
  AccountingJournal,
  JournalEntry,
  LedgerAccount,
} from "../../types/api";
import { EntriesPanel } from "./EntriesPanel";
import { AccountingJournalPanel } from "./AccountingJournalPanel";
import { JournalsPanel } from "./JournalsPanel";
import { PeriodClosingPanel } from "./PeriodClosingPanel";
import { ReconciliationsPanel } from "./ReconciliationsPanel";
import { ReportsPanel } from "./ReportsPanel";

type AccountingTab =
  | "entries"
  | "journal"
  | "journals"
  | "reconciliations"
  | "reports"
  | "periods";

export function DossierAccountingPanel(props: {
  organizationId: string;
  dossierId: string;
  archived: boolean;
  canAccountingView: boolean;
  canAccountingManage: boolean;
  canAccountingPost: boolean;
  canAccountsView: boolean;
  canReportsView: boolean;
  canPeriodView: boolean;
  canPeriodValidate: boolean;
  initialTab?: AccountingTab;
}) {
  const {
    organizationId,
    dossierId,
    archived,
    canAccountingView,
    canAccountingManage,
    canAccountingPost,
    canAccountsView,
    canReportsView,
    canPeriodView,
    canPeriodValidate,
  } = props;
  const initial =
    props.initialTab ??
    (canAccountingView ? "journal" : canReportsView ? "reports" : "periods");
  const [tab, setTab] = useState<AccountingTab>(initial);
  const base = `/api/organizations/${organizationId}/dossiers/${dossierId}`;
  const journals = useQuery({
    queryKey: ["journals", organizationId, dossierId],
    queryFn: () => api.get<AccountingJournal[]>(`${base}/journals`),
    enabled: canAccountingView,
  });
  const entries = useQuery({
    queryKey: ["journal-entries", organizationId, dossierId],
    queryFn: () => api.get<JournalEntry[]>(`${base}/entries`),
    enabled: canAccountingView,
  });
  const accounts = useQuery({
    queryKey: ["ledger-accounts", organizationId, dossierId],
    queryFn: () => api.get<LedgerAccount[]>(`${base}/ledger-accounts`),
    enabled: canAccountsView,
  });

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, value: AccountingTab) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {canAccountingView && (
            <Tab
              value="journal"
              label="Journal comptable"
              icon={<MenuBookOutlined />}
              iconPosition="start"
            />
          )}
          {canAccountingView && (
            <Tab
              value="entries"
              label={`Saisie & validation (${entries.data?.length ?? 0})`}
              icon={<SwapVertRounded />}
              iconPosition="start"
            />
          )}
          {canAccountingView && (
            <Tab
              value="reconciliations"
              label="Lettrage"
              icon={<LinkRounded />}
              iconPosition="start"
            />
          )}
          {canReportsView && (
            <Tab
              value="reports"
              label="États comptables"
              icon={<AccountBalanceOutlined />}
              iconPosition="start"
            />
          )}
          {canAccountingView && (
            <Tab
              value="journals"
              label={`Paramétrage (${journals.data?.length ?? 0})`}
              icon={<SettingsOutlined />}
              iconPosition="start"
            />
          )}
          {canPeriodView && (
            <Tab
              value="periods"
              label="Clôture"
              icon={<LockOutlined />}
              iconPosition="start"
            />
          )}
        </Tabs>
      </Card>
      {!canAccountsView && (canAccountingManage || canPeriodValidate) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          L’accès au plan comptable du dossier est requis.
        </Alert>
      )}
      {tab === "entries" && canAccountingView && (
        <EntriesPanel
          organizationId={organizationId}
          dossierId={dossierId}
          entries={entries.data ?? []}
          journals={journals.data ?? []}
          accounts={accounts.data ?? []}
          loading={
            entries.isLoading || journals.isLoading || accounts.isLoading
          }
          archived={archived}
          canManage={canAccountingManage && canAccountsView}
          canPost={canAccountingPost}
        />
      )}
      {tab === "journal" && canAccountingView && (
        <AccountingJournalPanel
          entries={entries.data ?? []}
          journals={journals.data ?? []}
          loading={entries.isLoading || journals.isLoading}
        />
      )}
      {tab === "journals" && canAccountingView && (
        <JournalsPanel
          organizationId={organizationId}
          dossierId={dossierId}
          journals={journals.data ?? []}
          archived={archived}
          canManage={canAccountingManage}
        />
      )}
      {tab === "reconciliations" && canAccountingView && (
        <ReconciliationsPanel
          organizationId={organizationId}
          dossierId={dossierId}
          entries={entries.data ?? []}
          accounts={accounts.data ?? []}
          canPost={canAccountingPost}
          archived={archived}
        />
      )}
      {tab === "reports" && canReportsView && (
        <ReportsPanel organizationId={organizationId} dossierId={dossierId} />
      )}
      {tab === "periods" && canPeriodView && (
        <PeriodClosingPanel
          organizationId={organizationId}
          dossierId={dossierId}
          journals={journals.data ?? []}
          accounts={accounts.data ?? []}
          archived={archived}
          canValidate={canPeriodValidate && canAccountsView}
        />
      )}
    </Box>
  );
}
