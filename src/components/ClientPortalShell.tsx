import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  AppBar, Avatar, Box, Divider, Drawer, FormControl, IconButton, InputLabel,
  List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Select,
  Toolbar, Tooltip, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import {
  DashboardOutlined, FolderOutlined, MenuRounded, NotificationsNoneOutlined,
  LogoutRounded, ManageAccountsOutlined, SupportAgentOutlined,
} from "@mui/icons-material";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { Brand } from "./Brand";
import { LanguageSwitcher } from "./LanguageSwitcher";

const width = 272;
const items = [
  { label: "Mon tableau de bord", path: "/portail", icon: DashboardOutlined },
  { label: "Mes dossiers", path: "/portail/dossiers", icon: FolderOutlined },
  { label: "Notifications", path: "/portail/notifications", icon: NotificationsNoneOutlined },
  { label: "Mon compte", path: "/portail/parametres", icon: ManageAccountsOutlined },
];

export function ClientPortalShell() {
  const { session, organization, selectOrganization, logout } = useAuth();
  const { direction, t } = useLanguage();
  const [mobile, setMobile] = useState(false);
  const [account, setAccount] = useState<HTMLElement | null>(null);
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("lg"));
  const location = useLocation();
  const drawer = <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "#0b4034", color: "white" }}>
    <Box sx={{ p: 3 }}><Brand dark /></Box>
    <Box sx={{ px: 3, pb: 2 }}><Typography variant="overline" sx={{ color: "#f2c56b", letterSpacing: ".16em" }}>Espace client</Typography><Typography variant="body2" sx={{ color: "rgba(255,255,255,.66)", mt: .5 }}>Vos documents et échéances, au même endroit.</Typography></Box>
    <Divider sx={{ borderColor: "rgba(255,255,255,.1)" }} />
    <List sx={{ px: 1.5, py: 2, flex: 1 }}>
      {items.map((item) => { const Icon = item.icon; const selected = item.path === "/portail" ? location.pathname === "/portail" : location.pathname === item.path; return <ListItemButton key={item.label} component={NavLink} to={item.path} selected={selected} onClick={() => setMobile(false)} sx={{ borderRadius: 2, mb: .7, color: "rgba(255,255,255,.78)", "&.Mui-selected": { bgcolor: "#f2c56b", color: "#153a30" }, "&:hover": { bgcolor: "rgba(255,255,255,.08)" } }}><ListItemIcon sx={{ minWidth: 40, color: "inherit" }}><Icon /></ListItemIcon><ListItemText primary={t(item.label)} /></ListItemButton>; })}
    </List>
    <Box sx={{ p: 2.5, borderTop: "1px solid rgba(255,255,255,.1)" }}><Box sx={{ display: "flex", gap: 1.2, alignItems: "center" }}><SupportAgentOutlined sx={{ color: "#f2c56b" }} /><Box><Typography variant="body2" sx={{ fontWeight: 700 }}>Votre cabinet</Typography><Typography variant="caption" sx={{ color: "rgba(255,255,255,.55)" }}>{organization?.name}</Typography></Box></Box></Box>
  </Box>;
  return <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f5f3ec" }}>
    <AppBar position="fixed" elevation={0} sx={{ bgcolor: "rgba(255,253,248,.96)", color: "text.primary", borderBottom: "1px solid", borderColor: "divider", ml: desktop && direction === "ltr" ? `${width}px` : 0, mr: desktop && direction === "rtl" ? `${width}px` : 0, width: desktop ? `calc(100% - ${width}px)` : "100%" }}><Toolbar sx={{ minHeight: "72px !important", gap: 2 }}>{!desktop && <IconButton onClick={() => setMobile(true)}><MenuRounded /></IconButton>}<FormControl size="small" sx={{ minWidth: { xs: 170, sm: 250 } }}><InputLabel>{t("Cabinet")}</InputLabel><Select value={organization?.id ?? ""} label={t("Cabinet")} onChange={(e) => selectOrganization(e.target.value)}>{session?.organizations.map((org) => <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>)}</Select></FormControl><Box sx={{ flex: 1 }} /><LanguageSwitcher /><Tooltip title={t("Notifications")}><IconButton component={NavLink} to="/portail/notifications"><NotificationsNoneOutlined /></IconButton></Tooltip><IconButton onClick={(e) => setAccount(e.currentTarget)}><Avatar sx={{ bgcolor: "#17614e", width: 38, height: 38 }}>{session?.user.fullName.split(" ").map((x) => x[0]).slice(0, 2).join("")}</Avatar></IconButton><Menu anchorEl={account} open={Boolean(account)} onClose={() => setAccount(null)}><Box sx={{ px: 2, py: 1, minWidth: 230 }}><Typography sx={{ fontWeight: 800 }}>{session?.user.fullName}</Typography><Typography variant="body2" color="text.secondary">{session?.user.email}</Typography><Typography variant="caption" color="primary">Portail client</Typography></Box><Divider /><MenuItem component={NavLink} to="/portail/parametres" onClick={() => setAccount(null)}><ManageAccountsOutlined sx={{ mr: 1 }} />{t("Mon compte")}</MenuItem><MenuItem onClick={() => void logout()}><LogoutRounded sx={{ mr: 1 }} />{t("Se déconnecter")}</MenuItem></Menu></Toolbar></AppBar>
    <Box component="nav" sx={{ width: { lg: width }, flexShrink: { lg: 0 } }}><Drawer anchor={direction === "rtl" ? "right" : "left"} variant={desktop ? "permanent" : "temporary"} open={desktop || mobile} onClose={() => setMobile(false)} ModalProps={{ keepMounted: true }} sx={{ "& .MuiDrawer-paper": { width, border: 0 } }}>{drawer}</Drawer></Box>
    <Box component="main" sx={{ flex: 1, minWidth: 0, pt: "72px" }}><Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1480, mx: "auto" }}><Outlet /></Box></Box>
  </Box>;
}
