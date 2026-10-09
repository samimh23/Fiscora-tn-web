import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  InputAdornment,
  Pagination,
  Skeleton,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  ArrowForwardRounded,
  SearchRounded,
  DeleteOutlineRounded,
} from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { DossierFormDialog } from "../features/dossiers/DossierFormDialog";
import {
  dossierStatusLabels,
  legalFormLabel,
  taxRegimeLabel,
} from "../features/dossiers/options";
import type { DossierSummary, PagedResponse } from "../types/api";
import { useCurrentDossier } from "../hooks/useDossierSelection";

export function DossiersPage() {
  const { organization, can } = useAuth();
  const current = useCurrentDossier();
  const currentRef = useRef({ organizationId: organization?.id, ...current });
  currentRef.current = { organizationId: organization?.id, ...current };
  const queryClient = useQueryClient();
  const [deletion, setDeletion] = useState<{
    organizationId: string;
    dossier: DossierSummary;
  } | null>(null);
  const [confirmationName, setConfirmationName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [deletedMessage, setDeletedMessage] = useState<{
    organizationId: string;
    name: string;
  } | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (input: {
      organizationId: string;
      dossier: DossierSummary;
      confirmationName: string;
      acknowledged: boolean;
    }) =>
      api.delete(
        `/api/organizations/${input.organizationId}/dossiers/${input.dossier.id}`,
        {
          confirmationName: input.confirmationName,
          acknowledgePermanentDeletion: input.acknowledged,
        },
      ),
    onSuccess: async (_, input) => {
      // Evict the deleted dossier from both lists before changing the global selection.
      queryClient.setQueriesData<PagedResponse<DossierSummary>>(
        {
          predicate: (q) =>
            ["dossiers", "dossier-options"].includes(String(q.queryKey[0])) &&
            q.queryKey[1] === input.organizationId,
        },
        (data) =>
          data?.items.some((row) => row.id === input.dossier.id)
            ? {
                ...data,
                items: data.items.filter((row) => row.id !== input.dossier.id),
                total: Math.max(0, data.total - 1),
              }
            : data,
      );
      queryClient.removeQueries({
        predicate: (q) => q.queryKey.includes(input.dossier.id),
      });
      const active = currentRef.current;
      if (active.organizationId === input.organizationId) {
        if (active.dossierId === input.dossier.id) {
          active.selectDossier(
            active.dossiers.data?.items.find(
              (row) => row.id !== input.dossier.id,
            )?.id ?? "",
          );
        }
        setDeletion(null);
        setDeletedMessage({
          organizationId: input.organizationId,
          name: input.dossier.legalName,
        });
        setPage(1);
      }
      await queryClient.invalidateQueries();
    },
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(
    searchParams.get("nouveau") === "1",
  );
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["dossiers", organization?.id, search, page],
    queryFn: () =>
      api.get<PagedResponse<DossierSummary>>(
        `/api/organizations/${organization?.id}/dossiers?page=${page}&pageSize=10&search=${encodeURIComponent(search)}`,
      ),
    enabled: Boolean(organization?.id),
  });

  return (
    <>
      <PageHeader
        eyebrow="Portefeuille clients"
        title="Dossiers clients"
        description="Suivez les informations, obligations, pièces et travaux de chaque client."
        action={
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            disabled={!can("dossiers.create")}
            onClick={() => setCreateOpen(true)}
          >
            Nouveau dossier
          </Button>
        }
      />
      {deletedMessage?.organizationId === organization?.id && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setDeletedMessage(null)}
        >
          Le dossier {deletedMessage?.name} et ses données ont été supprimés. Le
          nettoyage des fichiers se poursuit en arrière-plan.
        </Alert>
      )}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box
            sx={{
              p: 2.5,
              display: "flex",
              gap: 2,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <TextField
              size="small"
              placeholder="Nom, matricule fiscal ou RNE…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              sx={{ width: { xs: "100%", sm: 420 } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {query.data?.total ?? 0} dossier(s)
            </Typography>
          </Box>
          {query.isError && (
            <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>
              Impossible de charger les dossiers.
            </Alert>
          )}
          {query.isLoading && (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <Skeleton height={65} />
              <Skeleton height={65} />
              <Skeleton height={65} />
            </Box>
          )}
          {!query.isLoading && !query.data?.items.length && (
            <Box sx={{ p: 7, textAlign: "center" }}>
              <Typography variant="h3">Aucun dossier trouvé</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Créez votre premier dossier client ou modifiez la recherche.
              </Typography>
            </Box>
          )}
          {query.data?.items.map((item) => (
            <Box
              key={item.id}
              className="data-row"
              sx={{
                px: 3,
                py: 2,
                borderTop: "1px solid",
                borderColor: "divider",
                "&:hover": { bgcolor: "#faf8f2" },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 600 }}>
                  {item.legalName}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {item.taxIdentifier || "Matricule fiscal non renseigné"}{" "}
                  {item.tradeName ? `· ${item.tradeName}` : ""}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Forme
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {legalFormLabel(item.legalForm)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Régime
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {taxRegimeLabel(item.taxRegime)}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 1,
                }}
              >
                <Chip
                  label={dossierStatusLabels[item.status] ?? item.status}
                  size="small"
                  color={
                    item.status === "ACTIF"
                      ? "success"
                      : item.status === "SUSPENDU"
                        ? "warning"
                        : "default"
                  }
                  variant="outlined"
                />
                <Button
                  component={RouterLink}
                  to={`/dossiers/${item.id}`}
                  size="small"
                  endIcon={<ArrowForwardRounded />}
                >
                  Ouvrir
                </Button>
                {organization?.role === "Propriétaire" &&
                  can("dossiers.delete") && (
                    <Button
                      color="error"
                      size="small"
                      startIcon={<DeleteOutlineRounded />}
                      aria-label={`Supprimer ${item.legalName}`}
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        deleteMutation.reset();
                        setConfirmationName("");
                        setAcknowledged(false);
                        setDeletion({
                          organizationId: organization.id,
                          dossier: item,
                        });
                      }}
                    >
                      Supprimer
                    </Button>
                  )}
              </Box>
            </Box>
          ))}
          {(query.data?.total ?? 0) > 10 && (
            <Box
              sx={{
                p: 2.5,
                borderTop: "1px solid",
                borderColor: "divider",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Pagination
                count={Math.ceil((query.data?.total ?? 0) / 10)}
                page={page}
                onChange={(_, value) => setPage(value)}
              />
            </Box>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(deletion && deletion.organizationId === organization?.id)}
        onClose={() => {
          if (!deleteMutation.isPending) setDeletion(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Supprimer définitivement ce dossier ?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Cette action est irréversible. Elle supprime les factures,
            règlements, écritures, relevés bancaires, documents, tâches,
            déclarations et autres données liés à {deletion?.dossier.legalName}.
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Le cabinet et les comptes utilisateurs restent. L’historique
            d’audit, les sauvegardes et les copies déjà téléchargées sont
            conservés. Les fichiers et copies des jeux de données sont nettoyés
            en arrière-plan.
          </Typography>
          <TextField
            fullWidth
            autoFocus
            label="Recopiez le nom exact du dossier"
            helperText={deletion?.dossier.legalName}
            value={confirmationName}
            disabled={deleteMutation.isPending}
            onChange={(event) => setConfirmationName(event.target.value)}
          />
          <FormControlLabel
            sx={{ mt: 2 }}
            control={
              <Checkbox
                checked={acknowledged}
                disabled={deleteMutation.isPending}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
            }
            label="Je confirme la suppression définitive du dossier et de ses données."
          />
          {deleteMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteMutation.error.message ||
                "La suppression a échoué. Réessayez."}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={deleteMutation.isPending}
            onClick={() => setDeletion(null)}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={
              deleteMutation.isPending ||
              !acknowledged ||
              confirmationName !== deletion?.dossier.legalName
            }
            onClick={() => {
              if (deletion)
                deleteMutation.mutate({
                  ...deletion,
                  confirmationName,
                  acknowledged,
                });
            }}
          >
            {deleteMutation.isPending
              ? "Suppression…"
              : "Supprimer définitivement"}
          </Button>
        </DialogActions>
      </Dialog>
      {organization?.id && (
        <DossierFormDialog
          open={createOpen}
          onClose={() => {
            setCreateOpen(false);
            if (searchParams.has("nouveau")) {
              const next = new URLSearchParams(searchParams);
              next.delete("nouveau");
              setSearchParams(next, { replace: true });
            }
          }}
          organizationId={organization.id}
          onSaved={(saved) => navigate(`/dossiers/${saved.id}`)}
        />
      )}
    </>
  );
}
