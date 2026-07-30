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
  color = "#145a46",
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
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
          <Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 650 }}
            >
              {label}
            </Typography>
            {loading ? (
              <Skeleton width={90} height={39} />
            ) : (
              <Typography
                sx={{
                  fontSize: 27,
                  fontWeight: 760,
                  mt: 0.35,
                  lineHeight: 1.2,
                }}
              >
                {value}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: `${color}14`,
              color,
            }}
          >
            <Icon fontSize="small" />
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      </CardContent>
    </Card>
  );
}
