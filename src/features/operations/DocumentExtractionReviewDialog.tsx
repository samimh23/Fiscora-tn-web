import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  ContentCopyRounded,
  DeleteOutlineRounded,
} from "@mui/icons-material";
import { api, ApiError } from "../../api/client";
import { SearchableSelect } from "../../components/SearchableSelect";
import { PdfDocumentViewer } from "../../components/PdfDocumentViewer";
import { supportsDocumentExtraction } from "./options";
import type {
  BankAccount,
  DocumentExtractionReviewItem,
  DocumentPreview,
} from "../../types/api";

const extractionFields = [
  { path: "document_type", label: "Type de document" },
  { path: "supplier.name", label: "Fournisseur" },
  { path: "document_number", label: "Numéro" },
  { path: "issue_date", label: "Date d’émission" },
  { path: "gross_subtotal_excl_tax", label: "Total HT avant remise" },
  { path: "global_discount_amount", label: "Remise globale" },
  { path: "global_discount_rate", label: "Taux de remise" },
  { path: "subtotal_excl_tax", label: "Base HT après remise" },
  { path: "tax_amount", label: "TVA" },
  { path: "fodec_amount", label: "FODEC" },
  { path: "stamp_tax", label: "Timbre" },
  { path: "total_incl_tax", label: "Total TTC" },
  { path: "amount_due", label: "Net à payer" },
] as const;

const bankExtractionFields = [
  { path: "bank_statement.bank_name", label: "Banque" },
  { path: "bank_statement.iban", label: "IBAN / RIB" },
  { path: "bank_statement.account_number", label: "Numéro de compte" },
  { path: "currency", label: "Devise" },
  { path: "bank_statement.period_start", label: "Début de période" },
  { path: "bank_statement.period_end", label: "Fin de période" },
  { path: "bank_statement.opening_balance", label: "Solde initial" },
  { path: "bank_statement.closing_balance", label: "Solde final" },
] as const;

const readPath = (record: Record<string, unknown>, path: string) => {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current))
      return undefined;
    return (current as Record<string, unknown>)[key];
  }, record);
  return value == null ? "" : String(value);
};

const writePath = (
  record: Record<string, unknown>,
  path: string,
  value: string,
) => {
  const copy = structuredClone(record);
  const keys = path.split(".");
  let cursor = copy;
  keys.slice(0, -1).forEach((key) => {
    const child = cursor[key];
    if (!child || typeof child !== "object" || Array.isArray(child))
      cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  });
  cursor[keys[keys.length - 1]] = value.trim() ? value : null;
  return copy;
};

type ExtractionEvidence = {
  status?: "MATCHED";
  page: number;
  text: string;
  bbox: [number, number, number, number];
};

const extractionEvidence = (
  source: Record<string, unknown>,
  requestedPath: string,
): ExtractionEvidence | null => {
  const evidence = source._evidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence))
    return null;
  const records = evidence as Record<string, unknown>;
  const candidates = [requestedPath];
  const segments = requestedPath.split(".");
  if (segments.length > 2) candidates.push(segments.slice(0, -1).join("."));
  for (const path of candidates) {
    const candidate = records[path];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      continue;
    const record = candidate as Record<string, unknown>;
    if (record.status != null && record.status !== "MATCHED") continue;
    const bbox = record.bbox;
    if (
      !Array.isArray(bbox) ||
      bbox.length !== 4 ||
      !bbox.every(
        (value) => typeof value === "number" && Number.isFinite(value),
      )
    )
      continue;
    const normalized = bbox.map((value) =>
      Math.min(1000, Math.max(0, value)),
    ) as [number, number, number, number];
    if (normalized[2] <= normalized[0] || normalized[3] <= normalized[1])
      continue;
    return {
      page: typeof record.page === "number" ? record.page : 1,
      text: typeof record.text === "string" ? record.text : "",
      bbox: normalized,
    };
  }
  return null;
};

export function DocumentExtractionReviewDialog({
  organizationId,
  dossierId,
  target: reviewTarget,
  onClose,
  initialBankAccountId,
}: {
  organizationId: string;
  dossierId: string;
  target: DocumentExtractionReviewItem;
  onClose: () => void;
  initialBankAccountId?: string;
}) {
  const queryClient = useQueryClient();
  const [reviewSource] = useState<Record<string, unknown>>(() =>
    structuredClone(
      reviewTarget.sourceData ?? reviewTarget.normalizedData ?? {},
    ),
  );
  const [reviewDraft, setReviewDraft] = useState<Record<string, unknown>>(() =>
    structuredClone(reviewTarget.normalizedData ?? reviewSource),
  );
  const [highlightedEvidencePath, setHighlightedEvidencePath] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBankAccountId, setReviewBankAccountId] = useState(
    initialBankAccountId ?? "",
  );
  const [forceApproveOpen, setForceApproveOpen] = useState(false);
  const [forceApprovalAcknowledged, setForceApprovalAcknowledged] =
    useState(false);
  const [error, setError] = useState("");
  const refresh = () =>
    Promise.all(
      [
        "dossier-documents",
        "missing-documents",
        "document-extraction-reviews",
        "bank-statements",
      ].map((key) =>
        queryClient.invalidateQueries({
          queryKey: [key, organizationId, dossierId],
        }),
      ),
    );
  const requestExtraction = useMutation({
    mutationFn: (documentId: string) =>
      api.post(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${documentId}/extraction`,
      ),
    onSuccess: async () => {
      await refresh();
      onClose();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Impossible de démarrer l’extraction.",
      ),
  });
  const bankAccounts = useQuery({
    queryKey: ["bank-accounts", organizationId, dossierId],
    queryFn: () =>
      api.get<BankAccount[]>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/bank-reconciliation/accounts`,
      ),
    enabled: reviewDraft.document_type === "bank_statement",
  });
  const reviewPreview = useQuery({
    queryKey: [
      "document-extraction-preview",
      organizationId,
      dossierId,
      reviewTarget?.document.id,
    ],
    queryFn: () =>
      api.get<DocumentPreview>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${reviewTarget!.document.id}/preview`,
      ),
    enabled: Boolean(reviewTarget),
    retry: false,
  });
  const reviewExtraction = useMutation({
    mutationFn: ({
      documentId,
      decision,
      forceApprove,
    }: {
      documentId: string;
      decision: "APPROUVER" | "REJETER";
      forceApprove?: boolean;
    }) =>
      api.patch(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${documentId}/extraction/review`,
        {
          decision,
          ...(decision === "APPROUVER" ? { correctedData: reviewDraft } : {}),
          ...(decision === "APPROUVER" &&
          reviewDraft.document_type === "bank_statement"
            ? { bankAccountId: reviewBankAccountId }
            : {}),
          forceApprove: forceApprove || undefined,
          comment:
            reviewComment.trim() ||
            (forceApprove
              ? "Approbation forcée confirmée après vérification de la pièce originale."
              : undefined),
        },
      ),
    onSuccess: async () => {
      await refresh();
      onClose();
    },
    onError: (reason, variables) => {
      const message =
        reason instanceof ApiError
          ? reason.message
          : "Impossible d’enregistrer la décision.";
      setError(message);
      if (
        variables.decision === "APPROUVER" &&
        !variables.forceApprove &&
        message.includes("incohérences bloquantes")
      ) {
        setForceApprovalAcknowledged(false);
        setForceApproveOpen(true);
      }
    },
  });
  const approveExtraction = () => {
    if (!reviewTarget) return;
    if (
      reviewTarget.validationIssues.some((issue) => issue.severity === "ERROR")
    ) {
      setError("");
      setForceApprovalAcknowledged(false);
      setForceApproveOpen(true);
      return;
    }
    reviewExtraction.mutate({
      documentId: reviewTarget.documentId,
      decision: "APPROUVER",
    });
  };
  const reviewLines = Array.isArray(reviewDraft.line_items)
    ? reviewDraft.line_items.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
  const reviewTaxes = Array.isArray(reviewDraft.other_taxes)
    ? reviewDraft.other_taxes.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
  const reviewAdditionalFields = Array.isArray(reviewDraft.additional_fields)
    ? reviewDraft.additional_fields.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
  const evidenceRecord =
    reviewSource._evidence &&
    typeof reviewSource._evidence === "object" &&
    !Array.isArray(reviewSource._evidence)
      ? (reviewSource._evidence as Record<string, unknown>)
      : {};
  const evidenceCount = Object.values(evidenceRecord).filter(
    (candidate) =>
      Boolean(candidate) &&
      typeof candidate === "object" &&
      !Array.isArray(candidate) &&
      ((candidate as Record<string, unknown>).status == null ||
        (candidate as Record<string, unknown>).status === "MATCHED") &&
      Array.isArray((candidate as Record<string, unknown>).bbox),
  ).length;
  const highlightedEvidence = highlightedEvidencePath
    ? extractionEvidence(reviewSource, highlightedEvidencePath)
    : null;
  const focusEvidence = (...paths: string[]) => {
    const available = paths.find((path) =>
      extractionEvidence(reviewSource, path),
    );
    setHighlightedEvidencePath(available ?? paths[0] ?? "");
  };
  const isBankReview = reviewDraft.document_type === "bank_statement";
  const reviewBankStatement =
    reviewDraft.bank_statement &&
    typeof reviewDraft.bank_statement === "object" &&
    !Array.isArray(reviewDraft.bank_statement)
      ? (reviewDraft.bank_statement as Record<string, unknown>)
      : {};
  const reviewTransactions = Array.isArray(reviewBankStatement.transactions)
    ? reviewBankStatement.transactions.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
  const updateReviewTransaction = (
    index: number,
    field:
      | "transaction_date"
      | "value_date"
      | "description"
      | "reference"
      | "debit"
      | "credit"
      | "amount"
      | "balance",
    value: string,
  ) => {
    const transactions = reviewTransactions.map((item) => ({ ...item }));
    transactions[index][field] = value.trim() ? value : null;
    if (field === "debit" || field === "credit")
      transactions[index].amount = null;
    setReviewDraft({
      ...reviewDraft,
      bank_statement: { ...reviewBankStatement, transactions },
    });
  };
  const addReviewTransaction = () => {
    const transactions = [
      ...reviewTransactions.map((item) => ({ ...item })),
      {
        transaction_date: null,
        value_date: null,
        description: null,
        reference: null,
        debit: null,
        credit: null,
        amount: null,
        balance: null,
      },
    ];
    setReviewDraft({
      ...reviewDraft,
      bank_statement: { ...reviewBankStatement, transactions },
    });
  };
  const duplicateReviewTransaction = (index: number) => {
    const transactions = reviewTransactions.map((item) => ({ ...item }));
    transactions.splice(index + 1, 0, {
      ...transactions[index],
      amount: null,
    });
    setReviewDraft({
      ...reviewDraft,
      bank_statement: { ...reviewBankStatement, transactions },
    });
  };
  const removeReviewTransaction = (index: number) => {
    const transactions = reviewTransactions
      .filter((_, itemIndex) => itemIndex !== index)
      .map((item) => ({ ...item }));
    setReviewDraft({
      ...reviewDraft,
      bank_statement: { ...reviewBankStatement, transactions },
    });
  };
  useEffect(() => {
    if (!isBankReview || !bankAccounts.data?.length) return;
    if (bankAccounts.data.some((account) => account.id === reviewBankAccountId))
      return;
    const extractedIban = String(reviewBankStatement.iban ?? "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    const matching = bankAccounts.data.find(
      (account) =>
        Boolean(extractedIban) &&
        account.iban?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() ===
          extractedIban,
    );
    setReviewBankAccountId(
      matching?.id ??
        (bankAccounts.data.length === 1 ? bankAccounts.data[0].id : ""),
    );
  }, [
    bankAccounts.data,
    isBankReview,
    reviewBankAccountId,
    reviewBankStatement.iban,
  ]);
  const updateReviewTax = (
    index: number,
    field: "label" | "amount",
    value: string,
  ) => {
    const taxes = reviewTaxes.map((item) => ({ ...item }));
    taxes[index][field] = value.trim() ? value : null;
    setReviewDraft({ ...reviewDraft, other_taxes: taxes });
  };
  const addReviewTax = () =>
    setReviewDraft({
      ...reviewDraft,
      other_taxes: [
        ...reviewTaxes.map((item) => ({ ...item })),
        { label: null, amount: null },
      ],
    });
  const removeReviewTax = (index: number) =>
    setReviewDraft({
      ...reviewDraft,
      other_taxes: reviewTaxes
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item) => ({ ...item })),
    });
  const updateReviewLine = (
    index: number,
    field:
      | "description"
      | "quantity"
      | "unit_price"
      | "discount_rate"
      | "tax_rate"
      | "line_total",
    value: string,
  ) => {
    const lines = reviewLines.map((item) => ({ ...item }));
    lines[index][field] = value.trim() ? value : null;
    setReviewDraft({ ...reviewDraft, line_items: lines });
  };
  const addReviewLine = () =>
    setReviewDraft({
      ...reviewDraft,
      line_items: [
        ...reviewLines.map((item) => ({ ...item })),
        {
          description: null,
          quantity: null,
          unit_price: null,
          discount_rate: null,
          tax_rate: null,
          line_total: null,
        },
      ],
    });
  const duplicateReviewLine = (index: number) => {
    const lines = reviewLines.map((item) => ({ ...item }));
    lines.splice(index + 1, 0, { ...lines[index] });
    setReviewDraft({ ...reviewDraft, line_items: lines });
  };
  const removeReviewLine = (index: number) =>
    setReviewDraft({
      ...reviewDraft,
      line_items: reviewLines
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item) => ({ ...item })),
    });
  const updateAdditionalField = (
    index: number,
    field: "label" | "value",
    value: string,
  ) => {
    const fields = reviewAdditionalFields.map((item) => ({ ...item }));
    fields[index][field] = value.trim() ? value : null;
    setReviewDraft({ ...reviewDraft, additional_fields: fields });
  };
  const addAdditionalField = () =>
    setReviewDraft({
      ...reviewDraft,
      additional_fields: [
        ...reviewAdditionalFields.map((item) => ({ ...item })),
        { label: null, value: null },
      ],
    });
  const removeAdditionalField = (index: number) =>
    setReviewDraft({
      ...reviewDraft,
      additional_fields: reviewAdditionalFields
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item) => ({ ...item })),
    });
  return (
    <>
      <Dialog
        open={Boolean(reviewTarget)}
        onClose={
          reviewExtraction.isPending || requestExtraction.isPending
            ? undefined
            : onClose
        }
        fullWidth
        maxWidth="xl"
      >
        <DialogTitle>
          <Typography variant="h3">
            Vérifier les données lues par l’IA
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {reviewTarget?.document.originalName} · comparez chaque valeur avec
            la pièce originale avant validation.
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {error && (
            <Alert severity="error" sx={{ m: 2.5 }}>
              {error}
            </Alert>
          )}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 520px" },
              minHeight: { lg: 620 },
            }}
          >
            <Box
              sx={{
                bgcolor: "grey.100",
                p: 2.5,
                display: "flex",
                minHeight: 420,
                borderRight: { lg: "1px solid" },
                borderColor: { lg: "divider" },
              }}
            >
              {reviewPreview.isLoading && (
                <Skeleton variant="rounded" width="100%" height={520} />
              )}
              {reviewPreview.isError && (
                <Alert severity="error" sx={{ alignSelf: "flex-start" }}>
                  Aperçu indisponible. Téléchargez la pièce avant de prendre une
                  décision.
                </Alert>
              )}
              {reviewPreview.data?.kind === "image" &&
                reviewPreview.data.url && (
                  <Box
                    sx={{
                      position: "relative",
                      display: "inline-block",
                      maxWidth: "100%",
                      maxHeight: 720,
                      m: "auto",
                      lineHeight: 0,
                    }}
                  >
                    <Box
                      component="img"
                      src={reviewPreview.data.url}
                      alt={reviewPreview.data.originalName}
                      sx={{
                        display: "block",
                        maxWidth: "100%",
                        maxHeight: 720,
                        width: "auto",
                        height: "auto",
                        bgcolor: "common.white",
                        boxShadow: 1,
                      }}
                    />
                    {highlightedEvidence && highlightedEvidence.page === 1 && (
                      <>
                        <Box
                          aria-label={`Zone extraite ${highlightedEvidence.text}`}
                          sx={{
                            position: "absolute",
                            pointerEvents: "none",
                            left: `${highlightedEvidence.bbox[0] / 10}%`,
                            top: `${highlightedEvidence.bbox[1] / 10}%`,
                            width: `${(highlightedEvidence.bbox[2] - highlightedEvidence.bbox[0]) / 10}%`,
                            height: `${(highlightedEvidence.bbox[3] - highlightedEvidence.bbox[1]) / 10}%`,
                            border: "3px solid",
                            borderColor: "warning.main",
                            bgcolor: "rgba(255, 193, 7, 0.2)",
                            boxShadow: "0 0 0 2px rgba(255,255,255,.9)",
                            zIndex: 2,
                          }}
                        />
                        {highlightedEvidence.text && (
                          <Box
                            sx={{
                              position: "absolute",
                              pointerEvents: "none",
                              left: `${highlightedEvidence.bbox[0] / 10}%`,
                              top: `${highlightedEvidence.bbox[1] / 10}%`,
                              transform: "translateY(-100%)",
                              maxWidth: 260,
                              px: 1,
                              py: 0.5,
                              bgcolor: "warning.main",
                              color: "warning.contrastText",
                              fontSize: 12,
                              fontWeight: 700,
                              lineHeight: 1.2,
                              zIndex: 3,
                            }}
                          >
                            {highlightedEvidence.text}
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                )}
              {reviewPreview.data?.kind === "pdf" && reviewTarget && (
                <PdfDocumentViewer
                  sourcePath={`/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${reviewTarget.document.id}/content`}
                  originalName={reviewPreview.data.originalName}
                  highlight={highlightedEvidence}
                  minHeight={620}
                  maxHeight={720}
                />
              )}
            </Box>
            <Box sx={{ p: 2.5, overflowY: "auto", maxHeight: { lg: 720 } }}>
              <Typography variant="h4" sx={{ mb: 0.5 }}>
                Données à confirmer
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Corrigez les champs inexacts. Les contrôles comptables seront
                relancés lors de l’approbation.
              </Typography>
              {evidenceCount > 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Cliquez dans un champ ou une ligne pour afficher sa source OCR
                  confirmée ({evidenceCount} zone(s) détectée(s)).
                </Alert>
              ) : (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Aucune source OCR suffisamment sûre n’a été localisée. Les
                  champs restent modifiables et aucune zone incertaine ne sera
                  surlignée.
                </Alert>
              )}
              {reviewTarget?.validationIssues.map((issue) => (
                <Alert
                  key={`${issue.code}-${issue.field}`}
                  severity={issue.severity === "ERROR" ? "error" : "warning"}
                  sx={{ mb: 1 }}
                >
                  <strong>{issue.field}</strong> — {issue.message}
                </Alert>
              ))}
              {!reviewTarget?.validationIssues.length && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Les contrôles automatiques sont cohérents. Une vérification
                  visuelle reste obligatoire.
                </Alert>
              )}
              {isBankReview && (
                <SearchableSelect
                  label="Compte bancaire de destination"
                  value={reviewBankAccountId}
                  onChange={setReviewBankAccountId}
                  options={(bankAccounts.data ?? []).map((account) => ({
                    value: account.id,
                    label: `${account.name} · ${account.iban || account.currency}`,
                  }))}
                  placeholder="Rechercher un compte bancaire…"
                  helperText={
                    bankAccounts.data?.length
                      ? "Vérifiez que ce compte correspond au relevé avant de confirmer l’import."
                      : "Créez d’abord un compte bancaire dans Production > Banque."
                  }
                  sx={{ mb: 2, width: "100%" }}
                />
              )}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 1.5,
                }}
              >
                {(isBankReview ? bankExtractionFields : extractionFields).map(
                  (field) => (
                    <TextField
                      key={field.path}
                      size="small"
                      label={field.label}
                      value={readPath(reviewDraft, field.path)}
                      onFocus={() => focusEvidence(field.path)}
                      onChange={(event) =>
                        setReviewDraft(
                          writePath(
                            reviewDraft,
                            field.path,
                            event.target.value,
                          ),
                        )
                      }
                      fullWidth
                    />
                  ),
                )}
              </Box>
              {isBankReview && reviewTransactions.length > 0 && (
                <Box sx={{ mt: 2.5 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Typography variant="h4">
                      Opérations détectées ({reviewTransactions.length})
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddRounded />}
                      onClick={addReviewTransaction}
                    >
                      Ajouter une opération
                    </Button>
                  </Box>
                  <Box
                    sx={{
                      overflowX: "auto",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                    }}
                  >
                    <Box
                      component="table"
                      sx={{
                        minWidth: 1160,
                        width: "100%",
                        borderCollapse: "collapse",
                        "& th, & td": {
                          px: 0.75,
                          py: 0.75,
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          verticalAlign: "top",
                        },
                        "& th": { bgcolor: "grey.100", fontSize: 12 },
                      }}
                    >
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Valeur</th>
                          <th>Libellé</th>
                          <th>Référence</th>
                          <th>Débit</th>
                          <th>Crédit</th>
                          <th>Solde</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewTransactions.map((transaction, index) => (
                          <tr key={index}>
                            {(
                              [
                                "transaction_date",
                                "value_date",
                                "description",
                                "reference",
                                "debit",
                                "credit",
                                "balance",
                              ] as const
                            ).map((field) => (
                              <td key={field}>
                                <TextField
                                  size="small"
                                  value={String(transaction[field] ?? "")}
                                  onFocus={() =>
                                    focusEvidence(
                                      `bank_statement.transactions.${index}.${field}`,
                                      `bank_statement.transactions.${index}`,
                                    )
                                  }
                                  onChange={(event) =>
                                    updateReviewTransaction(
                                      index,
                                      field,
                                      event.target.value,
                                    )
                                  }
                                  sx={{
                                    minWidth:
                                      field === "description" ? 220 : 115,
                                  }}
                                />
                              </td>
                            ))}
                            <td>
                              <Box sx={{ display: "flex", gap: 0.25 }}>
                                <Tooltip title="Dupliquer pour scinder la ligne">
                                  <IconButton
                                    size="small"
                                    aria-label="Dupliquer pour scinder la ligne"
                                    onClick={() =>
                                      duplicateReviewTransaction(index)
                                    }
                                  >
                                    <ContentCopyRounded fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Supprimer l’opération">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    aria-label="Supprimer l’opération"
                                    onClick={() =>
                                      removeReviewTransaction(index)
                                    }
                                  >
                                    <DeleteOutlineRounded fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Box>
                  </Box>
                </Box>
              )}
              {!isBankReview && (
                <Box sx={{ mt: 2.5 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Typography variant="h4">
                      Autres taxes et prélèvements
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddRounded />}
                      onClick={addReviewTax}
                    >
                      Ajouter une taxe
                    </Button>
                  </Box>
                  {!reviewTaxes.length && (
                    <Typography variant="body2" color="text.secondary">
                      Aucune taxe complémentaire détectée.
                    </Typography>
                  )}
                  <Box sx={{ display: "grid", gap: 1 }}>
                    {reviewTaxes.map((tax, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) 150px auto",
                          gap: 1,
                          alignItems: "center",
                        }}
                      >
                        <TextField
                          size="small"
                          label="Libellé"
                          value={tax.label == null ? "" : String(tax.label)}
                          onFocus={() =>
                            focusEvidence(
                              `other_taxes.${index}.label`,
                              `other_taxes.${index}`,
                            )
                          }
                          onChange={(event) =>
                            updateReviewTax(index, "label", event.target.value)
                          }
                        />
                        <TextField
                          size="small"
                          label="Montant"
                          value={tax.amount == null ? "" : String(tax.amount)}
                          onFocus={() =>
                            focusEvidence(
                              `other_taxes.${index}.amount`,
                              `other_taxes.${index}`,
                            )
                          }
                          onChange={(event) =>
                            updateReviewTax(index, "amount", event.target.value)
                          }
                        />
                        <Tooltip title="Supprimer la taxe">
                          <IconButton
                            size="small"
                            color="error"
                            aria-label="Supprimer la taxe"
                            onClick={() => removeReviewTax(index)}
                          >
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
              {!isBankReview && (
                <Box sx={{ mt: 2.5 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Typography variant="h4">
                      Lignes détectées ({reviewLines.length})
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddRounded />}
                      onClick={addReviewLine}
                    >
                      Ajouter une ligne
                    </Button>
                  </Box>
                  {!reviewLines.length && (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                      Aucune ligne détectée. Ajoutez les lignes visibles sur la
                      pièce avant de confirmer.
                    </Alert>
                  )}
                  <Box
                    sx={{
                      overflowX: "auto",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                    }}
                  >
                    <Box
                      component="table"
                      sx={{
                        minWidth: 900,
                        width: "100%",
                        borderCollapse: "collapse",
                        "& th, & td": {
                          textAlign: "left",
                          px: 1.25,
                          py: 1,
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          fontSize: 13,
                        },
                        "& th": { bgcolor: "grey.100", fontWeight: 700 },
                      }}
                    >
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Qté</th>
                          <th>Prix unitaire</th>
                          <th>Remise</th>
                          <th>TVA</th>
                          <th>Total</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewLines.map((line, index) => (
                          <tr key={index}>
                            {(
                              [
                                "description",
                                "quantity",
                                "unit_price",
                                "discount_rate",
                                "tax_rate",
                                "line_total",
                              ] as const
                            ).map((field) => (
                              <td key={field}>
                                <TextField
                                  size="small"
                                  value={String(line[field] ?? "")}
                                  onFocus={() =>
                                    focusEvidence(
                                      `line_items.${index}.${field}`,
                                      `line_items.${index}`,
                                    )
                                  }
                                  onChange={(event) =>
                                    updateReviewLine(
                                      index,
                                      field,
                                      event.target.value,
                                    )
                                  }
                                  sx={{
                                    minWidth:
                                      field === "description" ? 220 : 105,
                                  }}
                                />
                              </td>
                            ))}
                            <td>
                              <Box sx={{ display: "flex", gap: 0.25 }}>
                                <Tooltip title="Dupliquer la ligne">
                                  <IconButton
                                    size="small"
                                    aria-label="Dupliquer la ligne"
                                    onClick={() => duplicateReviewLine(index)}
                                  >
                                    <ContentCopyRounded fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Supprimer la ligne">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    aria-label="Supprimer la ligne"
                                    onClick={() => removeReviewLine(index)}
                                  >
                                    <DeleteOutlineRounded fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Box>
                  </Box>
                </Box>
              )}
              {!isBankReview && (
                <Box sx={{ mt: 2.5 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Box>
                      <Typography variant="h4">
                        Champs supplémentaires
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Informations visibles qui ne font pas partie des champs
                        comptables standards.
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddRounded />}
                      onClick={addAdditionalField}
                    >
                      Ajouter un champ
                    </Button>
                  </Box>
                  <Box sx={{ display: "grid", gap: 1 }}>
                    {reviewAdditionalFields.map((field, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(0, 1fr) minmax(0, 1fr) auto",
                          gap: 1,
                          alignItems: "center",
                        }}
                      >
                        <TextField
                          size="small"
                          label="Nom du champ"
                          value={String(field.label ?? "")}
                          onChange={(event) =>
                            updateAdditionalField(
                              index,
                              "label",
                              event.target.value,
                            )
                          }
                        />
                        <TextField
                          size="small"
                          label="Valeur"
                          value={String(field.value ?? "")}
                          onChange={(event) =>
                            updateAdditionalField(
                              index,
                              "value",
                              event.target.value,
                            )
                          }
                        />
                        <Tooltip title="Supprimer le champ">
                          <IconButton
                            size="small"
                            color="error"
                            aria-label="Supprimer le champ"
                            onClick={() => removeAdditionalField(index)}
                          >
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
              <TextField
                label="Note de contrôle"
                placeholder="Obligatoire en cas de rejet"
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                multiline
                minRows={3}
                fullWidth
                sx={{ mt: 2.5 }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="outlined"
            disabled={
              requestExtraction.isPending ||
              reviewExtraction.isPending ||
              !supportsDocumentExtraction(reviewTarget.document.category)
            }
            onClick={() =>
              reviewTarget && requestExtraction.mutate(reviewTarget.documentId)
            }
          >
            {requestExtraction.isPending
              ? "Relance en cours…"
              : "Relire avec l’IA"}
          </Button>
          <Button
            onClick={onClose}
            disabled={requestExtraction.isPending || reviewExtraction.isPending}
          >
            Fermer
          </Button>
          <Button
            color="error"
            variant="outlined"
            disabled={
              !reviewComment.trim() ||
              reviewExtraction.isPending ||
              requestExtraction.isPending
            }
            onClick={() =>
              reviewTarget &&
              reviewExtraction.mutate({
                documentId: reviewTarget.documentId,
                decision: "REJETER",
              })
            }
          >
            Rejeter
          </Button>
          <Button
            color="success"
            variant="contained"
            disabled={
              reviewExtraction.isPending ||
              requestExtraction.isPending ||
              (isBankReview && !reviewBankAccountId)
            }
            onClick={approveExtraction}
          >
            Confirmer ces données
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={forceApproveOpen}
        onClose={
          reviewExtraction.isPending
            ? undefined
            : () => setForceApproveOpen(false)
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Confirmer malgré les erreurs ?</DialogTitle>
        <DialogContent dividers>
          <Alert severity="error" sx={{ mb: 2 }}>
            Les contrôles comptables signalent encore des incohérences. En
            continuant, les données seront validées telles qu’elles sont
            affichées et l’approbation forcée sera enregistrée dans le journal
            d’audit.
          </Alert>
          {reviewTarget?.validationIssues
            .filter((issue) => issue.severity === "ERROR")
            .map((issue) => (
              <Typography
                key={`${issue.code}-${issue.field}`}
                variant="body2"
                sx={{ mb: 1 }}
              >
                <strong>{issue.field}</strong> — {issue.message}
              </Typography>
            ))}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <FormControlLabel
            sx={{ mt: 2, alignItems: "flex-start" }}
            control={
              <Checkbox
                checked={forceApprovalAcknowledged}
                onChange={(event) =>
                  setForceApprovalAcknowledged(event.target.checked)
                }
              />
            }
            label="J’ai comparé ces données avec la pièce originale et je souhaite les confirmer malgré les erreurs signalées."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setForceApproveOpen(false)}
            disabled={reviewExtraction.isPending}
          >
            Annuler
          </Button>
          <Button
            color="warning"
            variant="contained"
            disabled={!forceApprovalAcknowledged || reviewExtraction.isPending}
            onClick={() =>
              reviewTarget &&
              reviewExtraction.mutate({
                documentId: reviewTarget.documentId,
                decision: "APPROUVER",
                forceApprove: true,
              })
            }
          >
            {reviewExtraction.isPending
              ? "Confirmation…"
              : "Confirmer quand même"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
