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
        mb: 3,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ display: "block" }}
        >
          {eyebrow}
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.25 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {description}
        </Typography>
      </Box>
      {action}
    </Box>
  );
}
