import { Box, Typography } from "@mui/material";
import { MfaSecurityCard } from "../components/MfaSecurityCard";

export function AccountSecurityPage() {
  return (
    <Box sx={{ maxWidth: 820 }}>
      <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
        Mon compte
      </Typography>
      <Typography variant="h2" sx={{ fontSize: { xs: 38, md: 52 }, mb: 1 }}>
        Sécurité du compte
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Renforcez la protection de vos données et de vos dossiers clients.
      </Typography>
      <MfaSecurityCard />
    </Box>
  );
}
