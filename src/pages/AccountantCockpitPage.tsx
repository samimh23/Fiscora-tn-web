import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
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
  CheckCircleOutlineRounded,
  DescriptionOutlined,
  FolderOutlined,
  PaidOutlined,
  PlayArrowRounded,
  RefreshRounded,
  ScheduleRounded,
  TaskAltOutlined,
  WarningAmberRounded,
} from "@mui/icons-material";
import type { ElementType } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { humanizeEnum, humanizeText } from "../utils/labels";
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

const severityRank: Record<CockpitLane["severity"], number> = {
  error: 0,
  warning: 1,
  info: 2,
  success: 3,
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
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderColor: lane.count > 0 ? `${color}55` : "divider",
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1.75,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
        }}
      >
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            bgcolor: `${color}14`,
            color,
            flex: "0 0 auto",
          }}
        >
          <Icon sx={{ fontSize: 17 }} />
        </Box>
        <Typography variant="h3" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {lane.title}
        </Typography>
        {lane.count > 0 && (
          <Chip
            label={lane.count}
            size="small"
            sx={{ bgcolor: `${color}16`, color, fontWeight: 700 }}
          />
        )}
      </Box>
      <Divider />
      {lane.items.length === 0 ? (
        <Box sx={{ px: 2.5, py: 3, flex: 1, textAlign: "center" }}>
          <CheckCircleOutlineRounded
            sx={{ color: "success.main", fontSize: 30, mb: 0.75 }}
          />
          <Typography variant="body2" color="text.secondary">
            Rien à traiter ici.
          </Typography>
        </Box>
      ) : (
        <Stack divider={<Divider />} sx={{ flex: 1 }}>
          {lane.items.map((item) => (
            <CockpitRow key={`${lane.key}-${item.id}`} item={item} />
          ))}
        </Stack>
      )}
      <Divider />
      <Box sx={{ px: 1.5, py: 0.75 }}>
        <Button
          component={RouterLink}
          to={lane.actionPath}
          size="small"
          endIcon={<ArrowForwardRounded />}
        >
          Ouvrir la file
        </Button>
      </Box>
    </Card>
  );
}

function CockpitRow({ item }: { item: CockpitItem }) {
  const due = shortDate(item.dueOn);
  // One muted meta line instead of a wrapping row of competing chips.
  const meta = [
    item.dossierName,
    humanizeText(item.subtitle),
    due && `Échéance ${due}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Box
      component={RouterLink}
      to={item.actionPath}
      title={item.actionLabel}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 2.5,
        py: 1.375,
        color: "inherit",
        textDecoration: "none",
        "&:hover": { bgcolor: "grey.50" },
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
          {item.title}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ display: "block" }}
        >
          {meta}
        </Typography>
      </Box>
      {item.amount && (
        <Typography
          sx={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" }}
        >
          {money(item.amount)}
        </Typography>
      )}
      <Chip label={humanizeEnum(item.status)} size="small" variant="outlined" />
      <ArrowForwardRounded sx={{ fontSize: 16, color: "text.disabled" }} />
    </Box>
  );
}

function NextWorkCard({ lanes }: { lanes: CockpitLane[] }) {
  const ordered = [...lanes].sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] || b.count - a.count,
  );
  const nextLane = ordered.find((lane) => lane.count > 0);
  const nextItem = ordered.flatMap((lane) => lane.items)[0];

  if (!nextLane) {
    return (
      <Card sx={{ mb: 2, borderColor: "success.light", bgcolor: "#fbfdfa" }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 3,
                display: "grid",
                placeItems: "center",
                bgcolor: "success.light",
                color: "success.main",
                flex: "0 0 auto",
              }}
            >
              <CheckCircleOutlineRounded />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h3">Tout est à jour</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Aucune urgence détectée. C’est le bon moment pour préparer les
                prochaines demandes clients, vérifier les dossiers incomplets ou
                avancer les travaux du mois.
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              to="/dossiers"
              variant="outlined"
              endIcon={<ArrowForwardRounded />}
              sx={{ alignSelf: { xs: "stretch", md: "center" } }}
            >
              Voir les dossiers
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const color = severityColor[nextLane.severity];
  return (
    <Card sx={{ mb: 2, overflow: "hidden", borderColor: `${color}66` }}>
      <Box
        sx={{
          px: 2.5,
          py: 1,
          bgcolor: `${color}12`,
          borderBottom: "1px solid",
          borderColor: `${color}25`,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <ScheduleRounded sx={{ color, fontSize: 18 }} />
          <Typography variant="overline" sx={{ color }}>
            Prochaine meilleure action
          </Typography>
        </Stack>
      </Box>
      <CardContent>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          sx={{ alignItems: { lg: "center" } }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h2" sx={{ mb: 0.75 }}>
              {nextLane.title}
            </Typography>
            <Typography color="text.secondary">
              {nextItem
                ? `${nextItem.title}${
                    nextItem.dossierName ? ` · ${nextItem.dossierName}` : ""
                  }`
                : `${nextLane.count} action(s) à traiter dans cette file.`}
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            to={nextItem?.actionPath ?? nextLane.actionPath}
            variant="contained"
            size="large"
            startIcon={<PlayArrowRounded />}
            endIcon={<ArrowForwardRounded />}
            sx={{ alignSelf: { xs: "stretch", lg: "center" } }}
          >
            Traiter maintenant
          </Button>
        </Stack>
      </CardContent>
      <CardActions
        sx={{
          px: 2.5,
          py: 1.25,
          bgcolor: "grey.50",
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Conseil produit : terminer une file critique avant d’ouvrir un autre
          module garde le cabinet lisible et évite les oublis.
        </Typography>
      </CardActions>
    </Card>
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
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            <Button
              onClick={() => cockpit.refetch()}
              variant="outlined"
              startIcon={<RefreshRounded />}
              disabled={!organizationId || cockpit.isFetching}
            >
              Actualiser
            </Button>
            {can("dossiers.create") && (
              <Button
                component={RouterLink}
                to="/dossiers?nouveau=1"
                variant="contained"
                startIcon={<FolderOutlined />}
              >
                Nouveau dossier
              </Button>
            )}
          </Stack>
        }
      />

      {!can("tasks.view") && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Votre rôle n’a pas accès à la file de travail. Demandez au
          propriétaire du cabinet d’ajouter la permission de consultation des
          tâches.
        </Alert>
      )}
      {cockpit.isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Impossible d’actualiser la file de travail. Vérifiez que le backend
          est démarré.
        </Alert>
      )}

      {!cockpit.isLoading && can("tasks.view") && <NextWorkCard lanes={lanes} />}

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
