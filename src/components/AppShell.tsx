import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  AccountBalanceOutlined,
  AssessmentOutlined,
  BadgeOutlined,
  BusinessCenterOutlined,
  CalendarMonthOutlined,
  DashboardOutlined,
  DescriptionOutlined,
  FolderOutlined,
  GroupsOutlined,
  MenuRounded,
  NotificationsNoneOutlined,
  PaidOutlined,
  QueryStatsOutlined,
  ReceiptLongOutlined,
  SettingsOutlined,
  TaskAltOutlined,
  TimelineOutlined,
  WalletOutlined,
  ApartmentOutlined,
  LanguageOutlined,
  CloudDoneOutlined,
} from "@mui/icons-material";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { Brand } from "./Brand";
import { LanguageSwitcher } from "./LanguageSwitcher";

const drawerWidth = 276;

const navGroups = [
  {
    label: "Pilotage",
    items: [
      { label: "Tableau de bord", path: "/", icon: DashboardOutlined },
      {
        label: "Dossiers clients",
        path: "/dossiers",
        icon: FolderOutlined,
        permission: "dossiers.view",
      },
      {
        label: "Tâches",
        path: "/taches",
        icon: TaskAltOutlined,
        permission: "tasks.view",
      },
      {
        label: "Calendrier fiscal",
        path: "/obligations",
        icon: CalendarMonthOutlined,
        permission: "obligations.view",
      },
    ],
  },
  {
    label: "Production comptable",
    items: [
      {
        label: "Documents",
        path: "/documents",
        icon: DescriptionOutlined,
        permission: "documents.view",
      },
      {
        label: "Achats & ventes",
        path: "/factures",
        icon: ReceiptLongOutlined,
        permission: "business_invoices.view",
      },
      {
        label: "Comptabilité",
        path: "/comptabilite",
        icon: BusinessCenterOutlined,
        permission: "accounting.view",
      },
      {
        label: "Banque",
        path: "/banque",
        icon: AccountBalanceOutlined,
        permission: "bank_reconciliation.view",
      },
      {
        label: "Commerce extérieur",
        path: "/commerce-exterieur",
        icon: LanguageOutlined,
        permission: "foreign_trade.view",
      },
      {
        label: "Facturation TTN",
        path: "/facturation-electronique",
        icon: CloudDoneOutlined,
        permission: "electronic_invoices.view",
      },
      {
        label: "Immobilisations",
        path: "/immobilisations",
        icon: ApartmentOutlined,
        permission: "fixed_assets.view",
      },
      {
        label: "États financiers",
        path: "/etats-financiers",
        icon: AssessmentOutlined,
        permission: "financial_statements.view",
      },
    ],
  },
  {
    label: "Fiscal & social",
    items: [
      {
        label: "Déclarations",
        path: "/declarations",
        icon: TimelineOutlined,
        permission: "declarations.view",
      },
      {
        label: "Paie",
        path: "/paie",
        icon: BadgeOutlined,
        permission: "payroll.view",
      },
      {
        label: "Paramètres fiscaux",
        path: "/fiscalite",
        icon: SettingsOutlined,
        permission: "fiscal_settings.view",
      },
    ],
  },
  {
    label: "Gestion du cabinet",
    items: [
      {
        label: "Honoraires",
        path: "/honoraires",
        icon: PaidOutlined,
        permission: "billing.view",
      },
      {
        label: "Temps de travail",
        path: "/temps",
        icon: WalletOutlined,
        permission: "time_tracking.view",
      },
      {
        label: "Rentabilité",
        path: "/rentabilite",
        icon: QueryStatsOutlined,
        permission: "profitability.view",
      },
      {
        label: "Équipe & accès",
        path: "/equipe",
        icon: GroupsOutlined,
        permission: "users.view",
      },
    ],
  },
];

export function AppShell() {
  const { session, organization, selectOrganization, can, logout } = useAuth();
  const { direction, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("lg"));
  const location = useLocation();

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !item.permission || can(item.permission),
          ),
        }))
        .filter((group) => group.items.length),
    [can],
  );

  const drawer = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#103a2f",
        color: "#fff",
      }}
    >
      <Box sx={{ p: 3 }}>
        <Brand dark />
      </Box>
      <Divider sx={{ borderColor: "rgba(255,255,255,.09)" }} />
      <Box sx={{ overflowY: "auto", px: 1.5, py: 1.5, flex: 1 }}>
        {visibleGroups.map((group) => (
          <Box key={group.label} sx={{ mb: 2.5 }}>
            <Typography
              variant="overline"
              sx={{
                px: 1.5,
                color: "rgba(255,255,255,.42)",
                fontSize: 10,
                letterSpacing: ".14em",
              }}
            >
              {t(group.label)}
            </Typography>
            <List disablePadding>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <ListItemButton
                    key={item.path}
                    component={NavLink}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    selected={location.pathname === item.path}
                    sx={{
                      my: 0.35,
                      borderRadius: 2,
                      color: "rgba(255,255,255,.72)",
                      minHeight: 43,
                      "& .MuiListItemIcon-root": { color: "inherit" },
                      "&.Mui-selected": {
                        bgcolor: "#f2c56b",
                        color: "#173a30",
                        "&:hover": { bgcolor: "#f2c56b" },
                      },
                      "&:hover": {
                        bgcolor: "rgba(255,255,255,.07)",
                        color: "#fff",
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 38 }}>
                      <Icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography sx={{ fontSize: 14, fontWeight: 650 }}>
                          {t(item.label)}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>
      <Box sx={{ p: 2, borderTop: "1px solid rgba(255,255,255,.09)" }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,.45)" }}>
          Compta TN · {t("Version de travail")}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: "rgba(255,253,248,.94)",
          color: "text.primary",
          borderBottom: "1px solid",
          borderColor: "divider",
          ml: desktop && direction === "ltr" ? `${drawerWidth}px` : 0,
          mr: desktop && direction === "rtl" ? `${drawerWidth}px` : 0,
          width: desktop ? `calc(100% - ${drawerWidth}px)` : "100%",
          backdropFilter: "blur(12px)",
        }}
      >
        <Toolbar sx={{ minHeight: "72px !important", gap: 2 }}>
          {!desktop && (
            <IconButton onClick={() => setMobileOpen(true)}>
              <MenuRounded />
            </IconButton>
          )}
          <FormControl size="small" sx={{ minWidth: { xs: 170, sm: 250 } }}>
            <InputLabel>{t("Cabinet")}</InputLabel>
            <Select
              value={organization?.id ?? ""}
              label={t("Cabinet")}
              onChange={(event) => selectOrganization(event.target.value)}
            >
              {session?.organizations.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ flex: 1 }} />
          <LanguageSwitcher />
          {can("notifications.view") && (
            <Tooltip title={t("Notifications")}>
              <IconButton>
                <NotificationsNoneOutlined />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t("Mon compte")}>
            <IconButton
              onClick={(event) => setAccountAnchor(event.currentTarget)}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: "primary.main",
                  fontSize: 14,
                }}
              >
                {session?.user.fullName
                  .split(" ")
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={accountAnchor}
            open={Boolean(accountAnchor)}
            onClose={() => setAccountAnchor(null)}
          >
            <Box sx={{ px: 2, py: 1, minWidth: 220 }}>
              <Typography sx={{ fontWeight: 700 }}>
                {session?.user.fullName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {session?.user.email}
              </Typography>
              <Typography variant="caption" color="primary.main">
                {organization?.role}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => void logout()}>{t("Se déconnecter")}</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}
      >
        <Drawer
          anchor={direction === "rtl" ? "right" : "left"}
          variant={desktop ? "permanent" : "temporary"}
          open={desktop || mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ "& .MuiDrawer-paper": { width: drawerWidth, border: 0 } }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flex: 1, minWidth: 0, pt: "72px" }}>
        <Box sx={{ p: { xs: 2, sm: 3, xl: 4 }, maxWidth: 1600, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
