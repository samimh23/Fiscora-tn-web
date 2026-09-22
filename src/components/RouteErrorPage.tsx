import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { HomeOutlined, RefreshRounded } from "@mui/icons-material";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Brand } from "./Brand";

function errorContent(error: unknown) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return {
      title: "Page introuvable",
      description: "La page demandée n’existe pas ou a été déplacée.",
    };
  }

  return {
    title: "Impossible d’afficher cette page",
    description:
      "Une erreur inattendue est survenue. Rechargez la page et réessayez. Si le problème persiste, retournez à l’accueil.",
  };
}

export function RouteErrorPage() {
  const error = useRouteError();
  const content = errorContent(error);

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
            <Typography variant="h2">{content.title}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {content.description}
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
