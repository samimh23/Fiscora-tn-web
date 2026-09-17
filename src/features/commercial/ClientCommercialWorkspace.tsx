import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Card, Tab, Tabs } from "@mui/material";
import {
  BusinessOutlined,
  ReceiptLongOutlined,
} from "@mui/icons-material";
import { api } from "../../api/client";
import type { CommercialDocument, ThirdParty } from "../../types/api";
import { CommercialDocumentsPanel } from "./CommercialDocumentsPanel";
import { ThirdPartiesPanel } from "./ThirdPartiesPanel";

export function ClientCommercialWorkspace({
  organizationId,
  dossierId,
  archived,
}: {
  organizationId: string;
  dossierId: string;
  archived: boolean;
}) {
  const [tab, setTab] = useState<"sales" | "customers">("sales");
  const base = `/api/organizations/${organizationId}/dossiers/${dossierId}`;
  const documents = useQuery({
    queryKey: ["commercial-documents", organizationId, dossierId],
    queryFn: () =>
      api.get<CommercialDocument[]>(`${base}/commercial-documents`),
  });
  const parties = useQuery({
    queryKey: ["third-parties", organizationId, dossierId],
    queryFn: () => api.get<ThirdParty[]>(`${base}/third-parties`),
  });

  return (
    <Box>
      <Card variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, value: "sales" | "customers") => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            value="sales"
            label={`Ventes & facturation (${documents.data?.length ?? 0})`}
            icon={<ReceiptLongOutlined />}
            iconPosition="start"
          />
          <Tab
            value="customers"
            label={`Clients (${parties.data?.filter((party) => party.type !== "FOURNISSEUR").length ?? 0})`}
            icon={<BusinessOutlined />}
            iconPosition="start"
          />
        </Tabs>
      </Card>
      {tab === "sales" && (
        <CommercialDocumentsPanel
          organizationId={organizationId}
          dossierId={dossierId}
          documents={documents.data ?? []}
          parties={parties.data ?? []}
          accounts={[]}
          vatRates={[]}
          loading={documents.isLoading || parties.isLoading}
          archived={archived}
          canManage
        />
      )}
      {tab === "customers" && (
        <ThirdPartiesPanel
          organizationId={organizationId}
          dossierId={dossierId}
          parties={parties.data ?? []}
          accounts={[]}
          loading={parties.isLoading}
          archived={archived}
          canManage
        />
      )}
    </Box>
  );
}
