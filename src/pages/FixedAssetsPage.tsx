import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { AddRounded, AutorenewRounded, LockRounded } from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  DossierSelector,
  Money,
  QueryState,
} from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";
import type { LedgerAccount } from "../types/api";

interface AssetCategory {
  id: string;
  code: string;
  name: string;
  defaultMethod: string;
  defaultUsefulLifeMonths: number;
  assetAccount: LedgerAccount;
  accumulatedDepreciationAccount: LedgerAccount;
  depreciationExpenseAccount: LedgerAccount;
}
interface Asset {
  id: string;
  code: string;
  name: string;
  category: AssetCategory;
  acquisitionDate: string;
  serviceDate: string;
  acquisitionCost: string;
  residualValue: string;
  netBookValue: string;
  status: string;
  depreciationPeriods?: Array<{
    id: string;
    periodYear: number;
    periodMonth: number;
    accountingAmount: string;
    fiscalAmount: string;
    temporaryDifference: string;
    status: string;
  }>;
}
interface DepreciationReport {
  year: number;
  status: string;
  rows: Array<{
    assetId: string;
    code: string;
    name: string;
    category: string;
    accounting: string;
    fiscal: string;
    temporaryDifference: string;
    posted: number;
    periods: number;
  }>;
  totals: { accounting: string; fiscal: string; temporaryDifference: string };
}

export function FixedAssetsPage() {
  const { organization, can } = useAuth();
  const qc = useQueryClient();
  const [dossierId, setDossierId] = useState("");
  const [tab, setTab] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [category, setCategory] = useState({
    code: "",
    name: "",
    assetAccountId: "",
    accumulatedDepreciationAccountId: "",
    depreciationExpenseAccountId: "",
    defaultMethod: "LINEAIRE",
    defaultUsefulLifeMonths: 60,
  });
  const today = new Date().toISOString().slice(0, 10);
  const [asset, setAsset] = useState({
    categoryId: "",
    code: "",
    name: "",
    acquisitionDate: today,
    serviceDate: today,
    acquisitionCost: "",
    residualValue: "0.000",
    fiscalMethod: "LINEAIRE",
    fiscalUsefulLifeMonths: 60,
  });
  const base =
    organization?.id && dossierId
      ? `/api/organizations/${organization.id}/dossiers/${dossierId}/fixed-assets`
      : "";
  const categories = useQuery({
    queryKey: ["asset-categories", organization?.id, dossierId],
    queryFn: () => api.get<AssetCategory[]>(`${base}/categories`),
    enabled: Boolean(base),
  });
  const assets = useQuery({
    queryKey: ["fixed-assets", organization?.id, dossierId],
    queryFn: () => api.get<Asset[]>(base),
    enabled: Boolean(base),
  });
  const accounts = useQuery({
    queryKey: ["ledger-accounts", organization?.id, dossierId],
    queryFn: () =>
      api.get<LedgerAccount[]>(
        `/api/organizations/${organization?.id}/dossiers/${dossierId}/ledger-accounts`,
      ),
    enabled: Boolean(organization?.id && dossierId && can("chart_of_accounts.view")),
  });
  const report = useQuery({
    queryKey: ["depreciation-report", organization?.id, dossierId, year],
    queryFn: () =>
      api.get<DepreciationReport>(`${base}/reports/depreciation?year=${year}`),
    enabled: Boolean(base && tab === 2),
  });
  const detail = useQuery({
    queryKey: ["fixed-asset-detail", selectedId],
    queryFn: () => api.get<Asset>(`${base}/${selectedId}`),
    enabled: Boolean(base && selectedId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["fixed-assets"] });
    void qc.invalidateQueries({ queryKey: ["asset-categories"] });
    void qc.invalidateQueries({ queryKey: ["depreciation-report"] });
  };
  const saveCategory = useMutation({
    mutationFn: () => api.post(`${base}/categories`, category),
    onSuccess: () => {
      setCategoryOpen(false);
      invalidate();
    },
  });
  const saveAsset = useMutation({
    mutationFn: () => api.post(`${base}`, asset),
    onSuccess: () => {
      setAssetOpen(false);
      invalidate();
    },
  });
  const generate = useMutation({
    mutationFn: (id: string) => api.post(`${base}/${id}/generate-schedule`),
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["fixed-asset-detail"] });
    },
  });
  const validateYear = useMutation({
    mutationFn: () => api.post(`${base}/years/${year}/validate`),
    onSuccess: invalidate,
  });
  const error =
    saveCategory.error ??
    saveAsset.error ??
    generate.error ??
    validateYear.error;
  return (
    <>
      <PageHeader
        eyebrow="Patrimoine"
        title="Immobilisations"
        description="Registre des biens, plans d’amortissement comptable et fiscal, dotations et clôture annuelle."
        action={<DossierSelector value={dossierId} onChange={setDossierId} />}
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : "Erreur"}
        </Alert>
      )}
      <Card>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label="Immobilisations" />
          <Tab label="Catégories" />
          <Tab label="État des amortissements" />
        </Tabs>
        <CardContent>
          {tab === 0 && (
            <>
              <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                <Button
                  variant="contained"
                  startIcon={<AddRounded />}
                  disabled={
                    !base ||
                    !can("fixed_assets.manage") ||
                    !categories.data?.length
                  }
                  onClick={() => {
                    setAsset({
                      ...asset,
                      categoryId: categories.data?.[0]?.id ?? "",
                    });
                    setAssetOpen(true);
                  }}
                >
                  Nouvelle immobilisation
                </Button>
              </Stack>
              <QueryState
                loading={assets.isLoading}
                error={assets.isError}
                empty={!assets.data?.length}
                emptyText={
                  categories.data?.length
                    ? "Aucune immobilisation."
                    : "Créez d’abord une catégorie."
                }
              />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Bien</TableCell>
                    <TableCell>Catégorie</TableCell>
                    <TableCell>Mise en service</TableCell>
                    <TableCell align="right">Coût</TableCell>
                    <TableCell align="right">VNC</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assets.data?.map((a) => (
                    <TableRow
                      key={a.id}
                      hover
                      selected={selectedId === a.id}
                      onClick={() => setSelectedId(a.id)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <b>{a.code}</b> · {a.name}
                      </TableCell>
                      <TableCell>{a.category.name}</TableCell>
                      <TableCell>{a.serviceDate}</TableCell>
                      <TableCell align="right">
                        <Money value={a.acquisitionCost} />
                      </TableCell>
                      <TableCell align="right">
                        <Money value={a.netBookValue} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={a.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          startIcon={<AutorenewRounded />}
                          disabled={!can("fixed_assets.manage")}
                          onClick={(e) => {
                            e.stopPropagation();
                            generate.mutate(a.id);
                          }}
                        >
                          Plan
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {selectedId && detail.data && (
                <Card variant="outlined" sx={{ mt: 2 }}>
                  <CardContent>
                    <Typography variant="h6">
                      Échéancier — {detail.data.name}
                    </Typography>
                    <Box sx={{ overflowX: "auto" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Période</TableCell>
                            <TableCell align="right">Comptable</TableCell>
                            <TableCell align="right">Fiscal</TableCell>
                            <TableCell align="right">Différence</TableCell>
                            <TableCell>Statut</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {detail.data.depreciationPeriods?.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                {String(p.periodMonth).padStart(2, "0")}/
                                {p.periodYear}
                              </TableCell>
                              <TableCell align="right">
                                <Money value={p.accountingAmount} />
                              </TableCell>
                              <TableCell align="right">
                                <Money value={p.fiscalAmount} />
                              </TableCell>
                              <TableCell align="right">
                                <Money value={p.temporaryDifference} />
                              </TableCell>
                              <TableCell>{p.status}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </>
          )}
          {tab === 1 && (
            <>
              <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                <Button
                  variant="contained"
                  startIcon={<AddRounded />}
                  disabled={
                    !base ||
                    !can("fixed_assets.manage") ||
                    !accounts.data?.length
                  }
                  onClick={() => setCategoryOpen(true)}
                >
                  Nouvelle catégorie
                </Button>
              </Stack>
              <QueryState
                loading={categories.isLoading}
                error={categories.isError}
                empty={!categories.data?.length}
              />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Catégorie</TableCell>
                    <TableCell>Méthode</TableCell>
                    <TableCell>Durée</TableCell>
                    <TableCell>Comptes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories.data?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <b>{c.code}</b> · {c.name}
                      </TableCell>
                      <TableCell>{c.defaultMethod}</TableCell>
                      <TableCell>{c.defaultUsefulLifeMonths} mois</TableCell>
                      <TableCell>
                        {c.assetAccount.code} /{" "}
                        {c.accumulatedDepreciationAccount.code} /{" "}
                        {c.depreciationExpenseAccount.code}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
          {tab === 2 && (
            <>
              <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                <TextField
                  size="small"
                  type="number"
                  label="Exercice"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
                <Button
                  color="secondary"
                  variant="contained"
                  startIcon={<LockRounded />}
                  disabled={
                    !can("fixed_assets.validate") || validateYear.isPending
                  }
                  onClick={() => validateYear.mutate()}
                >
                  Valider l’exercice
                </Button>
              </Stack>
              <QueryState
                loading={report.isLoading}
                error={report.isError}
                empty={!report.data?.rows.length}
              />
              {report.data && (
                <>
                  <Stack direction="row" spacing={3} sx={{ my: 2 }}>
                    <Typography>
                      Comptable :{" "}
                      <b>
                        <Money value={report.data.totals.accounting} />
                      </b>
                    </Typography>
                    <Typography>
                      Fiscal :{" "}
                      <b>
                        <Money value={report.data.totals.fiscal} />
                      </b>
                    </Typography>
                    <Chip label={report.data.status} />
                  </Stack>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Immobilisation</TableCell>
                        <TableCell>Catégorie</TableCell>
                        <TableCell align="right">Comptable</TableCell>
                        <TableCell align="right">Fiscal</TableCell>
                        <TableCell align="right">
                          Différence temporaire
                        </TableCell>
                        <TableCell>Comptabilisé</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {report.data.rows.map((r) => (
                        <TableRow key={r.assetId}>
                          <TableCell>
                            <b>{r.code}</b> · {r.name}
                          </TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell align="right">
                            <Money value={r.accounting} />
                          </TableCell>
                          <TableCell align="right">
                            <Money value={r.fiscal} />
                          </TableCell>
                          <TableCell align="right">
                            <Money value={r.temporaryDifference} />
                          </TableCell>
                          <TableCell>
                            {r.posted}/{r.periods}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nouvelle catégorie</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Code"
                value={category.code}
                onChange={(e) =>
                  setCategory({ ...category, code: e.target.value })
                }
              />
              <TextField
                fullWidth
                label="Nom"
                value={category.name}
                onChange={(e) =>
                  setCategory({ ...category, name: e.target.value })
                }
              />
            </Stack>
            {(
              [
                "assetAccountId",
                "accumulatedDepreciationAccountId",
                "depreciationExpenseAccountId",
              ] as const
            ).map((key, i) => (
              <TextField
                key={key}
                select
                label={
                  [
                    "Compte immobilisation",
                    "Compte amortissements cumulés",
                    "Compte dotation",
                  ][i]
                }
                value={category[key]}
                onChange={(e) =>
                  setCategory({ ...category, [key]: e.target.value })
                }
              >
                {accounts.data
                  ?.filter((a) => a.allowsPosting && a.isActive)
                  .map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </MenuItem>
                  ))}
              </TextField>
            ))}
            <Stack direction="row" spacing={2}>
              <TextField
                select
                fullWidth
                label="Méthode"
                value={category.defaultMethod}
                onChange={(e) =>
                  setCategory({ ...category, defaultMethod: e.target.value })
                }
              >
                {["LINEAIRE", "DEGRESSIF"].map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                type="number"
                label="Durée (mois)"
                value={category.defaultUsefulLifeMonths}
                onChange={(e) =>
                  setCategory({
                    ...category,
                    defaultUsefulLifeMonths: Number(e.target.value),
                  })
                }
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={saveCategory.isPending}
            onClick={() => saveCategory.mutate()}
          >
            Créer
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={assetOpen}
        onClose={() => setAssetOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nouvelle immobilisation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Catégorie"
              value={asset.categoryId}
              onChange={(e) =>
                setAsset({ ...asset, categoryId: e.target.value })
              }
            >
              {categories.data?.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Code"
                value={asset.code}
                onChange={(e) => setAsset({ ...asset, code: e.target.value })}
              />
              <TextField
                fullWidth
                label="Désignation"
                value={asset.name}
                onChange={(e) => setAsset({ ...asset, name: e.target.value })}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                type="date"
                label="Acquisition"
                value={asset.acquisitionDate}
                onChange={(e) =>
                  setAsset({ ...asset, acquisitionDate: e.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth
                type="date"
                label="Mise en service"
                value={asset.serviceDate}
                onChange={(e) =>
                  setAsset({ ...asset, serviceDate: e.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="Coût (TND)"
                value={asset.acquisitionCost}
                onChange={(e) =>
                  setAsset({ ...asset, acquisitionCost: e.target.value })
                }
              />
              <TextField
                fullWidth
                label="Valeur résiduelle"
                value={asset.residualValue}
                onChange={(e) =>
                  setAsset({ ...asset, residualValue: e.target.value })
                }
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                select
                fullWidth
                label="Méthode fiscale"
                value={asset.fiscalMethod}
                onChange={(e) =>
                  setAsset({ ...asset, fiscalMethod: e.target.value })
                }
              >
                {["LINEAIRE", "DEGRESSIF"].map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                type="number"
                label="Durée fiscale (mois)"
                value={asset.fiscalUsefulLifeMonths}
                onChange={(e) =>
                  setAsset({
                    ...asset,
                    fiscalUsefulLifeMonths: Number(e.target.value),
                  })
                }
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssetOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={
              !asset.categoryId ||
              !asset.code ||
              !asset.name ||
              !asset.acquisitionCost ||
              saveAsset.isPending
            }
            onClick={() => saveAsset.mutate()}
          >
            Créer et générer le plan
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
