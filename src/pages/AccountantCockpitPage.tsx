import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Typography,
  type SvgIconProps,
} from "@mui/material";
import {
  AccountBalanceOutlined,
  ArrowForwardRounded,
  AssignmentTurnedInOutlined,
  DescriptionOutlined,
  FolderOutlined,
  PaidOutlined,
  RefreshRounded,
  TaskAltOutlined,
  WarningAmberRounded,
} from "@mui/icons-material";
import type { ElementType } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import type { CabinetCockpit, CockpitItem, CockpitLane } from "../types/api";

const todayLabel = new Intl.DateTimeFormat("fr-TN", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

const money = (value?: string | null) =>
  new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
  }).format(Number(value ?? 0));

const shortDate = (value?: string | null) => {
  if (!value) return null;
  return new Intl.DateTimeFormat("fr-TN", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
};

const severityColor: Record<CockpitLane["severity"], string> = {
  success: "#2f7d5b",
  info: "#2f6597",
  warning: "#c47a24",
  error: "#bd4f4f",
};

const laneIcons: Record<string, ElementType<SvgIconProps>> = {
  overdue_tasks: WarningAmberRounded,
  review_tasks: AssignmentTurnedInOutlined,
  documents: DescriptionOutlined,
  invoice_validation: PaidOutlined,
  unpaid_invoices: PaidOutlined,
  bank: AccountBalanceOutlined,
  obligations: TaskAltOutlined,
  payroll: AssignmentTurnedInOutlined,
};

function LaneCard({ lane }: { lane: CockpitLane }) {
  const Icon = laneIcons[lane.key] ?? TaskAltOutlined;
  const color = severityColor[lane.severity];

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
        <Box sx={{ p: 2.25, display: "flex", gap: 1.5, alignItems: "start" }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2.5,
              display: "grid",
              placeItems: "center",
              bgcolor: `${color}14`,
              color,
              flex: "0 0 auto",
            }}
          >
            <Icon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
            >
              <Typography variant="h3" sx={{ fontSize: 19 }}>
                {lane.title}
              </Typography>
              <Chip
                label={lane.count}
                size="small"
                sx={{
                  bgcolor: `${color}18`,
                  color,
                  fontWeight: 800,
                  minWidth: 36,
                }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {lane.description}
            </Typography>
          </Box>
        </Box>
        <Divider />
        {lane.items.length === 0 ? (
          <Box sx={{ p: 3.5, textAlign: "center" }}>
            <TaskAltOutlined sx={{ color: "success.main", fontSize: 34 }} />
            <Typography sx={{ mt: 1, fontWeight: 800 }}>File vide</Typography>
            <Typography variant="body2" color="text.secondary">
              Rien à traiter ici pour le moment.
            </Typography>
          </Box>
        ) : (
          <Stack divider={<Divider />}>
            {lane.items.map((item) => (
              <CockpitRow key={`${lane.key}-${item.id}`} item={item} />
            ))}
          </Stack>
        )}
        <Box sx={{ px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Button
            component={RouterLink}
            to={lane.actionPath}
            endIcon={<ArrowForwardRounded />}
            fullWidth
          >
            {lane.actionLabel}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function CockpitRow({ item }: { item: CockpitItem }) {
  const due = shortDate(item.dueOn);

  return (
    <Box sx={{ p: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
            {item.dossierName}
          </Typography>
          <Typography sx={{ fontWeight: 800 }} noWrap>
            {item.title}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 0.5 }}>
            <Chip label={item.status} size="small" variant="outlined" />
            <Typography variant="caption" color="text.secondary">
              {item.subtitle}
            </Typography>
            {due && (
              <Typography variant="caption" color="text.secondary">
                Échéance {due}
              </Typography>
            )}
            {item.amount && (
              <Typography variant="caption" sx={{ fontWeight: 850, color: "primary.main" }}>
                {money(item.amount)}
              </Typography>
            )}
          </Stack>
        </Box>
        <Button
          component={RouterLink}
          to={item.actionPath}
          size="small"
          variant="outlined"
          endIcon={<ArrowForwardRounded />}
          sx={{ flex: "0 0 auto" }}
        >
          {item.actionLabel}
        </Button>
      </Stack>
    </Box>
  );
}

export function AccountantCockpitPage() {
  const { session, organization, can } = useAuth();
  const organizationId = organization?.id;
  const firstName = session?.user.fullName.split(" ")[0] ?? "";
  const cockpit = useQuery({
    queryKey: ["cabinet-cockpit", organizationId],
    queryFn: () =>
      api.get<CabinetCockpit>(`/api/organizations/${organizationId}/cockpit`),
    enabled: Boolean(organizationId && can("tasks.view")),
  });

  const lanes = cockpit.data?.lanes ?? [];

  return (
    <>
      <PageHeader
        eyebrow={todayLabel}
        title={`Ma journée, ${firstName}`}
        description={`Un seul écran pour savoir quoi traiter maintenant dans ${
          organization?.name ?? "votre cabinet"
        }.`}
        action={
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button
              onClick={() => cockpit.refetch()}
              variant="outlined"
              startIcon={<RefreshRounded />}
              disabled={!organizationId || cockpit.isFetching}
            >
              Actualiser
            </Button>
            {can("dossiers.create") && (
              <Button component={RouterLink} to="/dossiers?nouveau=1" variant="contained" startIcon={<FolderOutlined />}>
                Nouveau dossier
              </Button>
            )}
          </Stack>
        }
      />

      {!can("tasks.view") && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Votre rôle n’a pas accès à la file de travail. Demandez au propriétaire du cabinet
          d’ajouter la permission de consultation des tâches.
        </Alert>
      )}
      {cockpit.isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Impossible d’actualiser la file de travail. Vérifiez que le backend est démarré.
        </Alert>
      )}

      <div className="metric-grid">
        <MetricCard
          label="Actions ouvertes"
          value={cockpit.data?.totals.totalActions ?? 0}
          hint="Toutes les files du cabinet"
          icon={TaskAltOutlined}
          loading={cockpit.isLoading}
        />
        <MetricCard
          label="Critiques"
          value={cockpit.data?.totals.criticalActions ?? 0}
          hint="Retards et échéances proches"
          icon={WarningAmberRounded}
          color="#bd4f4f"
          loading={cockpit.isLoading}
        />
        <MetricCard
          label="À valider"
          value={cockpit.data?.totals.validationActions ?? 0}
          hint="Travaux et factures à contrôler"
          icon={AssignmentTurnedInOutlined}
          color="#c47a24"
          loading={cockpit.isLoading}
        />
        <MetricCard
          label="Collecte & banque"
          value={cockpit.data?.totals.collectionActions ?? 0}
          hint="Pièces et mouvements à rapprocher"
          icon={DescriptionOutlined}
          color="#5c60b8"
          loading={cockpit.isLoading}
        />
      </div>

      {cockpit.isLoading ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
            mt: 2,
          }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent>
                <Skeleton height={38} />
                <Skeleton height={74} />
                <Skeleton height={74} />
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
            mt: 2,
          }}
        >
          {lanes.map((lane) => (
            <LaneCard key={lane.key} lane={lane} />
          ))}
        </Box>
      )}
    </>
  );
}
