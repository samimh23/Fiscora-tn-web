import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  AppBar,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Collapse,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  AccountBalanceOutlined,
  AddRounded,
  AdminPanelSettingsOutlined,
  ApartmentOutlined,
  AssessmentOutlined,
  BadgeOutlined,
  BusinessCenterOutlined,
  CalendarMonthOutlined,
  CloudDoneOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  DescriptionOutlined,
  ExpandLessRounded,
  ExpandMoreRounded,
  FolderOutlined,
  GroupsOutlined,
  LanguageOutlined,
  MenuRounded,
  NotificationsNoneOutlined,
  PaidOutlined,
  QueryStatsOutlined,
  ReceiptLongOutlined,
  SearchRounded,
  SettingsOutlined,
  TaskAltOutlined,
  TimelineOutlined,
  WalletOutlined,
} from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import type { DossierSummary, PagedResponse } from "../types/api";
import { Brand } from "./Brand";
import { LanguageSwitcher } from "./LanguageSwitcher";

const drawerWidth = 248;

type NavItem = {
  label: string;
  path: string;
  icon: typeof DashboardOutlined;
  permission?: string;
};

const primaryItems: NavItem[] = [
  { label: "Ma journée", path: "/", icon: DashboardOutlined },
  {
    label: "Dossiers clients",
    path: "/dossiers",
    icon: FolderOutlined,
    permission: "dossiers.view",
  },
];

const navSections: Array<{
  key: string;
  label: string;
  icon: typeof DashboardOutlined;
  items: NavItem[];
}> = [
  {
    key: "production",
    label: "Production",
    icon: BusinessCenterOutlined,
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
    key: "fiscal",
    label: "Fiscal & social",
    icon: CalendarMonthOutlined,
    items: [
      {
        label: "Calendrier fiscal",
        path: "/obligations",
        icon: CalendarMonthOutlined,
        permission: "obligations.view",
      },
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
    key: "cabinet",
    label: "Cabinet",
    icon: GroupsOutlined,
    items: [
      {
        label: "Tâches",
        path: "/taches",
        icon: TaskAltOutlined,
        permission: "tasks.view",
      },
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
      {
        label: "Abonnement Fiscora",
        path: "/abonnement",
        icon: CreditCardOutlined,
        permission: "organization.manage",
      },
    ],
  },
];

export function AppShell() {
  const { session, organization, selectOrganization, can, logout } = useAuth();
  const { direction, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const [createAnchor, setCreateAnchor] = useState<HTMLElement | null>(null);
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("lg"));
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>("[data-global-search]")
          ?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const visiblePrimary = useMemo(
    () =>
      primaryItems.filter((item) => !item.permission || can(item.permission)),
    [can],
  );
  const visibleSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) => !item.permission || can(item.permission),
          ),
        }))
        .filter((section) => section.items.length),
    [can],
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      navSections.map((section) => [
        section.key,
        section.items.some((item) => item.path === location.pathname),
      ]),
    ),
  );

  const dossierOptions = useQuery({
    queryKey: ["dossier-options", organization?.id, "global-search"],
    queryFn: () =>
      api.get<PagedResponse<DossierSummary>>(
        `/api/organizations/${organization?.id}/dossiers?page=1&pageSize=100`,
      ),
    enabled: Boolean(organization?.id && can("dossiers.view")),
  });

  const navItem = (item: NavItem, nested = false) => {
    const Icon = item.icon;
    const selected =
      item.path === "/"
        ? location.pathname === "/"
        : location.pathname === item.path ||
          location.pathname.startsWith(`${item.path}/`);
    return (
      <ListItemButton
        key={item.path}
        component={NavLink}
        to={item.path}
        onClick={() => setMobileOpen(false)}
        selected={selected}
        sx={{
          minHeight: nested ? 38 : 42,
          my: 0.25,
          pl: nested ? 4.75 : 1.5,
          borderRadius: 2,
          color: "rgba(255,255,255,.72)",
          "& .MuiListItemIcon-root": { color: "inherit" },
          "&.Mui-selected": {
            bgcolor: "rgba(255,255,255,.12)",
            color: "#fff",
            "&::before": {
              content: '""',
              position: "absolute",
              insetInlineStart: 0,
              width: 3,
              height: 20,
              borderRadius: 4,
              bgcolor: "#f2c56b",
            },
            "&:hover": { bgcolor: "rgba(255,255,255,.14)" },
          },
          "&:hover": {
            bgcolor: "rgba(255,255,255,.07)",
            color: "#fff",
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: nested ? 31 : 36 }}>
          <Icon sx={{ fontSize: nested ? 18 : 20 }} />
        </ListItemIcon>
        <ListItemText
          primary={
            <Typography sx={{ fontSize: nested ? 13 : 14, fontWeight: 650 }}>
              {t(item.label)}
            </Typography>
          }
        />
      </ListItemButton>
    );
  };

  const drawer = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#102f28",
        color: "#fff",
      }}
    >
      <Box sx={{ px: 2.25, py: 2.25 }}>
        <Brand dark />
      </Box>
      <Divider sx={{ borderColor: "rgba(255,255,255,.08)" }} />
      <Box sx={{ overflowY: "auto", px: 1.25, py: 1.5, flex: 1 }}>
        <List disablePadding>
          {visiblePrimary.map((item) => navItem(item))}
        </List>
        <Divider sx={{ my: 1.5, borderColor: "rgba(255,255,255,.08)" }} />
        {visibleSections.map((section) => {
          const SectionIcon = section.icon;
          const open = Boolean(expanded[section.key]);
          const active = section.items.some(
            (item) =>
              location.pathname === item.path ||
              location.pathname.startsWith(`${item.path}/`),
          );
          return (
            <Box key={section.key} sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() =>
                  setExpanded((current) => ({
                    ...current,
                    [section.key]: !open,
                  }))
                }
                sx={{
                  minHeight: 42,
                  borderRadius: 2,
                  px: 1.5,
                  color: active ? "#fff" : "rgba(255,255,255,.7)",
                  bgcolor: active && !open ? "rgba(255,255,255,.07)" : "none",
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
                  <SectionIcon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                      {t(section.label)}
                    </Typography>
                  }
                />
                {open ? (
                  <ExpandLessRounded fontSize="small" />
                ) : (
                  <ExpandMoreRounded fontSize="small" />
                )}
              </ListItemButton>
              <Collapse in={open} timeout="auto" unmountOnExit>
                <List disablePadding>
                  {section.items.map((item) => navItem(item, true))}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </Box>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,.45)" }}>
          {organization?.name ?? "Fiscora"}
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
          bgcolor: "rgba(255,255,255,.96)",
          color: "text.primary",
          borderBottom: "1px solid",
          borderColor: "divider",
          ml: desktop && direction === "ltr" ? `${drawerWidth}px` : 0,
          mr: desktop && direction === "rtl" ? `${drawerWidth}px` : 0,
          width: desktop ? `calc(100% - ${drawerWidth}px)` : "100%",
          backdropFilter: "blur(12px)",
        }}
      >
        <Toolbar sx={{ minHeight: "64px !important", gap: 1.25 }}>
          {!desktop && (
            <IconButton onClick={() => setMobileOpen(true)}>
              <MenuRounded />
            </IconButton>
          )}
          <FormControl
            size="small"
            sx={{ minWidth: { xs: 145, sm: 215 }, maxWidth: 250 }}
          >
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
          {can("dossiers.view") && (
            <Autocomplete
              options={dossierOptions.data?.items ?? []}
              getOptionLabel={(option) => option.legalName}
              onChange={(_, value) => {
                if (value) navigate(`/dossiers/${value.id}`);
              }}
              sx={{
                width: 360,
                display: { xs: "none", md: "block" },
                ml: 0.5,
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Rechercher un dossier client…"
                  slotProps={{
                    inputLabel: params.slotProps.inputLabel,
                    htmlInput: {
                      ...params.slotProps.htmlInput,
                      "data-global-search": true,
                    },
                    input: {
                      ...params.slotProps.input,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <SearchRounded fontSize="small" />
                          </InputAdornment>
                          {params.slotProps.input.startAdornment}
                        </>
                      ),
                      endAdornment: (
                        <>
                          <Typography
                            component="kbd"
                            variant="caption"
                            sx={{
                              display: { md: "none", xl: "inline-flex" },
                              px: 0.75,
                              py: 0.15,
                              mr: 0.5,
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 1,
                              color: "text.secondary",
                              bgcolor: "#f8faf8",
                              fontFamily: "inherit",
                            }}
                          >
                            Ctrl K
                          </Typography>
                          {params.slotProps.input.endAdornment}
                        </>
                      ),
                    },
                  }}
                />
              )}
            />
          )}
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={(event) => setCreateAnchor(event.currentTarget)}
            sx={{ display: { xs: "none", sm: "inline-flex" } }}
          >
            Créer
          </Button>
          <Menu
            anchorEl={createAnchor}
            open={Boolean(createAnchor)}
            onClose={() => setCreateAnchor(null)}
          >
            {can("dossiers.create") && (
              <MenuItem
                component={RouterLink}
                to="/dossiers?nouveau=1"
                onClick={() => setCreateAnchor(null)}
              >
                Nouveau dossier
              </MenuItem>
            )}
            {can("documents.upload") && (
              <MenuItem
                component={RouterLink}
                to="/documents"
                onClick={() => setCreateAnchor(null)}
              >
                Déposer un document
              </MenuItem>
            )}
            {can("business_invoices.manage") && (
              <MenuItem
                component={RouterLink}
                to="/factures"
                onClick={() => setCreateAnchor(null)}
              >
                Nouvelle facture
              </MenuItem>
            )}
            {can("accounting.manage") && (
              <MenuItem
                component={RouterLink}
                to="/comptabilite"
                onClick={() => setCreateAnchor(null)}
              >
                Saisir une écriture
              </MenuItem>
            )}
          </Menu>
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
                  width: 34,
                  height: 34,
                  bgcolor: "primary.main",
                  fontSize: 13,
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
            {session?.user.isPlatformAdmin && (
              <MenuItem
                component={NavLink}
                to="/administration-plateforme"
                onClick={() => setAccountAnchor(null)}
              >
                <AdminPanelSettingsOutlined fontSize="small" sx={{ mr: 1 }} />
                Administration Fiscora
              </MenuItem>
            )}
            <MenuItem onClick={() => void logout()}>
              {t("Se déconnecter")}
            </MenuItem>
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

      <Box component="main" sx={{ flex: 1, minWidth: 0, pt: "64px" }}>
        <Box sx={{ p: { xs: 2, sm: 2.5, xl: 3 }, maxWidth: 1560, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
