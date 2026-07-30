import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Card, Tab, Tabs } from "@mui/material";
import {
  AccountBalanceWalletOutlined,
  BusinessOutlined,
  DescriptionOutlined,
  ReceiptLongOutlined,
} from "@mui/icons-material";
import { api } from "../../api/client";
import type {
  AccountingJournal,
  BusinessInvoice,
  CommercialDocument,
  FiscalVatRate,
  FiscalWithholdingRate,
  LedgerAccount,
  ThirdParty,
  ThirdPartyPayment,
} from "../../types/api";
import { CommercialDocumentsPanel } from "./CommercialDocumentsPanel";
import { InvoicesPanel, type InvoiceDraftSeed } from "./InvoicesPanel";
import { PaymentsPanel } from "./PaymentsPanel";
import { ThirdPartiesPanel } from "./ThirdPartiesPanel";
import { useLanguage } from "../../i18n/LanguageContext";

export function DossierCommercialPanel({
  organizationId,
  dossierId,
  archived,
  canThirdPartiesView,
  canThirdPartiesManage,
  canInvoicesView,
  canInvoicesManage,
  canInvoicesValidate,
  canAccountingView,
  canAccountingPost,
  canAccountsView,
  canFiscalSettingsView,
  canPaymentsView,
  canPaymentsManage,
}: {
  organizationId: string;
  dossierId: string;
  archived: boolean;
  canThirdPartiesView: boolean;
  canThirdPartiesManage: boolean;
  canInvoicesView: boolean;
  canInvoicesManage: boolean;
  canInvoicesValidate: boolean;
  canAccountingView: boolean;
  canAccountingPost: boolean;
  canAccountsView: boolean;
  canFiscalSettingsView: boolean;
  canPaymentsView: boolean;
  canPaymentsManage: boolean;
}) {
  const { t } = useLanguage();
  const initial = canInvoicesView
    ? "documents"
    : canThirdPartiesView
      ? "parties"
      : "payments";
  const [tab, setTab] = useState(initial);
  const [invoiceSeed, setInvoiceSeed] = useState<InvoiceDraftSeed | null>(null);
  const base = `/api/organizations/${organizationId}/dossiers/${dossierId}`;
  const parties = useQuery({
    queryKey: ["third-parties", organizationId, dossierId],
    queryFn: () => api.get<ThirdParty[]>(`${base}/third-parties`),
    enabled: canThirdPartiesView,
  });
  const commercialDocuments = useQuery({
    queryKey: ["commercial-documents", organizationId, dossierId],
    queryFn: () =>
      api.get<CommercialDocument[]>(`${base}/commercial-documents`),
    enabled: canInvoicesView,
  });
  const invoices = useQuery({
    queryKey: ["business-invoices", organizationId, dossierId],
    queryFn: () => api.get<BusinessInvoice[]>(`${base}/business-invoices`),
    enabled: canInvoicesView,
  });
  const payments = useQuery({
    queryKey: ["third-party-payments", organizationId, dossierId],
    queryFn: () => api.get<ThirdPartyPayment[]>(`${base}/payments`),
    enabled: canPaymentsView,
  });
  const journals = useQuery({
    queryKey: ["journals", organizationId, dossierId],
    queryFn: () => api.get<AccountingJournal[]>(`${base}/journals`),
    enabled: canAccountingView,
  });
  const accounts = useQuery({
    queryKey: ["ledger-accounts", organizationId, dossierId],
    queryFn: () => api.get<LedgerAccount[]>(`${base}/ledger-accounts`),
    enabled: canAccountsView,
  });
  const vatRates = useQuery({
    queryKey: ["fiscal-vat-rates", organizationId],
    queryFn: () =>
      api.get<FiscalVatRate[]>(
        `/api/organizations/${organizationId}/fiscal-settings/vat-rates`,
      ),
    enabled: canFiscalSettingsView,
  });
  const withholdingRates = useQuery({
    queryKey: ["fiscal-withholding-rates", organizationId],
    queryFn: () =>
      api.get<FiscalWithholdingRate[]>(
        `/api/organizations/${organizationId}/fiscal-settings/withholding-rates`,
      ),
    enabled: canFiscalSettingsView,
  });
  const missingReferences = !canAccountingView || !canAccountsView;

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, value: string) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {canInvoicesView && (
            <Tab
              value="documents"
              label={`${t("Documents commerciaux")} (${commercialDocuments.data?.length ?? 0})`}
              icon={<DescriptionOutlined />}
              iconPosition="start"
            />
          )}
          {canInvoicesView && (
            <Tab
              value="invoices"
              label={`${t("Factures")} (${invoices.data?.length ?? 0})`}
              icon={<ReceiptLongOutlined />}
              iconPosition="start"
            />
          )}
          {canThirdPartiesView && (
            <Tab
              value="parties"
              label={`${t("Tiers")} (${parties.data?.length ?? 0})`}
              icon={<BusinessOutlined />}
              iconPosition="start"
            />
          )}
          {canPaymentsView && (
            <Tab
              value="payments"
              label={`${t("Règlements")} (${payments.data?.length ?? 0})`}
              icon={<AccountBalanceWalletOutlined />}
              iconPosition="start"
            />
          )}
        </Tabs>
      </Card>
      {missingReferences && (canInvoicesManage || canPaymentsManage) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          La consultation du plan comptable et des journaux est nécessaire pour
          saisir les factures et règlements.
        </Alert>
      )}
      {tab === "documents" && canInvoicesView && (
        <CommercialDocumentsPanel
          organizationId={organizationId}
          dossierId={dossierId}
          documents={commercialDocuments.data ?? []}
          parties={parties.data ?? []}
          accounts={accounts.data ?? []}
          vatRates={vatRates.data ?? []}
          loading={
            commercialDocuments.isLoading ||
            parties.isLoading ||
            accounts.isLoading ||
            vatRates.isLoading
          }
          archived={archived}
          canManage={canInvoicesManage}
          onPrepareInvoice={(seed) => {
            setInvoiceSeed(seed);
            setTab("invoices");
          }}
        />
      )}
      {tab === "invoices" && canInvoicesView && (
        <InvoicesPanel
          organizationId={organizationId}
          dossierId={dossierId}
          invoices={invoices.data ?? []}
          parties={parties.data ?? []}
          accounts={accounts.data ?? []}
          journals={journals.data ?? []}
          vatRates={vatRates.data ?? []}
          withholdingRates={withholdingRates.data ?? []}
          loading={
            invoices.isLoading ||
            parties.isLoading ||
            accounts.isLoading ||
            journals.isLoading ||
            vatRates.isLoading ||
            withholdingRates.isLoading
          }
          archived={archived}
          canManage={canInvoicesManage && !missingReferences}
          canValidate={canInvoicesValidate}
          canPost={canAccountingPost}
          draftSeed={invoiceSeed}
          onDraftSeedConsumed={() => setInvoiceSeed(null)}
        />
      )}
      {tab === "parties" && canThirdPartiesView && (
        <ThirdPartiesPanel
          organizationId={organizationId}
          dossierId={dossierId}
          parties={parties.data ?? []}
          accounts={accounts.data ?? []}
          loading={parties.isLoading || accounts.isLoading}
          archived={archived}
          canManage={canThirdPartiesManage}
        />
      )}
      {tab === "payments" && canPaymentsView && (
        <PaymentsPanel
          organizationId={organizationId}
          dossierId={dossierId}
          payments={payments.data ?? []}
          parties={parties.data ?? []}
          invoices={invoices.data ?? []}
          accounts={accounts.data ?? []}
          journals={journals.data ?? []}
          loading={
            payments.isLoading ||
            parties.isLoading ||
            invoices.isLoading ||
            accounts.isLoading ||
            journals.isLoading
          }
          archived={archived}
          canManage={canPaymentsManage && !missingReferences}
          canPost={canAccountingPost}
        />
      )}
    </Box>
  );
}
