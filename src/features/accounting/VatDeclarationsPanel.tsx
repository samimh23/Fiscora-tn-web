import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  CalculateOutlined,
  CheckCircleOutlineRounded,
  FactCheckOutlined,
  RefreshRounded,
  SendRounded,
  UploadFileOutlined,
} from "@mui/icons-material";
import { api, ApiError } from "../../api/client";
import type {
  AccountingDocument,
  MonthlyDeclarationCalculation,
  MonthlyTaxDeclaration,
} from "../../types/api";
import { declarationStatusLabels, money, monthNames } from "./options";

type TaxForm = {
  vatCollected: string;
  vatDeductible: string;
  vatCreditPrevious: string;
  withholdingTax: string;
  tfpBase: string;
  foprolosBase: string;
  tclBase: string;
  stampDuty: string;
  adjustmentReason: string;
};

const blank: TaxForm = {
  vatCollected: "0.000",
  vatDeductible: "0.000",
  vatCreditPrevious: "0.000",
  withholdingTax: "0.000",
  tfpBase: "0.000",
  foprolosBase: "0.000",
  tclBase: "0.000",
  stampDuty: "0.000",
  adjustmentReason: "",
};

function statusColor(
  status: string,
): "warning" | "primary" | "success" | "error" | "default" {
  if (status === "BROUILLON") return "warning";
  if (status === "PRETE_POUR_REVISION") return "primary";
  if (status === "REJETEE") return "error";
  if (["VALIDEE", "DEPOSEE"].includes(status)) return "success";
  return "default";
}

function dateTime(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("fr-TN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
}

export function VatDeclarationsPanel({
  organizationId,
  dossierId,
  archived,
  canManage,
  canValidate,
}: {
  organizationId: string;
  dossierId: string;
  archived: boolean;
  canManage: boolean;
  canValidate: boolean;
  canInvoicesView: boolean;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [form, setForm] = useState<TaxForm>(blank);
  const [rejectComment, setRejectComment] = useState("");
  const [filingReference, setFilingReference] = useState("");
  const [receiptDocumentId, setReceiptDocumentId] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const base = `/api/organizations/${organizationId}/dossiers/${dossierId}/monthly-declarations`;

  const declarations = useQuery({
    queryKey: ["monthly-declarations", organizationId, dossierId, year],
    queryFn: () => api.get<MonthlyTaxDeclaration[]>(`${base}?year=${year}`),
  });
  const calculation = useQuery({
    queryKey: [
      "monthly-declaration-calculation",
      organizationId,
      dossierId,
      year,
      month,
    ],
    queryFn: () =>
      api.post<MonthlyDeclarationCalculation>(`${base}/calculate`, {
        periodYear: year,
        periodMonth: month,
      }),
    retry: false,
  });
  const documents = useQuery({
    queryKey: ["dossier-documents-all", organizationId, dossierId],
    queryFn: () =>
      api.get<AccountingDocument[]>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents`,
      ),
    enabled: fileOpen,
  });
  const current = declarations.data?.find((item) => item.periodMonth === month);
  const source = current?.sourceSnapshot ?? calculation.data?.sourceSnapshot;
  const checks = current?.checksJson ?? calculation.data?.checks;
  const sourcesChanged = Boolean(
    current?.sourceSnapshot?.fingerprint &&
    calculation.data?.sourceSnapshot.fingerprint &&
    current.sourceSnapshot.fingerprint !==
      calculation.data.sourceSnapshot.fingerprint,
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["monthly-declarations", organizationId, dossierId],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "monthly-declaration-calculation",
          organizationId,
          dossierId,
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: ["dossier-obligations", organizationId, dossierId],
      }),
    ]);
  };

  const prepare = useMutation({
    mutationFn: () =>
      api.post<MonthlyTaxDeclaration>(`${base}/prepare`, {
        periodYear: year,
        periodMonth: month,
      }),
    onSuccess: async () => {
      setError("");
      await refresh();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Impossible de calculer la déclaration.",
      ),
  });

  const save = useMutation({
    mutationFn: () =>
      api.put<MonthlyTaxDeclaration>(base, {
        periodYear: year,
        periodMonth: month,
        ...form,
      }),
    onSuccess: async () => {
      setAdjustOpen(false);
      setError("");
      await refresh();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Impossible d’enregistrer les ajustements.",
      ),
  });

  const action = useMutation({
    mutationFn: ({
      type,
      body,
    }: {
      type: "review" | "validate" | "reject" | "file";
      body?: Record<string, string>;
    }) =>
      api.post<MonthlyTaxDeclaration>(`${base}/${current!.id}/${type}`, body),
    onSuccess: async (_, variables) => {
      setError("");
      if (variables.type === "reject") setRejectOpen(false);
      if (variables.type === "file") setFileOpen(false);
      await refresh();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError ? reason.message : "Action impossible.",
      ),
  });

  const openAdjustment = () => {
    const values = current ?? calculation.data?.input;
    setForm(
      values
        ? {
            vatCollected: values.vatCollected,
            vatDeductible: values.vatDeductible,
            vatCreditPrevious: values.vatCreditPrevious,
            withholdingTax: values.withholdingTax,
            tfpBase: values.tfpBase,
            foprolosBase: values.foprolosBase,
            tclBase: values.tclBase,
            stampDuty: values.stampDuty,
            adjustmentReason: current?.adjustmentReason ?? "",
          }
        : blank,
    );
    setError("");
    setAdjustOpen(true);
  };
  const set = (key: keyof TaxForm, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));

  return (
    <Stack spacing={2}>
      <Card>
        <Box
          sx={{
            p: 2.5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box>
            <Typography variant="h3" sx={{ fontSize: 24 }}>
              Déclaration mensuelle tunisienne
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Calcul serveur depuis les factures et la paie, contrôles,
              validation et preuve de dépôt.
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            <TextField
              select
              size="small"
              label="Mois"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {monthNames.map((name, index) => (
                <MenuItem key={name} value={index + 1}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Année"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {[
                now.getFullYear() - 1,
                now.getFullYear(),
                now.getFullYear() + 1,
              ].map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Box>
        {error && (
          <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>
            {error}
          </Alert>
        )}
        {calculation.isError && (
          <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>
            Le calcul ne peut pas démarrer. Vérifiez que les paramètres fiscaux
            applicables à cette période sont configurés.
          </Alert>
        )}
        {(declarations.isLoading || calculation.isLoading) && (
          <Box sx={{ p: 2.5 }}>
            <Skeleton height={160} />
          </Box>
        )}
        {!declarations.isLoading && !current && !calculation.isLoading && (
          <Box sx={{ p: 5, textAlign: "center" }}>
            <CalculateOutlined sx={{ fontSize: 48, color: "text.disabled" }} />
            <Typography sx={{ fontWeight: 900, mt: 1 }}>
              Déclaration non préparée
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Le serveur utilisera uniquement les factures comptabilisées et la
              paie validée de cette période.
            </Typography>
            {canManage && !archived && (
              <Button
                variant="contained"
                startIcon={<CalculateOutlined />}
                disabled={prepare.isPending || calculation.isError}
                onClick={() => prepare.mutate()}
              >
                Préparer automatiquement
              </Button>
            )}
          </Box>
        )}
        {current && (
          <Box sx={{ p: 3 }}>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ mb: 2, alignItems: "center", flexWrap: "wrap" }}
            >
              <Typography variant="h3" sx={{ fontSize: 22 }}>
                {monthNames[current.periodMonth - 1]} {current.periodYear}
              </Typography>
              <Chip
                label={declarationStatusLabels[current.status]}
                color={statusColor(current.status)}
                variant="outlined"
              />
              <Chip
                label={
                  current.calculationMode === "AJUSTEE"
                    ? "Ajustée manuellement"
                    : "Calcul automatique"
                }
                size="small"
              />
            </Stack>
            {sourcesChanged &&
              ["BROUILLON", "REJETEE", "PRETE_POUR_REVISION"].includes(
                current.status,
              ) && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Les factures ou la paie ont changé depuis le dernier calcul.
                  Recalculez avant de soumettre ou valider.
                </Alert>
              )}
            {current.status === "REJETEE" && current.reviewComment && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Motif du rejet : {current.reviewComment}
              </Alert>
            )}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" },
                gap: 1.5,
              }}
            >
              {[
                ["TVA collectée", current.vatCollected],
                ["TVA déductible", current.vatDeductible],
                ["Report précédent", current.vatCreditPrevious],
                ["TVA due", current.vatDue],
                ["Crédit à reporter", current.vatCreditNext],
                ["Retenues dues", current.withholdingTax],
                ["TFP", current.tfpDue],
                ["FOPROLOS", current.foprolosDue],
                ["TCL", current.tclDue],
                ["Timbre", current.stampDuty],
              ].map(([label, value]) => (
                <Card key={label} variant="outlined" sx={{ p: 1.7 }}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography sx={{ fontWeight: 900, mt: 0.4 }}>
                    {money(value)}
                  </Typography>
                </Card>
              ))}
            </Box>
            <Card
              sx={{
                mt: 2,
                p: 2.2,
                bgcolor: "primary.light",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography sx={{ fontWeight: 900 }}>Total à payer</Typography>
              <Typography
                variant="h3"
                sx={{ fontSize: 27, color: "primary.dark" }}
              >
                {money(current.totalDue)}
              </Typography>
            </Card>
            {current.adjustmentReason && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Ajustement documenté : {current.adjustmentReason}
              </Alert>
            )}
            {current.status === "DEPOSEE" && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Déposée le {dateTime(current.filedAtUtc)} · Référence :{" "}
                {current.filingReference}
                {current.receiptDocument
                  ? ` · Justificatif : ${current.receiptDocument.originalName}`
                  : ""}
              </Alert>
            )}
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ mt: 2, justifyContent: "flex-end", flexWrap: "wrap" }}
            >
              {canManage &&
                !archived &&
                ["BROUILLON", "REJETEE"].includes(current.status) && (
                  <>
                    <Button
                      startIcon={<RefreshRounded />}
                      disabled={prepare.isPending}
                      onClick={() => prepare.mutate()}
                    >
                      Recalculer
                    </Button>
                    <Button onClick={openAdjustment}>Ajuster</Button>
                    <Button
                      variant="contained"
                      startIcon={<SendRounded />}
                      disabled={
                        sourcesChanged || Number(checks?.blockingCount ?? 0) > 0
                      }
                      onClick={() =>
                        action.mutate({
                          type: "review",
                        })
                      }
                    >
                      Soumettre en révision
                    </Button>
                  </>
                )}
              {canValidate &&
                !archived &&
                current.status === "PRETE_POUR_REVISION" && (
                  <>
                    <Button color="error" onClick={() => setRejectOpen(true)}>
                      Rejeter
                    </Button>
                    <Button
                      color="success"
                      variant="contained"
                      startIcon={<CheckCircleOutlineRounded />}
                      disabled={sourcesChanged}
                      onClick={() => action.mutate({ type: "validate" })}
                    >
                      Valider et figer
                    </Button>
                  </>
                )}
              {canValidate && !archived && current.status === "VALIDEE" && (
                <Button
                  variant="contained"
                  startIcon={<UploadFileOutlined />}
                  onClick={() => setFileOpen(true)}
                >
                  Enregistrer le dépôt
                </Button>
              )}
            </Stack>
          </Box>
        )}
      </Card>

      {checks && (
        <Card sx={{ p: 2.5 }}>
          <Stack
            direction="row"
            sx={{
              mb: 1.5,
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Box>
              <Typography variant="h3" sx={{ fontSize: 21 }}>
                Contrôles de cohérence
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {checks.blockingCount} bloquant(s) · {checks.warningCount}{" "}
                avertissement(s)
              </Typography>
            </Box>
            <FactCheckOutlined
              color={checks.blockingCount ? "error" : "success"}
            />
          </Stack>
          <Stack spacing={1}>
            {checks.items.map((check) => (
              <Alert
                key={check.code}
                severity={
                  check.severity === "ERROR"
                    ? "error"
                    : check.severity === "WARNING"
                      ? "warning"
                      : "info"
                }
              >
                {check.message}
              </Alert>
            ))}
          </Stack>
        </Card>
      )}

      {source && (
        <Card sx={{ p: 2.5 }}>
          <Typography variant="h3" sx={{ fontSize: 21 }}>
            Sources du calcul
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Traçabilité des montants utilisés pour {monthNames[month - 1]}{" "}
            {year}.
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
              gap: 1.5,
            }}
          >
            {[
              ["Factures comptabilisées", source.summary.postedInvoiceCount],
              ["Ventes HT", money(source.summary.salesNet)],
              ["Achats HT", money(source.summary.purchaseNet)],
              ["Masse salariale", money(source.summary.payrollGross)],
            ].map(([label, value]) => (
              <Card key={label} variant="outlined" sx={{ p: 1.7 }}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography sx={{ fontWeight: 900, mt: 0.4 }}>
                  {value}
                </Typography>
              </Card>
            ))}
          </Box>
          {source.vatByRate.length > 0 && (
            <Box sx={{ mt: 2, overflowX: "auto" }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>
                TVA par taux
              </Typography>
              <Box
                component="table"
                sx={{
                  width: "100%",
                  borderCollapse: "collapse",
                  "& th, & td": {
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    p: 1.2,
                    textAlign: "left",
                  },
                }}
              >
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Taux</th>
                    <th>Collectée</th>
                    <th>Déductible</th>
                  </tr>
                </thead>
                <tbody>
                  {source.vatByRate.map((row) => (
                    <tr key={`${row.code}-${row.rate}`}>
                      <td>{row.code}</td>
                      <td>{row.rate} %</td>
                      <td>{money(row.collected)}</td>
                      <td>{money(row.deductible)}</td>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Box>
          )}
          {source.withholdingByNature.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography sx={{ fontWeight: 900, mb: 1 }}>
                Retenues par nature
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{ flexWrap: "wrap" }}
              >
                {source.withholdingByNature.map((row) => (
                  <Chip
                    key={row.nature}
                    label={`${row.nature} · ${money(row.amount)}`}
                    variant="outlined"
                  />
                ))}
              </Stack>
            </>
          )}
        </Card>
      )}

      <Alert severity="info">
        Les montants restent soumis à la vérification du professionnel selon le
        régime du client et le texte officiel applicable à la période.
      </Alert>

      <Dialog
        open={adjustOpen}
        onClose={save.isPending ? undefined : () => setAdjustOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Ajuster la déclaration — {monthNames[month - 1]} {year}
        </DialogTitle>
        <DialogContent
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            pt: "12px !important",
          }}
        >
          {error && (
            <Alert severity="error" sx={{ gridColumn: "1 / -1" }}>
              {error}
            </Alert>
          )}
          <TextField
            label="TVA collectée"
            value={form.vatCollected}
            onChange={(event) => set("vatCollected", event.target.value)}
          />
          <TextField
            label="TVA déductible"
            value={form.vatDeductible}
            onChange={(event) => set("vatDeductible", event.target.value)}
          />
          <TextField
            label="Report TVA précédent"
            value={form.vatCreditPrevious}
            onChange={(event) => set("vatCreditPrevious", event.target.value)}
          />
          <TextField
            label="Retenues dues"
            value={form.withholdingTax}
            onChange={(event) => set("withholdingTax", event.target.value)}
          />
          <TextField
            label="Base salariale TFP"
            value={form.tfpBase}
            onChange={(event) => set("tfpBase", event.target.value)}
          />
          <TextField
            label="Base FOPROLOS"
            value={form.foprolosBase}
            onChange={(event) => set("foprolosBase", event.target.value)}
          />
          <TextField
            label="Base TCL"
            value={form.tclBase}
            onChange={(event) => set("tclBase", event.target.value)}
          />
          <TextField
            label="Droit de timbre"
            value={form.stampDuty}
            onChange={(event) => set("stampDuty", event.target.value)}
          />
          <TextField
            label="Justification de l’ajustement"
            value={form.adjustmentReason}
            onChange={(event) => set("adjustmentReason", event.target.value)}
            multiline
            minRows={2}
            sx={{ gridColumn: "1 / -1" }}
            helperText="Obligatoire si un montant diffère du calcul automatique."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            Calculer et enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Rejeter la déclaration</DialogTitle>
        <DialogContent sx={{ pt: "12px !important" }}>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Corrections demandées"
            value={rejectComment}
            onChange={(event) => setRejectComment(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Annuler</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!rejectComment.trim() || action.isPending}
            onClick={() =>
              action.mutate({
                type: "reject",
                body: { comment: rejectComment },
              })
            }
          >
            Rejeter
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={fileOpen}
        onClose={() => setFileOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Enregistrer le dépôt fiscal</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
          <TextField
            label="Référence de télédéclaration / quittance"
            value={filingReference}
            onChange={(event) => setFilingReference(event.target.value)}
            required
          />
          <TextField
            select
            label="Justificatif déjà déposé dans Documents"
            value={receiptDocumentId}
            onChange={(event) => setReceiptDocumentId(event.target.value)}
            helperText="Optionnel maintenant, mais recommandé pour le dossier d’audit."
          >
            <MenuItem value="">Aucun justificatif</MenuItem>
            {(documents.data ?? []).map((document) => (
              <MenuItem key={document.id} value={document.id}>
                {document.originalName}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFileOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!filingReference.trim() || action.isPending}
            onClick={() =>
              action.mutate({
                type: "file",
                body: {
                  filingReference,
                  ...(receiptDocumentId ? { receiptDocumentId } : {}),
                },
              })
            }
          >
            Confirmer le dépôt
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
