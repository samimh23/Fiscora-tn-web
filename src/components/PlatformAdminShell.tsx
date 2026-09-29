import {
  AdminPanelSettingsOutlined,
  ArrowBackRounded,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { Link as RouterLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function PlatformAdminShell() {
  const { session } = useAuth();

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
        <Toolbar sx={{ minHeight: "72px !important", gap: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
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
              Pilotage interne du service
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <LanguageSwitcher />
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
      <Container
        maxWidth={false}
        sx={{ maxWidth: 1580, py: { xs: 2.5, md: 4 } }}
      >
        <Outlet />
      </Container>
    </Box>
  );
}
