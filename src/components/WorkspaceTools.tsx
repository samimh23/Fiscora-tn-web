import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Typography,
} from "@mui/material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { DossierSummary, PagedResponse } from "../types/api";

export function DossierSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { organization } = useAuth();
  const query = useQuery({
    queryKey: ["dossier-options", organization?.id],
    queryFn: () =>
      api.get<PagedResponse<DossierSummary>>(
        `/api/organizations/${organization?.id}/dossiers?page=1&pageSize=100`,
      ),
    enabled: Boolean(organization?.id),
  });
  useEffect(() => {
    if (!value && query.data?.items[0]) onChange(query.data.items[0].id);
  }, [onChange, query.data?.items, value]);
  return (
    <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 300 } }}>
      <InputLabel>Dossier client</InputLabel>
      <Select
        value={value}
        label="Dossier client"
        onChange={(event) => onChange(event.target.value)}
      >
        {query.data?.items.map((item) => (
          <MenuItem key={item.id} value={item.id}>
            {item.legalName}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function Money({
  value,
}: {
  value: string | number | null | undefined;
}) {
  return (
    <>
      {new Intl.NumberFormat("fr-TN", {
        style: "currency",
        currency: "TND",
        minimumFractionDigits: 3,
      }).format(Number(value ?? 0))}
    </>
  );
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5, fontSize: 26 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export function QueryState({
  loading,
  error,
  empty,
  emptyText = "Aucune donnée disponible.",
}: {
  loading: boolean;
  error: boolean;
  empty?: boolean;
  emptyText?: string;
}) {
  if (loading)
    return (
      <Box sx={{ py: 2 }}>
        <Skeleton height={52} />
        <Skeleton height={52} />
        <Skeleton height={52} />
      </Box>
    );
  if (error)
    return (
      <Alert severity="error">
        Impossible de charger les données. Vérifiez que l’API est démarrée puis
        réessayez.
      </Alert>
    );
  if (empty)
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography color="text.secondary">{emptyText}</Typography>
      </Box>
    );
  return null;
}
