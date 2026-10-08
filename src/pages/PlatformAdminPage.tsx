import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApartmentOutlined,
  ApiRounded,
  BackupOutlined,
  BlockOutlined,
  CheckCircleOutlineRounded,
  CloudQueueOutlined,
  DescriptionOutlined,
  EmailOutlined,
  GroupsOutlined,
  RefreshRounded,
  RestartAltRounded,
  SearchRounded,
  ShieldOutlined,
  StorageOutlined,
  SyncRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  InputAdornment,
  LinearProgress,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { api, readSession } from "../api/client";
import { MetricCard } from "../components/MetricCard";
import { PlatformEmailPanel } from "../features/platform-admin/PlatformEmailPanel";
import { PlatformMonitoringPanel } from "../features/platform-admin/PlatformMonitoringPanel";
import { PlatformTrainingPanel } from "../features/platform-admin/PlatformTrainingPanel";
import { PlatformUsersPanel } from "../features/platform-admin/PlatformUsersPanel";
import { getPlatformAdminSection } from "../features/platform-admin/navigation";
import { PlatformSubscriptionsPanel } from "../features/saas/PlatformSubscriptionsPanel";
import type {
  PlatformJobsOverview,
  PlatformOrganization,
  PlatformOverview,
  PlatformUser,
} from "../types/api";

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-TN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Jamais";

const formatBytes = (value: number) => {
  if (value < 1024) return `${value} o`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} Ko`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} Mo`;
  return `${(value / 1024 ** 3).toFixed(2)} Go`;
};

const serviceMeta = {
  API: { icon: ApiRounded, color: "#345f9d", background: "#edf3fb" },
  DATABASE: {
    icon: StorageOutlined,
    color: "#7a5d35",
    background: "#f8f1e8",
  },
  OBJECT_STORAGE: {
    icon: CloudQueueOutlined,
    color: "#39717d",
    background: "#eaf4f5",
  },
  EMAIL: { icon: EmailOutlined, color: "#7256a3", background: "#f3effa" },
  BACKUPS: {
    icon: BackupOutlined,
    color: "#a4612f",
    background: "#fbf1e8",
  },
} as const;

const serviceColor = (status: string) => {
  if (status === "NON_CONFIGURE") return "warning" as const;
  return "success" as const;
};

type AdminAction =
  | {
      kind: "organization-status";
      id: string;
      name: string;
      isActive: boolean;
    }
  | {
      kind: "user-status";
      id: string;
      name: string;
      isActive: boolean;
    }
  | {
      kind: "revoke-sessions";
      id: string;
      name: string;
      activeSessions: number;
    };

const actionCopy = (action: AdminAction | null) => {
  if (!action) return null;
  if (action.kind === "revoke-sessions") {
    return {
      title: "Révoquer les connexions",
      description: `${action.name} devra se reconnecter sur tous ses appareils. La session d’accès actuelle expirera normalement, mais aucun jeton ne pourra être renouvelé.`,
      confirm: "Confirmer la révocation",
      success: `Les connexions de ${action.name} ont été révoquées.`,
      destructive: true,
    };
  }
  const target = action.kind === "organization-status" ? "cabinet" : "compte";
  if (action.isActive) {
    return {
      title: `Suspendre ce ${target}`,
      description:
        action.kind === "organization-status"
          ? `${action.name} ne pourra plus accéder à ses dossiers. Les données restent conservées.`
          : `${action.name} ne pourra plus se connecter et ses sessions seront révoquées.`,
      confirm: "Confirmer la suspension",
      success: `${action.name} a été suspendu.`,
      destructive: true,
    };
  }
  return {
    title: `Réactiver ce ${target}`,
    description: `${action.name} retrouvera son accès. La raison de cette décision sera conservée dans le journal d’audit.`,
    confirm: "Confirmer la réactivation",
    success: `${action.name} a été réactivé.`,
    destructive: false,
  };
};

export function PlatformAdminPage() {
  const queryClient = useQueryClient();
  const currentUserId = readSession()?.user.id;
  const [params] = useSearchParams();
  const section = getPlatformAdminSection(params.get("section"));
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [searches, setSearches] = useState<Record<string, string>>({});
  const search = searches[section.key] ?? "";
  const [action, setAction] = useState<AdminAction | null>(null);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    titleRef.current?.focus({ preventScroll: true });
  }, [section.key]);

  const overview = useQuery({
    queryKey: ["platform-admin", "overview"],
    queryFn: () => api.get<PlatformOverview>("/api/platform-admin/overview"),
  });
  const organizations = useQuery({
    enabled: section.key === "cabinets",
    queryKey: ["platform-admin", "organizations"],
    queryFn: () =>
      api.get<PlatformOrganization[]>("/api/platform-admin/organizations"),
  });
  const users = useQuery({
    enabled: section.key === "utilisateurs",
    queryKey: ["platform-admin", "users"],
    queryFn: () => api.get<PlatformUser[]>("/api/platform-admin/users"),
  });
  const jobs = useQuery({
    enabled: section.key === "traitements",
    queryKey: ["platform-admin", "jobs"],
    queryFn: () => api.get<PlatformJobsOverview>("/api/platform-admin/jobs"),
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      selected,
      justification,
    }: {
      selected: AdminAction;
      justification: string;
    }) => {
      if (selected.kind === "organization-status") {
        return api.patch(
          `/api/platform-admin/organizations/${selected.id}/status`,
          { isActive: !selected.isActive, reason: justification },
        );
      }
      if (selected.kind === "user-status") {
        return api.patch(`/api/platform-admin/users/${selected.id}/status`, {
          isActive: !selected.isActive,
          reason: justification,
        });
      }
      return api.post(
        `/api/platform-admin/users/${selected.id}/revoke-sessions`,
        { reason: justification },
      );
    },
    onSuccess: async () => {
      const copy = actionCopy(action);
      setFeedback(copy?.success ?? "Action terminée.");
      setAction(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["platform-admin"] });
    },
  });

  const isLoading = overview.isLoading;
  const activeQuery =
    section.key === "overview"
      ? overview
      : section.key === "cabinets"
        ? organizations
        : section.key === "utilisateurs"
          ? users
          : section.key === "traitements"
            ? jobs
            : undefined;
  const hasError = activeQuery?.isError ?? false;
  const normalizedSearch = search.trim().toLocaleLowerCase("fr");
  const filteredOrganizations = useMemo(
    () =>
      organizations.data?.filter((item) =>
        `${item.name} ${item.slug}`
          .toLocaleLowerCase("fr")
          .includes(normalizedSearch),
      ) ?? [],
    [normalizedSearch, organizations.data],
  );
  const copy = actionCopy(action);
  const mutationError =
    actionMutation.error instanceof Error ? actionMutation.error.message : null;
  const serviceIssues =
    overview.data?.services.filter((service) =>
      ["NON_CONFIGURE", "INDISPONIBLE", "ERREUR"].includes(service.status),
    ).length ?? 0;
  const alertCount = overview.data?.alerts.length ?? 0;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["platform-admin"] });

  const confirmAction = () => {
    if (!action || reason.trim().length < 8) return;
    actionMutation.mutate({ selected: action, justification: reason.trim() });
  };

  return (
    <>
      {section.key !== "overview" && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            mb: 3,
            justifyContent: "space-between",
            alignItems: { sm: "center" },
          }}
        >
          <Box>
            <Typography variant="overline" color="text.secondary">
              Administration plateforme
            </Typography>
            <Typography
              component="h1"
              variant="h1"
              tabIndex={-1}
              ref={titleRef}
              sx={{ outline: "none", mt: 0.5 }}
            >
              {section.label}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {section.description}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshRounded />}
            onClick={() => void refresh()}
            disabled={activeQuery?.isFetching}
            sx={{
              alignSelf: { xs: "flex-start", sm: "center" },
              flexShrink: 0,
            }}
          >
            Actualiser les données
          </Button>
        </Stack>
      )}
      {hasError && (
        <Alert
          severity="error"
          sx={{ mb: 2.5 }}
          action={
            <Button color="inherit" onClick={() => void refresh()}>
              Réessayer
            </Button>
          }
        >
          Les informations de cette section ne sont pas disponibles.
        </Alert>
      )}
      {section.key === "overview" && (
        <>
          <Card
            sx={{
              mb: 2,
              overflow: "hidden",
              color: "#fff",
              border: 0,
              background:
                "radial-gradient(circle at 82% 18%, rgba(242,197,107,.19), transparent 28%), linear-gradient(118deg, #102d25 0%, #164737 62%, #1a5944 100%)",
            }}
          >
            <CardContent
              sx={{
                p: { xs: 2.5, md: 3.5 },
                "&:last-child": { pb: { xs: 2.5, md: 3.5 } },
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={3}
                sx={{
                  justifyContent: "space-between",
                  alignItems: { md: "center" },
                }}
              >
                <Box sx={{ maxWidth: 720 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", mb: 1.2 }}
                  >
                    <ShieldOutlined sx={{ color: "#f2c56b", fontSize: 20 }} />
                    <Typography
                      variant="overline"
                      sx={{
                        color: "rgba(255,255,255,.72)",
                        letterSpacing: ".12em",
                      }}
                    >
                      Administration de la plateforme
                    </Typography>
                  </Stack>
                  <Typography
                    component="h1"
                    tabIndex={-1}
                    ref={titleRef}
                    sx={{
                      outline: "none",
                      fontSize: { xs: 28, md: 32 },
                      fontWeight: 700,
                      lineHeight: 1.12,
                      letterSpacing: "-.025em",
                    }}
                  >
                    Centre de contrôle Fiscora
                  </Typography>
                  <Typography
                    sx={{
                      mt: 1.1,
                      color: "rgba(255,255,255,.72)",
                      maxWidth: 640,
                    }}
                  >
                    Suivez la disponibilité, la sécurité et l’activité globale
                    sans accéder aux données comptables des cabinets.
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: 2.2, flexWrap: "wrap", gap: 1 }}
                  >
                    <Chip
                      icon={<CheckCircleOutlineRounded />}
                      label={
                        serviceIssues
                          ? `${serviceIssues} service(s) à vérifier`
                          : "Services essentiels disponibles"
                      }
                      size="small"
                      sx={{
                        color: serviceIssues ? "#ffe1b2" : "#d8f4e8",
                        bgcolor: "rgba(255,255,255,.1)",
                        border: "1px solid rgba(255,255,255,.14)",
                        "& .MuiChip-icon": { color: "inherit" },
                      }}
                    />
                    <Chip
                      label={`${alertCount} alerte${alertCount === 1 ? "" : "s"}`}
                      size="small"
                      sx={{
                        color: "rgba(255,255,255,.8)",
                        bgcolor: "rgba(255,255,255,.07)",
                        border: "1px solid rgba(255,255,255,.12)",
                      }}
                    />
                  </Stack>
                </Box>
                <Stack
                  sx={{
                    alignItems: { xs: "flex-start", md: "flex-end" },
                    minWidth: 210,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: "rgba(255,255,255,.58)", mb: 1 }}
                  >
                    Dernière mise à jour ·{" "}
                    {formatDate(overview.data?.generatedAtUtc ?? null)}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<RefreshRounded />}
                    onClick={() => void refresh()}
                    disabled={overview.isFetching}
                    sx={{
                      color: "#14382d",
                      bgcolor: "#fff",
                      px: 2.2,
                      "&:hover": { bgcolor: "#f4f7f5" },
                      "&.Mui-disabled": { bgcolor: "rgba(255,255,255,.7)" },
                    }}
                  >
                    {overview.isFetching
                      ? "Actualisation…"
                      : "Actualiser les données"}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Box className="metric-grid">
            <MetricCard
              label="Cabinets"
              value={overview.data?.totals.organizationsTotal ?? 0}
              hint={`${overview.data?.totals.organizationsActive ?? 0} actifs`}
              icon={ApartmentOutlined}
              color="#6672d8"
              loading={isLoading}
            />
            <MetricCard
              label="Utilisateurs"
              value={overview.data?.totals.usersTotal ?? 0}
              hint={`${overview.data?.totals.usersActive ?? 0} actifs`}
              icon={GroupsOutlined}
              color="#3f7c8d"
              loading={isLoading}
            />
            <MetricCard
              label="Dossiers actifs"
              value={overview.data?.totals.dossiersActive ?? 0}
              hint="Indicateur d’adoption global"
              icon={DescriptionOutlined}
              color="#2f7d5d"
              loading={isLoading}
            />
            <MetricCard
              label="Stockage documentaire"
              value={formatBytes(overview.data?.totals.storageBytes ?? 0)}
              hint={`${overview.data?.totals.documentsTotal ?? 0} documents`}
              icon={StorageOutlined}
              color="#bd6b4f"
              loading={isLoading}
            />
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0, 1.45fr) minmax(320px, .55fr)",
              },
              gap: 2.5,
              mt: 2.5,
            }}
          >
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack
                  direction="row"
                  sx={{
                    mb: 2.5,
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Typography variant="h3">
                      Services et intégrations
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.4 }}
                    >
                      Configuration et disponibilité des briques essentielles.
                    </Typography>
                  </Box>
                  <Chip
                    label={`${overview.data?.services.length ?? 0} services`}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
                {overview.isLoading && <CircularProgress size={28} />}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                    },
                    gap: 1.25,
                  }}
                >
                  {overview.data?.services.map((service) => (
                    <Box
                      key={service.code}
                      sx={{
                        minHeight: 118,
                        p: 1.75,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2.5,
                        bgcolor: "#fbfcfb",
                      }}
                    >
                      {(() => {
                        const meta = serviceMeta[
                          service.code as keyof typeof serviceMeta
                        ] ?? {
                          icon: CheckCircleOutlineRounded,
                          color: "#45665b",
                          background: "#edf3f0",
                        };
                        const Icon = meta.icon;
                        return (
                          <Stack
                            direction="row"
                            sx={{
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                            }}
                          >
                            <Box
                              sx={{
                                width: 34,
                                height: 34,
                                borderRadius: 2,
                                display: "grid",
                                placeItems: "center",
                                bgcolor: meta.background,
                                color: meta.color,
                              }}
                            >
                              <Icon sx={{ fontSize: 19 }} />
                            </Box>
                            <Chip
                              label={service.status.replace(/_/g, " ")}
                              size="small"
                              color={serviceColor(service.status)}
                              variant="outlined"
                            />
                          </Stack>
                        );
                      })()}
                      <Typography sx={{ fontWeight: 700, mt: 1.35 }}>
                        {service.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 0.25 }}
                      >
                        {service.detail}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack
                  direction="row"
                  sx={{
                    mb: 2.5,
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Typography variant="h3">À surveiller</Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.4 }}
                    >
                      Anomalies nécessitant une action.
                    </Typography>
                  </Box>
                  <Chip
                    icon={<WarningAmberRounded />}
                    label={alertCount}
                    size="small"
                    color={alertCount ? "warning" : "success"}
                    variant="outlined"
                  />
                </Stack>
                {!overview.isLoading && !overview.data?.alerts.length && (
                  <Box
                    sx={{
                      minHeight: 190,
                      display: "grid",
                      placeItems: "center",
                      textAlign: "center",
                      p: 2,
                      borderRadius: 2.5,
                      bgcolor: "#f5faf7",
                      border: "1px solid #dcece4",
                    }}
                  >
                    <Box>
                      <CheckCircleOutlineRounded
                        sx={{ fontSize: 36, color: "success.main", mb: 1 }}
                      />
                      <Typography sx={{ fontWeight: 700 }}>
                        Tout est sous contrôle
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.4 }}
                      >
                        Aucune alerte opérationnelle active.
                      </Typography>
                    </Box>
                  </Box>
                )}
                <Stack spacing={1.2}>
                  {overview.data?.alerts.map((item) => (
                    <Alert
                      key={item.code}
                      severity={item.severity}
                      variant="outlined"
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.count} élément{item.count === 1 ? "" : "s"}{" "}
                        concerné
                        {item.count === 1 ? "" : "s"}
                      </Typography>
                    </Alert>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </>
      )}

      {section.key !== "overview" && (
        <Card sx={{ overflow: "hidden", minWidth: 0 }}>
          {activeQuery?.isFetching && (
            <LinearProgress aria-label="Chargement de la section" />
          )}
          {section.key === "cabinets" && (
            <Stack
              direction={{ xs: "column", md: "row" }}
              sx={{
                px: 2,
                bgcolor: "#fbfcfb",
                borderBottom: "1px solid",
                borderColor: "divider",
                justifyContent: "space-between",
                alignItems: { xs: "stretch", md: "center" },
                py: 1,
                gap: 1,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                {filteredOrganizations.length} cabinet(s)
              </Typography>
              <TextField
                size="small"
                value={search}
                onChange={(event) =>
                  setSearches((current) => ({
                    ...current,
                    [section.key]: event.target.value,
                  }))
                }
                label="Rechercher un cabinet"
                placeholder="Rechercher un cabinet"
                sx={{ minWidth: { md: 260 }, my: 1 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRounded fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Stack>
          )}

          {section.key === "cabinets" && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Cabinet</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell align="right">Membres</TableCell>
                    <TableCell align="right">Dossiers</TableCell>
                    <TableCell align="right">Documents</TableCell>
                    <TableCell>Dernière activité</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredOrganizations.map((organization) => (
                    <TableRow key={organization.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>
                          {organization.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {organization.slug} ·{" "}
                          {formatBytes(organization.storageBytes)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                          <Chip
                            label={organization.isActive ? "Actif" : "Suspendu"}
                            size="small"
                            color={
                              organization.isActive ? "success" : "default"
                            }
                          />
                          {!organization.isActive &&
                            organization.suspensionReason && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {organization.suspensionReason}
                              </Typography>
                            )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        {organization.membersCount}
                      </TableCell>
                      <TableCell align="right">
                        {organization.dossiersCount}
                      </TableCell>
                      <TableCell align="right">
                        {organization.documentsCount}
                      </TableCell>
                      <TableCell>
                        {formatDate(organization.lastActivityAtUtc)}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          color={organization.isActive ? "error" : "success"}
                          startIcon={
                            organization.isActive ? (
                              <BlockOutlined />
                            ) : (
                              <RestartAltRounded />
                            )
                          }
                          onClick={() => {
                            setReason("");
                            setAction({
                              kind: "organization-status",
                              id: organization.id,
                              name: organization.name,
                              isActive: organization.isActive,
                            });
                          }}
                        >
                          {organization.isActive ? "Suspendre" : "Réactiver"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!organizations.isLoading &&
                    !organizations.isError &&
                    !filteredOrganizations.length && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          Aucun cabinet trouvé.
                        </TableCell>
                      </TableRow>
                    )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {section.key === "utilisateurs" && (
            <PlatformUsersPanel
              users={users.data ?? []}
              currentUserId={currentUserId}
              search={search}
              onSearchChange={(value) =>
                setSearches((current) => ({ ...current, [section.key]: value }))
              }
              loading={users.isLoading}
              hasError={users.isError}
              onStatusChange={(user) => {
                setReason("");
                setAction({
                  kind: "user-status",
                  id: user.id,
                  name: user.fullName,
                  isActive: user.isActive,
                });
              }}
              onRevoke={(user) => {
                setReason("");
                setAction({
                  kind: "revoke-sessions",
                  id: user.id,
                  name: user.fullName,
                  activeSessions: user.activeSessionsCount,
                });
              }}
            />
          )}

          {section.key === "abonnements" && <PlatformSubscriptionsPanel />}

          {section.key === "traitements" && (
            <Box sx={{ p: 3 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                sx={{ mb: 2.5, justifyContent: "space-between" }}
              >
                <Box>
                  <Typography variant="h3">Traitements de fond</Typography>
                  <Typography color="text.secondary">
                    Suivi technique des extractions, invitations et
                    transmissions.
                  </Typography>
                </Box>
                <Chip
                  icon={<SyncRounded />}
                  label={`Mis à jour ${formatDate(jobs.data?.generatedAtUtc ?? null)}`}
                  variant="outlined"
                />
              </Stack>
              {jobs.isLoading && <CircularProgress size={28} />}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(3, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                {jobs.data?.pipelines.map((pipeline) => (
                  <Card key={pipeline.code} variant="outlined">
                    <CardContent>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ justifyContent: "space-between", mb: 2 }}
                      >
                        <Typography sx={{ fontWeight: 700 }}>
                          {pipeline.label}
                        </Typography>
                        <Chip
                          size="small"
                          label={pipeline.status.replace("_", " ")}
                          color={
                            pipeline.status === "ERREUR"
                              ? "error"
                              : pipeline.status === "EN_COURS"
                                ? "info"
                                : "success"
                          }
                        />
                      </Stack>
                      <Stack direction="row" spacing={3}>
                        <Box>
                          <Typography variant="h4">
                            {pipeline.pending}
                          </Typography>
                          <Typography variant="caption">En attente</Typography>
                        </Box>
                        <Box>
                          <Typography variant="h4">
                            {pipeline.processing}
                          </Typography>
                          <Typography variant="caption">En cours</Typography>
                        </Box>
                        <Box>
                          <Typography variant="h4" color="error.main">
                            {pipeline.failed}
                          </Typography>
                          <Typography variant="caption">Échecs</Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ my: 1.5 }} />
                      <Typography variant="caption" color="text.secondary">
                        Dernier échec : {formatDate(pipeline.lastFailureAtUtc)}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
              <Alert severity="info" sx={{ mt: 2 }}>
                Les relances automatiques seront activées après branchement des
                files de production. Cette vue ne permet pas de modifier les
                données métier.
              </Alert>
            </Box>
          )}

          {section.key === "emails" && <PlatformEmailPanel />}

          {section.key === "supervision" && <PlatformMonitoringPanel />}
          {section.key === "training" && <PlatformTrainingPanel />}
        </Card>
      )}

      <Dialog
        open={Boolean(action)}
        onClose={() => {
          if (!actionMutation.isPending) {
            setAction(null);
            setReason("");
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{copy?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {copy?.description}
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Justification obligatoire"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            error={reason.length > 0 && reason.trim().length < 8}
            helperText="Minimum 8 caractères. Cette justification sera auditée."
          />
          {mutationError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {mutationError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAction(null);
              setReason("");
            }}
            disabled={actionMutation.isPending}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            color={copy?.destructive ? "error" : "success"}
            onClick={confirmAction}
            disabled={reason.trim().length < 8 || actionMutation.isPending}
          >
            {actionMutation.isPending ? "Traitement…" : copy?.confirm}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(feedback)}
        autoHideDuration={5000}
        onClose={() => setFeedback(null)}
        message={feedback}
      />
    </>
  );
}
