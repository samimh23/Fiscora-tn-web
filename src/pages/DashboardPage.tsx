import { useState } from "react";
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
  LinearProgress,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  ArrowForwardRounded,
  AssignmentTurnedInOutlined,
  DescriptionOutlined,
  FolderOutlined,
  NotificationsOutlined,
  PaidOutlined,
  PostAddRounded,
  TaskAltOutlined,
} from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import type {
  BillingSummary,
  DossierSummary,
  NotificationItem,
  PagedResponse,
  WorkTask,
} from "../types/api";

const money = (value?: string) =>
  new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
  }).format(Number(value ?? 0));
const date = (value: string) =>
  new Intl.DateTimeFormat("fr-TN", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
const todayLabel = new Intl.DateTimeFormat("fr-TN", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

export function DashboardPage() {
  const { session, organization, can } = useAuth();
  const [queue, setQueue] = useState<"overdue" | "review">("overdue");
  const id = organization?.id;
  const dossiers = useQuery({
    queryKey: ["dossiers", id, "dashboard"],
    queryFn: () =>
      api.get<PagedResponse<DossierSummary>>(
        `/api/organizations/${id}/dossiers?page=1&pageSize=6`,
      ),
    enabled: Boolean(id && can("dossiers.view")),
  });
  const overdueTasks = useQuery({
    queryKey: ["tasks", id, "overdue"],
    queryFn: () =>
      api.get<PagedResponse<WorkTask>>(
        `/api/organizations/${id}/tasks?overdue=true&page=1&pageSize=8`,
      ),
    enabled: Boolean(id && can("tasks.view")),
  });
  const reviewTasks = useQuery({
    queryKey: ["tasks", id, "review"],
    queryFn: () =>
      api.get<PagedResponse<WorkTask>>(
        `/api/organizations/${id}/tasks?status=PRETE_POUR_REVISION&page=1&pageSize=8`,
      ),
    enabled: Boolean(id && can("tasks.view")),
  });
  const billing = useQuery({
    queryKey: ["billing-summary", id],
    queryFn: () =>
      api.get<BillingSummary>(`/api/organizations/${id}/billing/summary`),
    enabled: Boolean(id && can("billing.view")),
  });
  const notifications = useQuery({
    queryKey: ["notifications", id, "unread"],
    queryFn: () =>
      api.get<NotificationItem[]>(
        `/api/organizations/${id}/notifications?unreadOnly=true`,
      ),
    enabled: Boolean(id && can("notifications.view")),
  });

  const hasError = [
    dossiers,
    overdueTasks,
    reviewTasks,
    billing,
    notifications,
  ].some((query) => query.isError);
  const firstName = session?.user.fullName.split(" ")[0] ?? "";
  const selectedTasks =
    queue === "overdue" ? overdueTasks.data?.items : reviewTasks.data?.items;
  const selectedLoading =
    queue === "overdue" ? overdueTasks.isLoading : reviewTasks.isLoading;

  return (
    <>
      <PageHeader
        eyebrow={todayLabel}
        title={`Ma journée, ${firstName}`}
        description={`Les priorités de ${organization?.name ?? "votre cabinet"}, regroupées au même endroit.`}
        action={
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            {can("documents.upload") && (
              <Button
                component={RouterLink}
                to="/documents"
                variant="outlined"
                startIcon={<DescriptionOutlined />}
              >
                Déposer des pièces
              </Button>
            )}
            {can("dossiers.create") && (
              <Button
                component={RouterLink}
                to="/dossiers?nouveau=1"
                variant="contained"
                startIcon={<AddRounded />}
              >
                Nouveau dossier
              </Button>
            )}
          </Stack>
        }
      />
      {hasError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Une partie des informations n’a pas pu être actualisée.
        </Alert>
      )}

      <div className="metric-grid">
        <MetricCard
          label="À traiter aujourd’hui"
          value={overdueTasks.data?.total ?? 0}
          hint="Tâches arrivées à échéance"
          icon={TaskAltOutlined}
          color="#bd4f4f"
          loading={overdueTasks.isLoading}
        />
        <MetricCard
          label="En attente de validation"
          value={reviewTasks.data?.total ?? 0}
          hint="Travaux soumis par l’équipe"
          icon={AssignmentTurnedInOutlined}
          color="#c47a24"
          loading={reviewTasks.isLoading}
        />
        <MetricCard
          label="Dossiers actifs"
          value={dossiers.data?.total ?? 0}
          hint="Portefeuille accessible"
          icon={FolderOutlined}
          loading={dossiers.isLoading}
        />
        <MetricCard
          label="Honoraires à encaisser"
          value={money(billing.data?.outstanding)}
          hint="Solde facturé non réglé"
          icon={PaidOutlined}
          color="#5c60b8"
          loading={billing.isLoading}
        />
      </div>

      <Box className="dashboard-grid" sx={{ mt: 2 }}>
        <Card>
          <Box
            sx={{
              px: 2.5,
              pt: 2,
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography variant="h3" sx={{ fontSize: 20 }}>
                File de travail
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Commencez par les éléments qui demandent une action.
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              to="/taches"
              endIcon={<ArrowForwardRounded />}
              disabled={!can("tasks.view")}
            >
              Toutes les tâches
            </Button>
          </Box>
          <Tabs
            value={queue}
            onChange={(_, value) => setQueue(value)}
            sx={{ px: 2, mt: 1 }}
          >
            <Tab
              value="overdue"
              label={`En retard (${overdueTasks.data?.total ?? 0})`}
            />
            <Tab
              value="review"
              label={`À valider (${reviewTasks.data?.total ?? 0})`}
            />
          </Tabs>
          <Divider />
          {selectedLoading && (
            <Box sx={{ p: 2.5 }}>
              <Skeleton height={58} />
              <Skeleton height={58} />
              <Skeleton height={58} />
            </Box>
          )}
          {!selectedLoading && !selectedTasks?.length && (
            <Box sx={{ p: 5, textAlign: "center" }}>
              <TaskAltOutlined sx={{ color: "success.main", fontSize: 34 }} />
              <Typography sx={{ mt: 1, fontWeight: 750 }}>
                Rien à traiter dans cette file
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Vous pouvez poursuivre avec les dossiers récemment ouverts.
              </Typography>
            </Box>
          )}
          {selectedTasks?.map((task, index) => (
            <Box key={task.id}>
              <Box
                component={RouterLink}
                to={`/dossiers/${task.dossierId}?espace=suivi`}
                sx={{
                  px: 2.5,
                  py: 1.5,
                  display: "flex",
                  gap: 1.5,
                  alignItems: "center",
                  "&:hover": { bgcolor: "#f8faf8" },
                }}
              >
                <Box
                  sx={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    bgcolor:
                      queue === "overdue" ? "error.main" : "warning.main",
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography noWrap sx={{ fontWeight: 700, fontSize: 14 }}>
                    {task.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {task.dossierName ?? "Dossier"} ·{" "}
                    {task.assigneeName ?? "Non affectée"}
                  </Typography>
                </Box>
                <Chip
                  label={date(task.dueOn)}
                  size="small"
                  color={queue === "overdue" ? "error" : "warning"}
                  variant="outlined"
                />
              </Box>
              {index < (selectedTasks?.length ?? 0) - 1 && <Divider />}
            </Box>
          ))}
        </Card>

        <Stack spacing={2}>
          <Card>
            <CardContent sx={{ p: 2.25 }}>
              <Typography variant="h3" sx={{ fontSize: 18, mb: 1.5 }}>
                Accès rapides
              </Typography>
              <Stack spacing={0.75}>
                <Button
                  component={RouterLink}
                  to="/documents"
                  variant="text"
                  startIcon={<DescriptionOutlined />}
                  sx={{ justifyContent: "flex-start" }}
                >
                  Collecter les documents
                </Button>
                <Button
                  component={RouterLink}
                  to="/factures"
                  variant="text"
                  startIcon={<PostAddRounded />}
                  sx={{ justifyContent: "flex-start" }}
                >
                  Traiter les achats et ventes
                </Button>
                <Button
                  component={RouterLink}
                  to="/comptabilite"
                  variant="text"
                  startIcon={<AssignmentTurnedInOutlined />}
                  sx={{ justifyContent: "flex-start" }}
                >
                  Ouvrir la production comptable
                </Button>
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ p: 2.25 }}>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}
              >
                <NotificationsOutlined color="primary" fontSize="small" />
                <Typography variant="h3" sx={{ fontSize: 18 }}>
                  Notifications
                </Typography>
                <Chip label={notifications.data?.length ?? 0} size="small" />
              </Box>
              {notifications.isLoading && <Skeleton height={80} />}
              {!notifications.isLoading && !notifications.data?.length && (
                <Typography variant="body2" color="text.secondary">
                  Aucune nouvelle notification.
                </Typography>
              )}
              {notifications.data?.slice(0, 3).map((item) => (
                <Box key={item.id} sx={{ py: 0.8 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {item.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.message}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
          {can("billing.view") && (
            <Card>
              <CardContent sx={{ p: 2.25 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mb: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Encaissement
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 750 }}>
                    {money(billing.data?.paid)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(
                    100,
                    Number(billing.data?.billed)
                      ? (Number(billing.data?.paid) /
                          Number(billing.data?.billed)) *
                          100
                      : 0,
                  )}
                  sx={{ height: 7, borderRadius: 5 }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.8 }}
                >
                  {money(billing.data?.billed)} facturés
                </Typography>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Box>

      {can("dossiers.view") && (
        <Card sx={{ mt: 2 }}>
          <Box
            sx={{
              px: 2.5,
              py: 1.75,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Box>
              <Typography variant="h3" sx={{ fontSize: 18 }}>
                Dossiers récents
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Reprenez rapidement un client.
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              to="/dossiers"
              endIcon={<ArrowForwardRounded />}
            >
              Voir le portefeuille
            </Button>
          </Box>
          <Divider />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                lg: "repeat(3, 1fr)",
              },
            }}
          >
            {dossiers.data?.items.slice(0, 6).map((item) => (
              <Box
                key={item.id}
                component={RouterLink}
                to={`/dossiers/${item.id}`}
                sx={{
                  p: 2,
                  borderInlineEnd: "1px solid",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:hover": { bgcolor: "#f8faf8" },
                }}
              >
                <Typography sx={{ fontWeight: 750 }} noWrap>
                  {item.legalName}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {item.taxIdentifier || "Matricule fiscal à compléter"} ·{" "}
                  {item.activitySector || "Activité à compléter"}
                </Typography>
              </Box>
            ))}
          </Box>
        </Card>
      )}
    </>
  );
}
