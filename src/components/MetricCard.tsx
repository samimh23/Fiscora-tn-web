import {
  Box,
  Card,
  CardContent,
  Skeleton,
  Typography,
  type SvgIconProps,
} from "@mui/material";
import type { ElementType } from "react";

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  color = "#17624c",
  loading = false,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: ElementType<SvgIconProps>;
  color?: string;
  loading?: boolean;
}) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            color: "text.secondary",
            mb: 1.25,
          }}
        >
          <Icon sx={{ fontSize: 17, color }} />
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, minWidth: 0 }}
            noWrap
          >
            {label}
          </Typography>
        </Box>
        {loading ? (
          <Skeleton width={82} height={34} />
        ) : (
          <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15 }}>
            {value}
          </Typography>
        )}
        <Typography
          className="metric-hint"
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.5 }}
          noWrap
        >
          {hint}
        </Typography>
      </CardContent>
    </Card>
  );
}
