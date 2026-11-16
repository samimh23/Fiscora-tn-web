import { Box, Typography } from "@mui/material";

export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.4 }}>
      <span className="brand-mark">F</span>
      <Box>
        <Typography
          sx={{
            color: dark ? "#fff" : "text.primary",
            fontWeight: 700,
            lineHeight: 1.05,
          }}
        >
          Fiscora
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: dark ? "rgba(255,255,255,.62)" : "text.secondary" }}
        >
          Espace cabinet
        </Typography>
      </Box>
    </Box>
  );
}
