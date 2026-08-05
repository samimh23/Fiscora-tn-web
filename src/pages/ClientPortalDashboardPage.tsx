import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, InputLabel, MenuItem,
  Select, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import {
  ArrowForwardRounded, BusinessOutlined, CalendarMonthOutlined,
  CloudUploadOutlined, DescriptionOutlined, DoneAllRounded, ForumOutlined,
  PaymentsOutlined, PriorityHighRounded,
} from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type {
  DossierSummary, FiscalObligation, MissingDocumentExpectation,
  MonthlyTaxDeclaration, NotificationItem, PagedResponse,
} from "../types/api";

interface CabinetInvoice {
  id: string;
  number: string;
  dueDate: string;
  description: string;
  totalAmount: string;
  paidAmount: string;
  status: string;
}

interface ClientApproval {
  resourceType: string;
  resourceId: string;
  version: string;
  decision: "APPROUVE" | "REJETE";
}

interface DossierWorkspace {
  dossier: DossierSummary;
  expectations: MissingDocumentExpectation[];
  obligations: FiscalObligation[];
  fees: CabinetInvoice[];
  declarations: MonthlyTaxDeclaration[];
  approvals: ClientApproval[];
}

type ActionKind = "documents" | "deadlines" | "payments" | "messages" | "approvals";
interface PortalAction {
  id: string;
  dossierName: string;
  kind: ActionKind;
  title: string;
  detail: string;
  urgent: boolean;
  link: string;
}

const categories = [
  ["BOITE_RECEPTION", "Boîte de réception"],
  ["FACTURES_ACHATS", "Factures d’achats"],
  ["FACTURES_VENTES", "Factures de ventes"],
  ["RELEVES_BANCAIRES", "Relevés bancaires"],
  ["CONTRATS", "Contrats"],
  ["DECLARATIONS", "Déclarations"],
  ["PAIE", "Paie"],
  ["JURIDIQUE", "Juridique"],
  ["DIVERS", "Autres"],
];

const money = (value: number) =>
  new Intl.NumberFormat("fr-TN", {
    style: "currency", currency: "TND", minimumFractionDigits: 3,
  }).format(value);

export function ClientPortalDashboardPage() {
  const { session, organization } = useAuth();
  const organizationId = organization?.id ?? "";
  const qc = useQueryClient();
  const [today] = useState(() => new Date());
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const [filter, setFilter] = useState<"all" | ActionKind>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDossierId, setUploadDossierId] = useState("");
  const [category, setCategory] = useState("BOITE_RECEPTION");
  const [files, setFiles] = useState<File[]>([]);

  const dossiers = useQuery({
    queryKey: ["client-portal-dossiers", organizationId],
    queryFn: () => api.get<PagedResponse<DossierSummary>>(
      `/api/organizations/${organizationId}/dossiers?page=1&pageSize=100`,
    ),
    enabled: Boolean(organizationId),
  });
  const notifications = useQuery({
    queryKey: ["client-portal-notifications", organizationId],
    queryFn: () => api.get<NotificationItem[]>(
      `/api/organizations/${organizationId}/notifications?unreadOnly=true`,
    ),
    enabled: Boolean(organizationId),
  });
  const workspace = useQuery({
    queryKey: ["client-portal-action-center", organizationId, dossiers.data?.items.map((x) => x.id).join(",")],
    enabled: Boolean(organizationId && dossiers.data),
    queryFn: async (): Promise<DossierWorkspace[]> => Promise.all(
      (dossiers.data?.items ?? []).map(async (dossier) => {
        const base = `/api/organizations/${organizationId}/dossiers/${dossier.id}`;
        const safe = async <T,>(request: Promise<T>, fallback: T) => {
          try { return await request; } catch { return fallback; }
        };
        const [expectations, obligations, fees, declarations, approvals] = await Promise.all([
          safe(api.get<MissingDocumentExpectation[]>(`${base}/documents/missing/${year}/${month}`), []),
          safe(api.get<FiscalObligation[]>(`${base}/obligations?year=${year}`), []),
          safe(api.get<CabinetInvoice[]>(`${base}/invoices`), []),
          safe(api.get<MonthlyTaxDeclaration[]>(`${base}/monthly-declarations?year=${year}`), []),
          safe(api.get<ClientApproval[]>(`${base}/client-portal/approvals`), []),
        ]);
        return { dossier, expectations, obligations, fees, declarations, approvals };
      }),
    ),
  });

  const actions = useMemo(() => {
    const result: PortalAction[] = [];
    for (const item of workspace.data ?? []) {
      const root = `/portail/dossiers/${item.dossier.id}`;
      for (const expectation of item.expectations.filter((x) =>
        !["RECUE", "VALIDEE", "ANNULEE"].includes(x.status ?? "") &&
        !x.receivedDocumentId,
      )) {
        result.push({
          id: `doc-${expectation.id}`, dossierName: item.dossier.legalName,
          kind: "documents", urgent: expectation.status === "REJETEE", title: expectation.label,
          detail: `Pièce demandée pour ${String(expectation.periodMonth).padStart(2, "0")}/${expectation.periodYear}`,
          link: `${root}?tab=documents&category=${expectation.category}&expectationId=${expectation.id}`,
        });
      }
      for (const obligation of item.obligations.filter((x) =>
        !["DEPOSE", "PAYEE", "VALIDEE"].includes(x.status) &&
        (x.isLate || new Date(`${x.dueOn}T00:00:00`).getTime() <= today.getTime() + 30 * 86_400_000),
      )) {
        result.push({
          id: `due-${obligation.id}`, dossierName: item.dossier.legalName,
          kind: "deadlines", urgent: obligation.isLate, title: obligation.name,
          detail: `${obligation.isLate ? "En retard depuis" : "À échéance le"} ${new Intl.DateTimeFormat("fr-TN").format(new Date(`${obligation.dueOn}T00:00:00`))}`,
          link: `${root}?tab=deadlines`,
        });
      }
      for (const invoice of item.fees.filter((x) =>
        !["BROUILLON", "PAYEE", "ANNULEE"].includes(x.status) &&
        Number(x.totalAmount) > Number(x.paidAmount),
      )) {
        result.push({
          id: `fee-${invoice.id}`, dossierName: item.dossier.legalName,
          kind: "payments", urgent: invoice.status === "EN_RETARD",
          title: `Honoraires ${invoice.number}`,
          detail: `${money(Number(invoice.totalAmount) - Number(invoice.paidAmount))} à régler`,
          link: `${root}?tab=fees`,
        });
      }
      for (const declaration of item.declarations.filter((x) =>
        ["VALIDEE", "DEPOSEE"].includes(x.status) &&
        !item.approvals.some((approval) =>
          approval.resourceType === "DECLARATION_FISCALE" &&
          approval.resourceId === x.id &&
          approval.decision === "APPROUVE"),
      )) {
        result.push({
          id: `approval-${declaration.id}`, dossierName: item.dossier.legalName,
          kind: "approvals", urgent: false,
          title: `Déclaration ${String(declaration.periodMonth).padStart(2, "0")}/${declaration.periodYear}`,
          detail: `Disponible pour votre prise de connaissance · Total ${money(Number(declaration.totalDue))}`,
          link: `${root}?tab=declarations`,
        });
      }
    }
    for (const notification of notifications.data ?? []) {
      if (notification.type === "MESSAGE_PORTAIL_CLIENT") {
        result.push({
          id: `message-${notification.id}`, dossierName: organization?.name ?? "Votre cabinet",
          kind: "messages", urgent: false, title: notification.title,
          detail: notification.message, link: "/portail/notifications",
        });
      }
    }
    return result.sort((a, b) => Number(b.urgent) - Number(a.urgent));
  }, [notifications.data, organization?.name, today, workspace.data]);

  const visibleActions = filter === "all" ? actions : actions.filter((x) => x.kind === filter);
  const missingCount = actions.filter((x) => x.kind === "documents").length;
  const deadlineCount = actions.filter((x) => x.kind === "deadlines").length;
  const outstanding = (workspace.data ?? []).flatMap((x) => x.fees)
    .filter((x) => !["BROUILLON", "ANNULEE"].includes(x.status))
    .reduce((sum, x) => sum + Math.max(0, Number(x.totalAmount) - Number(x.paidAmount)), 0);

  const upload = useMutation({
    mutationFn: async () => {
      if (!uploadDossierId || !files.length) return;
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("category", category);
        form.append("periodYear", String(year));
        form.append("periodMonth", String(month));
        await api.upload(
          `/api/organizations/${organizationId}/dossiers/${uploadDossierId}/documents`,
          form,
        );
      }
    },
    onSuccess: () => {
      setUploadOpen(false);
      setFiles([]);
      void qc.invalidateQueries({ queryKey: ["client-portal-action-center"] });
    },
  });

  const firstName = session?.user.fullName.split(" ")[0] ?? "";
  const icons: Record<ActionKind, React.ReactNode> = {
    documents: <DescriptionOutlined />,
    deadlines: <CalendarMonthOutlined />,
    payments: <PaymentsOutlined />,
    messages: <ForumOutlined />,
    approvals: <DoneAllRounded />,
  };

  return <>
    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2, justifyContent: "space-between", mb: 3 }}>
      <Box>
        <Typography variant="overline" color="primary" sx={{ fontWeight: 900, letterSpacing: ".15em" }}>Espace client sécurisé</Typography>
        <Typography variant="h2" sx={{ fontSize: { xs: 38, md: 54 } }}>Bonjour {firstName}</Typography>
        <Typography color="text.secondary">Voici ce qui demande votre attention chez {organization?.name}.</Typography>
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignSelf: { md: "center" } }}>
        <Button variant="outlined" component={RouterLink} to="/portail/dossiers" startIcon={<BusinessOutlined />}>Mes sociétés</Button>
        <Button variant="contained" startIcon={<CloudUploadOutlined />} onClick={() => {
          setUploadDossierId(dossiers.data?.items[0]?.id ?? "");
          setUploadOpen(true);
        }}>Déposer des pièces</Button>
      </Stack>
    </Box>

    {(dossiers.isError || workspace.isError || notifications.isError) &&
      <Alert severity="warning" sx={{ mb: 2 }}>Certaines données n’ont pas pu être actualisées.</Alert>}

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4,1fr)" }, gap: 2, mb: 3 }}>
      {[
        [actions.length, "Actions à traiter", <PriorityHighRounded />],
        [missingCount, "Pièces demandées", <DescriptionOutlined />],
        [deadlineCount, "Échéances à surveiller", <CalendarMonthOutlined />],
        [money(outstanding), "Honoraires ouverts", <PaymentsOutlined />],
      ].map(([value, label, icon]) =>
        <Card key={String(label)}><CardContent sx={{ p: 2.5 }}>
          <Box sx={{ color: "primary.main" }}>{icon}</Box>
          <Typography variant="h4" sx={{ mt: 1.5 }}>{String(value)}</Typography>
          <Typography variant="body2" color="text.secondary">{String(label)}</Typography>
        </CardContent></Card>,
      )}
    </Box>

    <Card>
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 2.5 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}>
          <Box><Typography variant="h3" sx={{ fontSize: 28 }}>Mes actions</Typography><Typography variant="body2" color="text.secondary">Un seul endroit pour savoir quoi transmettre, valider ou régler.</Typography></Box>
          <Chip label={`${visibleActions.length} action${visibleActions.length > 1 ? "s" : ""}`} color={visibleActions.some((x) => x.urgent) ? "warning" : "default"} />
        </Stack>
        <Tabs value={filter} onChange={(_, value) => setFilter(value)} variant="scrollable" scrollButtons="auto" sx={{ mt: 2 }}>
          <Tab value="all" label="Toutes" />
          <Tab value="documents" label="Pièces" />
          <Tab value="deadlines" label="Échéances" />
          <Tab value="payments" label="Paiements" />
          <Tab value="messages" label="Messages" />
          <Tab value="approvals" label="Validations" />
        </Tabs>
      </Box>
      <Divider />
      {(dossiers.isLoading || workspace.isLoading) &&
        <Box sx={{ p: 4 }}><Typography color="text.secondary">Préparation de votre liste d’actions…</Typography></Box>}
      {!workspace.isLoading && !visibleActions.length &&
        <Box sx={{ p: 6, textAlign: "center" }}><DoneAllRounded color="success" sx={{ fontSize: 50 }} /><Typography variant="h4" sx={{ mt: 1.5 }}>Tout est à jour</Typography><Typography color="text.secondary">Aucune action ne vous est demandée pour le moment.</Typography></Box>}
      {visibleActions.map((action, index) =>
        <Box key={action.id}>{index > 0 && <Divider />}<Box sx={{ p: 2.5, display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2, alignItems: { sm: "center" } }}>
          <Box sx={{ width: 46, height: 46, borderRadius: 2.5, bgcolor: action.urgent ? "#fff0e7" : "#e8f1ed", color: action.urgent ? "warning.main" : "primary.main", display: "grid", placeItems: "center", flexShrink: 0 }}>{icons[action.kind]}</Box>
          <Box sx={{ flex: 1 }}><Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography sx={{ fontWeight: 900 }}>{action.title}</Typography>{action.urgent && <Chip size="small" color="warning" label="Prioritaire" />}</Stack><Typography variant="body2" color="text.secondary">{action.dossierName} · {action.detail}</Typography></Box>
          <Button component={RouterLink} to={action.link} endIcon={<ArrowForwardRounded />}>Traiter</Button>
        </Box></Box>,
      )}
    </Card>

    <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Déposer rapidement des pièces</DialogTitle>
      <DialogContent><Stack spacing={2.5} sx={{ pt: 1 }}>
        <Alert severity="info">Vous pouvez sélectionner plusieurs fichiers. Chaque pièce restera rattachée à la société choisie.</Alert>
        <FormControl fullWidth><InputLabel>Société</InputLabel><Select label="Société" value={uploadDossierId} onChange={(event) => setUploadDossierId(event.target.value)}>
          {dossiers.data?.items.map((item) => <MenuItem key={item.id} value={item.id}>{item.legalName}</MenuItem>)}
        </Select></FormControl>
        <FormControl fullWidth><InputLabel>Catégorie</InputLabel><Select label="Catégorie" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </Select></FormControl>
        <Button component="label" variant="outlined" startIcon={<CloudUploadOutlined />}>
          {files.length ? `${files.length} fichier${files.length > 1 ? "s" : ""} sélectionné${files.length > 1 ? "s" : ""}` : "Choisir des fichiers"}
          <input hidden multiple type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx,.xml" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
        </Button>
        <Button component="label" variant="text">
          Photographier une pièce
          <input hidden type="file" accept="image/*" capture="environment" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
        </Button>
        <Stack direction="row" spacing={2}><TextField fullWidth label="Année" value={year} disabled /><TextField fullWidth label="Mois" value={String(month).padStart(2, "0")} disabled /></Stack>
        {upload.isError && <Alert severity="error">Le dépôt n’a pas pu être terminé. Réessayez ou contactez votre cabinet.</Alert>}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setUploadOpen(false)}>Annuler</Button><Button variant="contained" disabled={!uploadDossierId || !files.length || upload.isPending} onClick={() => upload.mutate()}>{upload.isPending ? "Envoi…" : "Déposer"}</Button></DialogActions>
    </Dialog>
  </>;
}
