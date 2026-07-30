import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        alignItems: { xs: "flex-start", sm: "center" },
        justifyContent: "space-between",
        flexDirection: { xs: "column", sm: "row" },
        mb: 2.5,
      }}
    >
      <Box>
        <Typography
          variant="overline"
          color="primary.main"
          sx={{ fontWeight: 800, letterSpacing: ".11em", fontSize: 10 }}
        >
          {eyebrow}
        </Typography>
        <Typography
          variant="h2"
          sx={{ fontSize: { xs: 28, md: 34 }, mt: 0.15, lineHeight: 1.2 }}
        >
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.45, fontSize: 14 }}>
          {description}
        </Typography>
      </Box>
      {action}
    </Box>
  );
}
