import {
  AdminPanelSettingsOutlined,
  ArrowBackRounded,
  CloseRounded,
  MenuRounded,
  ShieldOutlined,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink, Outlet, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import {
  getPlatformAdminSection,
  platformAdminSections,
} from "../features/platform-admin/navigation";

export function PlatformAdminShell() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const section = getPlatformAdminSection(params.get("section"));
  const [menuOpen, setMenuOpen] = useState(false);

  const navigation = (
    <Box
      component="nav"
      aria-label="Pilotage détaillé"
      sx={{
        p: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        color: "#d9eee6",
      }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}
      >
        <Typography variant="overline" sx={{ color: "#f2c56b" }}>
          Pilotage détaillé
        </Typography>
        <IconButton
          aria-label="Fermer le menu administrateur"
          onClick={() => setMenuOpen(false)}
          sx={{ color: "inherit", display: { md: "none" } }}
        >
          <CloseRounded />
        </IconButton>
      </Stack>
      <List disablePadding>
        {platformAdminSections.map((item) => {
          const Icon = item.icon;
          return (
            <Box key={item.key}>
              {(item.key === "cabinets" || item.key === "traitements") && (
                <Typography
                  variant="overline"
                  sx={{
                    display: "block",
                    px: 1.5,
                    mt: 3,
                    mb: 1,
                    color: "rgba(255,255,255,.5)",
                  }}
                >
                  {item.key === "cabinets" ? "Gestion" : "Opérations"}
                </Typography>
              )}
              <ListItemButton
                component={RouterLink}
                to={
                  item.key === "overview"
                    ? "/administration-plateforme"
                    : `/administration-plateforme?section=${item.key}`
                }
                selected={section.key === item.key}
                aria-current={section.key === item.key ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                sx={{
                  mb: 0.5,
                  borderRadius: 1.5,
                  minHeight: 46,
                  borderInlineStart: "3px solid transparent",
                  "&.Mui-selected": {
                    bgcolor: "rgba(255,255,255,.12)",
                    color: "#fff",
                    borderInlineStartColor: "#f2c56b",
                  },
                  "&.Mui-selected:hover, &:hover": {
                    bgcolor: "rgba(255,255,255,.16)",
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 34, color: "inherit" }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: {
                      sx: { fontWeight: section.key === item.key ? 600 : 400 },
                    },
                  }}
                />
              </ListItemButton>
            </Box>
          );
        })}
      </List>
      <Box sx={{ mt: "auto", pt: 4 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ color: "rgba(255,255,255,.6)", mb: 2 }}
        >
          <ShieldOutlined fontSize="small" />
          <Typography variant="caption">
            Espace plateforme, distinct des données comptables des cabinets.
          </Typography>
        </Stack>
        <Button
          component={RouterLink}
          to="/"
          onClick={() => setMenuOpen(false)}
          startIcon={<ArrowBackRounded />}
          sx={{ color: "#d9eee6", display: { md: "none" } }}
        >
          Retour au cabinet
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f2f5f3" }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "#102d25",
          borderBottom: "1px solid rgba(255,255,255,.1)",
        }}
      >
        <Toolbar
          sx={{
            minHeight: "72px !important",
            gap: { xs: 1, sm: 2 },
            px: { xs: 1.5, sm: 3 },
          }}
        >
          <IconButton
            color="inherit"
            aria-label="Ouvrir le menu administrateur"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            sx={{ display: { md: "none" } }}
          >
            <MenuRounded />
          </IconButton>
          <Box
            sx={{
              width: { xs: 32, sm: 40 },
              height: { xs: 32, sm: 40 },
              flexShrink: 0,
              borderRadius: 2.5,
              display: "grid",
              placeItems: "center",
              bgcolor: "#f2c56b",
              color: "#102d25",
            }}
          >
            <AdminPanelSettingsOutlined />
          </Box>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography sx={{ color: "#fff", fontWeight: 700 }}>
                Fiscora
              </Typography>
              <Chip
                label="Administration plateforme"
                size="small"
                sx={{
                  display: { xs: "none", sm: "inline-flex" },
                  color: "#d9eee6",
                  bgcolor: "rgba(129,199,174,.12)",
                  border: "1px solid rgba(167,220,201,.2)",
                }}
              />
            </Stack>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,.6)" }}
            >
              <Box
                component="span"
                sx={{ display: { xs: "inline", sm: "none" } }}
              >
                Administration
              </Box>
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline" } }}
              >
                Pilotage interne du service
              </Box>
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <LanguageSwitcher light />
          <Button
            component={RouterLink}
            to="/"
            color="inherit"
            startIcon={<ArrowBackRounded />}
            sx={{ display: { xs: "none", sm: "inline-flex" } }}
          >
            Retour au cabinet
          </Button>
          <Avatar
            sx={{ width: 36, height: 36, bgcolor: "#2f7d5d", fontSize: 13 }}
          >
            {session?.user.fullName
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </Avatar>
        </Toolbar>
      </AppBar>
      <Box sx={{ display: "flex", alignItems: "flex-start" }}>
        <Box
          sx={{
            display: { xs: "none", md: "block" },
            width: 248,
            flexShrink: 0,
            position: "sticky",
            top: 72,
            height: "calc(100vh - 72px)",
            overflowY: "auto",
            bgcolor: "#102d25",
          }}
        >
          {navigation}
        </Box>
        <Box
          component="main"
          id="platform-admin-main"
          sx={{ flex: 1, minWidth: 0, p: { xs: 2, sm: 3, lg: 4 } }}
        >
          <Outlet />
        </Box>
      </Box>
      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        sx={{
          display: { md: "none" },
          "& .MuiDrawer-paper": {
            width: 280,
            maxWidth: "85vw",
            bgcolor: "#102d25",
          },
        }}
      >
        {navigation}
      </Drawer>
    </Box>
  );
}
