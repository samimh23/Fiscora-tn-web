import {
  Alert,
  Box,
  Card,
  CardContent,
  Skeleton,
  Typography,
} from "@mui/material";

/**
 * Kept temporarily so module pages do not need an all-at-once migration.
 * Dossier selection now lives globally in AppShell.
 */
export function DossierSelector(_props: {
  value: string;
  onChange: (id: string) => void;
}) {
  void _props;
  return null;
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
