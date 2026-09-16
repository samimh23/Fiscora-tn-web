import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { HomeOutlined, RefreshRounded } from "@mui/icons-material";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Brand } from "./Brand";

function errorDescription(error: unknown) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return "La page demandée n’existe pas ou a été déplacée.";
  }

  return "Une nouvelle version de Fiscora a peut-être été publiée pendant votre session. Rechargez la page pour continuer.";
}

export function RouteErrorPage() {
  const error = useRouteError();

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "#f5f5ef",
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 560,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          p: { xs: 3, sm: 4 },
        }}
      >
        <Stack spacing={3}>
          <Brand />
          <Box>
            <Typography variant="h2">Actualisation nécessaire</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {errorDescription(error)}
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
            <Button
              variant="contained"
              startIcon={<RefreshRounded />}
              onClick={() => window.location.reload()}
            >
              Recharger Fiscora
            </Button>
            <Button
              variant="outlined"
              startIcon={<HomeOutlined />}
              onClick={() => window.location.assign("/")}
            >
              Retour à l’accueil
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
