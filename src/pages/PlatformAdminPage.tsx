import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminPanelSettingsOutlined,
  ApartmentOutlined,
  BlockOutlined,
  CheckCircleOutlineRounded,
  DescriptionOutlined,
  DevicesOutlined,
  GroupsOutlined,
  ManageAccountsOutlined,
  RefreshRounded,
  RestartAltRounded,
  SearchRounded,
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
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { api, readSession } from "../api/client";
import { MetricCard } from "../components/MetricCard";
import { PlatformSaasAnalyticsPanel } from "../features/saas/PlatformSaasAnalyticsPanel";
import { PlatformSubscriptionsPanel } from "../features/saas/PlatformSubscriptionsPanel";
import type {
  PlatformAuditLog,
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
      title: "Révoquer toutes les sessions",
      description: `${action.name} devra se reconnecter sur tous ses appareils. La session d’accès actuelle expirera normalement, mais aucun jeton ne pourra être renouvelé.`,
      confirm: "Révoquer les sessions",
      success: `Les sessions de ${action.name} ont été révoquées.`,
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
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<AdminAction | null>(null);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["platform-admin", "overview"],
    queryFn: () => api.get<PlatformOverview>("/api/platform-admin/overview"),
  });
  const organizations = useQuery({
    queryKey: ["platform-admin", "organizations"],
    queryFn: () =>
      api.get<PlatformOrganization[]>("/api/platform-admin/organizations"),
  });
  const users = useQuery({
    queryKey: ["platform-admin", "users"],
    queryFn: () => api.get<PlatformUser[]>("/api/platform-admin/users"),
  });
  const jobs = useQuery({
    queryKey: ["platform-admin", "jobs"],
    queryFn: () =>
      api.get<PlatformJobsOverview>("/api/platform-admin/jobs"),
  });
  const audit = useQuery({
    queryKey: ["platform-admin", "audit"],
    queryFn: () =>
      api.get<PlatformAuditLog[]>("/api/platform-admin/audit-logs"),
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
  const hasError = [overview, organizations, users, jobs, audit].some(
    (query) => query.isError,
  );
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
  const filteredUsers = useMemo(
    () =>
      users.data?.filter((item) =>
        `${item.fullName} ${item.email}`
          .toLocaleLowerCase("fr")
          .includes(normalizedSearch),
      ) ?? [],
    [normalizedSearch, users.data],
  );
  const copy = actionCopy(action);
  const mutationError =
    actionMutation.error instanceof Error ? actionMutation.error.message : null;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["platform-admin"] });

  const confirmAction = () => {
    if (!action || reason.trim().length < 8) return;
    actionMutation.mutate({ selected: action, justification: reason.trim() });
  };

  return (
    <>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{
          mb: 3,
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
        }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{ color: "#6672d8", fontWeight: 800, letterSpacing: ".13em" }}
          >
            Administration Fiscora
          </Typography>
          <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 46 }, mt: 0.4 }}>
            Vue de la plateforme
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.7 }}>
            Sécurité, disponibilité et exploitation du service, sans ouvrir les
            données comptables des clients.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<RefreshRounded />}
          onClick={() => void refresh()}
          sx={{ bgcolor: "#26305f", "&:hover": { bgcolor: "#171c35" } }}
        >
          Actualiser
        </Button>
      </Stack>

      {hasError && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          Certaines informations de la plateforme ne sont pas disponibles.
        </Alert>
      )}

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
          hint={`${overview.data?.totals.activeSessions ?? 0} sessions actives`}
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
          gridTemplateColumns: { xs: "1fr", lg: "1.2fr .8fr" },
          gap: 2.5,
          mt: 2.5,
        }}
      >
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack
              direction="row"
              spacing={1.2}
              sx={{ mb: 2, alignItems: "center" }}
            >
              <CheckCircleOutlineRounded sx={{ color: "#6672d8" }} />
              <Typography variant="h3" sx={{ fontSize: 24 }}>
                État des services
              </Typography>
            </Stack>
            {overview.isLoading && <CircularProgress size={28} />}
            <Stack divider={<Divider flexItem />} spacing={0}>
              {overview.data?.services.map((service) => (
                <Stack
                  key={service.code}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ py: 1.6, justifyContent: "space-between" }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 750 }}>{service.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {service.detail}
                    </Typography>
                  </Box>
                  <Chip
                    label={service.status.replace(/_/g, " ")}
                    size="small"
                    color={
                      service.status === "NON_CONFIGURE"
                        ? "warning"
                        : service.status === "SIMULATION"
                          ? "info"
                          : "success"
                    }
                    variant="outlined"
                  />
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack
              direction="row"
              spacing={1.2}
              sx={{ mb: 2, alignItems: "center" }}
            >
              <WarningAmberRounded color="warning" />
              <Typography variant="h3" sx={{ fontSize: 24 }}>
                Alertes opérationnelles
              </Typography>
              <Chip label={overview.data?.alerts.length ?? 0} size="small" />
            </Stack>
            {!overview.isLoading && !overview.data?.alerts.length && (
              <Alert severity="success">Aucune alerte opérationnelle.</Alert>
            )}
            <Stack spacing={1.2}>
              {overview.data?.alerts.map((item) => (
                <Alert key={item.code} severity={item.severity}>
                  <strong>{item.count}</strong> — {item.label}
                </Alert>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ mt: 2.5 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          sx={{
            px: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "center" },
          }}
        >
          <Tabs
            value={tab}
            onChange={(_event, value: number) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label={`Cabinets (${organizations.data?.length ?? 0})`} />
            <Tab label={`Utilisateurs (${users.data?.length ?? 0})`} />
            <Tab label="Abonnements" />
            <Tab label="Analytics SaaS" />
            <Tab label="Traitements" />
            <Tab label="Journal d’audit" />
          </Tabs>
          {(tab === 0 || tab === 1) && (
            <TextField
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tab === 0 ? "Rechercher un cabinet" : "Rechercher un compte"}
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
          )}
        </Stack>

        {tab === 0 && (
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
                      <Typography sx={{ fontWeight: 750 }}>
                        {organization.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {organization.slug} · {formatBytes(organization.storageBytes)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                        <Chip
                          label={organization.isActive ? "Actif" : "Suspendu"}
                          size="small"
                          color={organization.isActive ? "success" : "default"}
                        />
                        {!organization.isActive && organization.suspensionReason && (
                          <Typography variant="caption" color="text.secondary">
                            {organization.suspensionReason}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{organization.membersCount}</TableCell>
                    <TableCell align="right">{organization.dossiersCount}</TableCell>
                    <TableCell align="right">{organization.documentsCount}</TableCell>
                    <TableCell>{formatDate(organization.lastActivityAtUtc)}</TableCell>
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
                {!filteredOrganizations.length && (
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

        {tab === 1 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Utilisateur</TableCell>
                  <TableCell>Accès</TableCell>
                  <TableCell align="right">Cabinets</TableCell>
                  <TableCell align="right">Sessions</TableCell>
                  <TableCell>Dernière connexion</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 750 }}>{user.fullName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                        <Stack direction="row" spacing={0.8}>
                          <Chip
                            label={user.isActive ? "Actif" : "Désactivé"}
                            size="small"
                            color={user.isActive ? "success" : "default"}
                          />
                          {user.isPlatformAdmin && (
                            <Chip
                              icon={<AdminPanelSettingsOutlined />}
                              label="Admin Fiscora"
                              size="small"
                              sx={{ color: "#4d58b8", bgcolor: "#eef0ff" }}
                            />
                          )}
                        </Stack>
                        {!user.isActive && user.disabledReason && (
                          <Typography variant="caption" color="text.secondary">
                            {user.disabledReason}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{user.membershipsCount}</TableCell>
                    <TableCell align="right">{user.activeSessionsCount}</TableCell>
                    <TableCell>{formatDate(user.lastLoginAtUtc)}</TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ justifyContent: "flex-end" }}
                      >
                        <Button
                          size="small"
                          disabled={
                            user.id === currentUserId ||
                            user.activeSessionsCount === 0
                          }
                          startIcon={<DevicesOutlined />}
                          onClick={() => {
                            setReason("");
                            setAction({
                              kind: "revoke-sessions",
                              id: user.id,
                              name: user.fullName,
                              activeSessions: user.activeSessionsCount,
                            });
                          }}
                        >
                          Sessions
                        </Button>
                        <Button
                          size="small"
                          disabled={user.id === currentUserId}
                          color={user.isActive ? "error" : "success"}
                          startIcon={
                            user.isActive ? (
                              <BlockOutlined />
                            ) : (
                              <ManageAccountsOutlined />
                            )
                          }
                          onClick={() => {
                            setReason("");
                            setAction({
                              kind: "user-status",
                              id: user.id,
                              name: user.fullName,
                              isActive: user.isActive,
                            });
                          }}
                        >
                          {user.id === currentUserId
                            ? "Votre compte"
                            : user.isActive
                              ? "Désactiver"
                              : "Réactiver"}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredUsers.length && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Aucun utilisateur trouvé.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 2 && <PlatformSubscriptionsPanel />}

        {tab === 3 && <PlatformSaasAnalyticsPanel />}

        {tab === 4 && (
          <Box sx={{ p: 3 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              sx={{ mb: 2.5, justifyContent: "space-between" }}
            >
              <Box>
                <Typography variant="h3" sx={{ fontSize: 24 }}>
                  Traitements de fond
                </Typography>
                <Typography color="text.secondary">
                  Suivi technique des extractions, invitations et transmissions.
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
                      <Typography sx={{ fontWeight: 800 }}>
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
                        <Typography variant="h4">{pipeline.pending}</Typography>
                        <Typography variant="caption">En attente</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h4">{pipeline.processing}</Typography>
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

        {tab === 5 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Acteur</TableCell>
                  <TableCell>Cabinet</TableCell>
                  <TableCell>Objet</TableCell>
                  <TableCell>Justification</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {audit.data?.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{formatDate(item.createdAtUtc)}</TableCell>
                    <TableCell>
                      <Typography component="code" variant="body2">
                        {item.action}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.actorName ?? "Système"}</TableCell>
                    <TableCell>{item.organizationName ?? "Plateforme"}</TableCell>
                    <TableCell>
                      {item.entityType} · {item.entityId.slice(0, 8)}
                    </TableCell>
                    <TableCell>{item.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

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
