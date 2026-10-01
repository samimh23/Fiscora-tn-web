import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  ApartmentRounded,
  AutoAwesomeRounded,
  CheckCircleOutlineRounded,
  ContentCopyRounded,
  DeleteOutlineRounded,
  DownloadRounded,
  EmailOutlined,
  InsertDriveFileOutlined,
  PersonOutlineRounded,
  ReceiptLongOutlined,
  UploadFileRounded,
  VisibilityOutlined,
} from "@mui/icons-material";
import { api, ApiError } from "../../api/client";
import { SearchableSelect } from "../../components/SearchableSelect";
import { PdfDocumentViewer } from "../../components/PdfDocumentViewer";
import type {
  AccountingDocument,
  DossierSummary,
  DocumentExtractionReviewItem,
  DocumentPreview,
  InboundEmailMessage,
  MissingDocumentExpectation,
  OrganizationSummary,
} from "../../types/api";
import { DocumentExtractionReviewDialog } from "./DocumentExtractionReviewDialog";
import { documentCategories, documentCategoryLabel } from "./options";

const current = new Date();
const currentYear = current.getFullYear();
const currentMonth = current.getMonth() + 1;
const accepted = ".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.xml,.csv";
const fileSize = (value: string) => {
  const bytes = Number(value);
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
};
const malwareStatus = (document: AccountingDocument) => {
  switch (document.malwareScanStatus) {
    case "SAIN":
      return { label: "Antivirus : sain", color: "success" as const };
    case "INFECTE":
      return { label: "Fichier bloqué", color: "error" as const };
    case "ERREUR":
      return { label: "Analyse indisponible", color: "warning" as const };
    default:
      return { label: "Analyse requise", color: "warning" as const };
  }
};
const requestStatus = (entry: MissingDocumentExpectation) => {
  const status =
    entry.status ?? (entry.receivedDocumentId ? "RECUE" : "DEMANDEE");
  const labels: Record<string, string> = {
    DEMANDEE: "Demandée",
    RECUE: "Reçue",
    VALIDEE: "Validée",
    REJETEE: "À corriger",
    ANNULEE: "Annulée",
  };
  const colors: Record<string, "default" | "error" | "success" | "warning"> = {
    DEMANDEE: "warning",
    RECUE: "default",
    VALIDEE: "success",
    REJETEE: "error",
    ANNULEE: "default",
  };
  return {
    label: labels[status] ?? status,
    color: colors[status] ?? "default",
  };
};
const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-TN", { dateStyle: "medium" }).format(
        new Date(`${value.slice(0, 10)}T00:00:00`),
      )
    : "—";

const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-TN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

const documentOrigin = (document: AccountingDocument) => {
  if (document.ingestionSource === "PUBLIC_LINK") {
    return {
      label: "Déposé via le lien sécurisé",
      detail: document.sourceEmail ?? document.uploadedBy.name,
      color: "info" as const,
      icon: <PersonOutlineRounded fontSize="small" />,
    };
  }
  if (document.ingestionSource === "GENERATED") {
    return {
      label: "Émise par le client",
      detail: document.uploadedBy.name,
      color: "info" as const,
      icon: <PersonOutlineRounded fontSize="small" />,
    };
  }
  switch (document.uploadedBy?.type) {
    case "CLIENT":
      return {
        label: "Reçu du client",
        detail: document.uploadedBy.name,
        color: "info" as const,
        icon: <PersonOutlineRounded fontSize="small" />,
      };
    case "CABINET":
      return {
        label: "Ajouté par le cabinet",
        detail: document.uploadedBy.name,
        color: "default" as const,
        icon: <ApartmentRounded fontSize="small" />,
      };
    case "EMAIL":
      return {
        label: "Reçu par e-mail",
        detail: document.sourceEmail ?? document.uploadedBy.name,
        color: "info" as const,
        icon: <EmailOutlined fontSize="small" />,
      };
    default:
      return {
        label: "Origine non renseignée",
        detail: document.uploadedBy?.name ?? "—",
        color: "default" as const,
        icon: <InsertDriveFileOutlined fontSize="small" />,
      };
  }
};

const extractionStatus = (status: string) => {
  const values: Record<
    string,
    { label: string; color: "default" | "info" | "warning" | "success" | "error" }
  > = {
    NON_DEMANDEE: { label: "Non extraite", color: "default" },
    EN_ATTENTE: { label: "Extraction planifiée", color: "info" },
    EN_COURS: { label: "Extraction en cours", color: "info" },
    A_REVOIR: { label: "Contrôle requis", color: "warning" },
    VALIDEE: { label: "Extraction validée", color: "success" },
    REJETEE: { label: "Extraction rejetée", color: "error" },
    ECHEC: { label: "Extraction en échec", color: "error" },
  };
  return values[status] ?? { label: status, color: "default" as const };
};

const hasInvoiceExtraction = (document: AccountingDocument) => {
  if (
    !document.extractedData ||
    typeof document.extractedData !== "object" ||
    Array.isArray(document.extractedData)
  )
    return false;
  return ["invoice", "credit_note", "receipt"].includes(
    String(
      (document.extractedData as Record<string, unknown>).document_type ?? "",
    ),
  );
};

export function DossierDocumentsPanel({
  organizationId,
  dossierId,
  archived,
  canUpload,
  canValidate,
  canCreateInvoice,
}: {
  organizationId: string;
  dossierId: string;
  archived: boolean;
  canUpload: boolean;
  canValidate: boolean;
  canCreateInvoice: boolean;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [category, setCategory] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [expectationOpen, setExpectationOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountingDocument | null>(
    null,
  );
  const [previewTarget, setPreviewTarget] = useState<AccountingDocument | null>(
    null,
  );
  const [previewSheet, setPreviewSheet] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState("BOITE_RECEPTION");
  const [scanIntent, setScanIntent] = useState<"invoice" | "bank" | null>(
    null,
  );
  const [shareWithClient, setShareWithClient] = useState(false);
  const [expectationId, setExpectationId] = useState("");
  const [expectationLabel, setExpectationLabel] = useState("");
  const [expectationCategory, setExpectationCategory] =
    useState("BOITE_RECEPTION");
  const [expectationDueOn, setExpectationDueOn] = useState("");
  const [expectationMessage, setExpectationMessage] = useState("");
  const [expectationRecipientEmail, setExpectationRecipientEmail] =
    useState("");
  const [rejectTarget, setRejectTarget] =
    useState<MissingDocumentExpectation | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [resendTarget, setResendTarget] =
    useState<MissingDocumentExpectation | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [receiveSelections, setReceiveSelections] = useState<
    Record<string, string>
  >({});
  const [reviewTarget, setReviewTarget] =
    useState<DocumentExtractionReviewItem | null>(null);
  const [error, setError] = useState("");
  const [copiedAddress, setCopiedAddress] = useState("");
  const organization = useQuery({
    queryKey: ["organization-email-ingestion", organizationId],
    queryFn: () =>
      api.get<OrganizationSummary>(`/api/organizations/${organizationId}`),
    enabled: canUpload,
  });
  const dossier = useQuery({
    queryKey: ["dossier-email-ingestion", organizationId, dossierId],
    queryFn: () =>
      api.get<DossierSummary>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}`,
      ),
    enabled: canUpload,
  });
  const unmatchedEmails = useQuery({
    queryKey: ["unmatched-inbound-emails", organizationId],
    queryFn: () =>
      api.get<InboundEmailMessage[]>(
        `/api/organizations/${organizationId}/email-ingestion/unmatched`,
      ),
    enabled: canUpload,
    refetchInterval: 30_000,
  });
  const documents = useQuery({
    queryKey: [
      "dossier-documents",
      organizationId,
      dossierId,
      year,
      month,
      category,
    ],
    queryFn: () =>
      api.get<AccountingDocument[]>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents?periodYear=${year}&periodMonth=${month}${category ? `&category=${category}` : ""}`,
      ),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((item) =>
        ["EN_ATTENTE", "EN_COURS"].includes(item.extractionStatus),
      )
        ? 10_000
        : false,
  });
  const expectations = useQuery({
    queryKey: ["missing-documents", organizationId, dossierId, year, month],
    queryFn: () =>
      api.get<MissingDocumentExpectation[]>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/missing/${year}/${month}`,
      ),
  });
  const preview = useQuery({
    queryKey: [
      "document-preview",
      organizationId,
      dossierId,
      previewTarget?.id,
    ],
    queryFn: async () => {
      const result = await api.get<DocumentPreview>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${previewTarget!.id}/preview`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["dossier-documents", organizationId, dossierId],
      });
      return result;
    },
    enabled: Boolean(previewTarget),
    retry: false,
  });
  const extractionReviews = useQuery({
    queryKey: ["document-extraction-reviews", organizationId, dossierId],
    queryFn: () =>
      api.get<DocumentExtractionReviewItem[]>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/extraction/review-queue`,
      ),
    enabled: canValidate,
    refetchInterval: 15_000,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["dossier-documents", organizationId, dossierId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["missing-documents", organizationId, dossierId],
    });
  };
  const upload = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Sélectionnez au moins un fichier.");
      if (files.some((item) => item.size > 20 * 1024 * 1024))
        throw new Error("Chaque fichier doit respecter la limite de 20 Mo.");
      if (expectationId && files.length > 1)
        throw new Error(
          "Une demande de pièce précise ne peut être associée qu’à un seul fichier.",
        );
      const results: AccountingDocument[] = [];
      for (const file of files) {
        const data = new FormData();
        data.append("file", file);
        data.append("category", uploadCategory);
        data.append("periodYear", String(year));
        data.append("periodMonth", String(month));
        data.append("isClientVisible", String(shareWithClient));
        const result = await api.upload<AccountingDocument>(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents`,
          data,
        );
        results.push(result);
        if (scanIntent) {
          await api.post(
            `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${result.id}/extraction`,
          );
        }
      }
      if (expectationId)
        await api.patch(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/missing/${expectationId}/receive/${results[0].id}`,
        );
      return results;
    },
    onSuccess: async () => {
      setUploadOpen(false);
      setFiles([]);
      setExpectationId("");
      setScanIntent(null);
      setError("");
      await refresh();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError || reason instanceof Error
          ? reason.message
          : "Téléversement impossible.",
      ),
  });
  useEffect(() => {
    const requestedScan = searchParams.get("scan");
    if (
      !canUpload ||
      !canValidate ||
      archived ||
      (requestedScan !== "invoice" && requestedScan !== "bank")
    )
      return;
    setScanIntent(requestedScan);
    setUploadCategory(
      requestedScan === "bank" ? "RELEVES_BANCAIRES" : "FACTURES_ACHATS",
    );
    setFiles([]);
    setUploadOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("scan");
    setSearchParams(next, { replace: true });
  }, [archived, canUpload, canValidate, searchParams, setSearchParams]);
  const requestExtraction = useMutation({
    mutationFn: (documentId: string) =>
      api.post(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${documentId}/extraction`,
      ),
    onSuccess: async () => {
      setReviewTarget(null);
      setError("");
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({
          queryKey: ["document-extraction-reviews", organizationId, dossierId],
        }),
      ]);
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Impossible de démarrer l’extraction.",
      ),
  });
  const action = useMutation({
    mutationFn: async ({
      type,
      document,
      id,
      documentId,
      recipientEmail,
    }: {
      type: string;
      document?: AccountingDocument;
      id?: string;
      documentId?: string;
      recipientEmail?: string;
    }) => {
      if (type === "delete" && document)
        return api.delete(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${document.id}`,
        );
      if (type === "processed" && document)
        return api.patch(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${document.id}`,
          {
            category: document.category,
            periodYear: document.periodYear,
            periodMonth: document.periodMonth,
            processingStatus: "TRAITE",
            extractionStatus: document.extractionStatus,
          },
        );
      if (type === "expectation")
        return api.post(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/missing`,
          {
            periodYear: year,
            periodMonth: month,
            label: expectationLabel.trim(),
            category: expectationCategory,
            dueOn: expectationDueOn || null,
            message: expectationMessage.trim() || null,
            recipientEmail: expectationRecipientEmail.trim() || null,
          },
        );
      if (type === "resend" && id)
        return api.post(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/missing/${id}/resend`,
          {
            recipientEmail: recipientEmail?.trim() || undefined,
          },
        );
      if (type === "receive" && id && documentId)
        return api.patch(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/missing/${id}/receive/${documentId}`,
        );
      if (type === "validate" && id)
        return api.patch(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/missing/${id}/validate`,
        );
      if (type === "reject" && id)
        return api.patch(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/missing/${id}/reject`,
          { reason: rejectReason.trim() },
        );
      if (type === "cancel" && id)
        return api.patch(
          `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/missing/${id}/cancel`,
        );
    },
    onSuccess: async (_, variables) => {
      if (variables.type === "delete") setDeleteTarget(null);
      if (variables.type === "expectation") {
        setExpectationOpen(false);
        setExpectationLabel("");
        setExpectationDueOn("");
        setExpectationMessage("");
        setExpectationRecipientEmail("");
      }
      if (variables.type === "reject") {
        setRejectTarget(null);
        setRejectReason("");
      }
      if (variables.type === "resend") {
        setResendTarget(null);
        setResendEmail("");
      }
      setError("");
      await refresh();
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError ? reason.message : "Action impossible.",
      ),
  });
  const classifyEmail = useMutation({
    mutationFn: (messageId: string) =>
      api.patch(
        `/api/organizations/${organizationId}/email-ingestion/${messageId}/classify`,
        { dossierId },
      ),
    onSuccess: async () => {
      setError("");
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({
          queryKey: ["unmatched-inbound-emails", organizationId],
        }),
      ]);
    },
    onError: (reason) =>
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Impossible de classer cet e-mail.",
      ),
  });
  const copyAddress = async (address?: string) => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    window.setTimeout(() => setCopiedAddress(""), 1800);
  };
  const download = async (document: AccountingDocument) => {
    try {
      const response = await api.get<{ url: string }>(
        `/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${document.id}/download`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["dossier-documents", organizationId, dossierId],
      });
      window.open(response.url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Téléchargement impossible.",
      );
    }
  };
  const missing =
    expectations.data?.filter(
      (entry) => !["VALIDEE", "ANNULEE"].includes(entry.status ?? "DEMANDEE"),
    ) ?? [];
  const openReview = (item: DocumentExtractionReviewItem) => {
    setReviewTarget(item);
    setError("");
  };
  const reviewByDocument = new Map(
    (extractionReviews.data ?? []).map((item) => [item.documentId, item]),
  );
  const receivedDocuments = documents.data ?? [];
  const clientDocumentCount = receivedDocuments.filter(
    (document) => document.uploadedBy?.type === "CLIENT",
  ).length;
  const reviewCount = extractionReviews.data?.length ?? 0;

  return (
    <>
      <Box className="documents-layout">
        <Card sx={{ gridColumn: "1 / -1", p: 2.5 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography variant="h3">Collecter et préparer les pièces</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Retrouvez ce que le client a envoyé, vérifiez les données lues
                par l’IA, puis classez la pièce lorsqu’elle est prête.
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Chip
                icon={<PersonOutlineRounded />}
                label={`${clientDocumentCount} reçu(s) du client`}
                variant="outlined"
                color={clientDocumentCount ? "info" : "default"}
              />
              <Chip
                icon={<AutoAwesomeRounded />}
                label={`${reviewCount} à vérifier`}
                variant="outlined"
                color={reviewCount ? "warning" : "success"}
              />
              <Chip
                label={`${missing.length} demande(s) ouverte(s)`}
                variant="outlined"
                color={missing.length ? "warning" : "default"}
              />
            </Box>
          </Box>
          <Box
            sx={{
              mt: 2.5,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {[
              ["1", "Recevoir", "Client ou cabinet dépose une pièce"],
              ["2", "Vérifier", "Contrôler les valeurs proposées par l’IA"],
              ["3", "Classer", "La pièce devient prête pour le traitement comptable"],
            ].map(([number, title, description], index) => (
              <Box
                key={number}
                sx={{
                  p: 2,
                  display: "flex",
                  gap: 1.5,
                  borderLeft: { md: index ? "1px solid" : 0 },
                  borderTop: { xs: index ? "1px solid" : 0, md: 0 },
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    flex: "0 0 auto",
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {number}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {description}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Card>
        {canUpload && (
          <Card sx={{ gridColumn: "1 / -1", p: 2.5 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              <Box sx={{ maxWidth: 720 }}>
                <Typography variant="h3">Recevoir les factures par e-mail</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Votre Gmail conserve le message. Une copie transférée à Fiscora
                  est contrôlée, puis rattachée au bon dossier lorsque
                  l’expéditeur correspond à un contact client unique.
                </Typography>
              </Box>
              <Chip
                icon={<EmailOutlined />}
                label={`${unmatchedEmails.data?.length ?? 0} e-mail(s) à classer`}
                color={unmatchedEmails.data?.length ? "warning" : "success"}
                variant="outlined"
              />
            </Box>
            <Box
              sx={{
                mt: 2,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              {[
                {
                  title: "Transfert automatique depuis le Gmail du cabinet",
                  description:
                    "Ajoutez cette adresse comme destination de transfert dans Gmail. Fiscora reconnaît le client grâce à son adresse d’expéditeur.",
                  address: organization.data?.emailIngestionAddress,
                },
                {
                  title: "Adresse dédiée à ce dossier",
                  description:
                    "Donnez cette adresse au client lorsqu’il faut garantir le classement dans ce dossier, même si son adresse d’expéditeur change.",
                  address: dossier.data?.emailIngestionAddress,
                },
              ].map((item) => (
                <Box
                  key={item.title}
                  sx={{
                    p: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    bgcolor: "background.default",
                  }}
                >
                  <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.description}
                  </Typography>
                  <Box
                    sx={{
                      mt: 1.5,
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      minWidth: 0,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        flex: 1,
                        fontFamily: "monospace",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {item.address ?? "Configuration en cours"}
                    </Typography>
                    <Tooltip
                      title={
                        copiedAddress === item.address ? "Adresse copiée" : "Copier"
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          disabled={!item.address}
                          onClick={() => void copyAddress(item.address)}
                        >
                          <ContentCopyRounded fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              ))}
            </Box>
            {unmatchedEmails.isError && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                La file des e-mails à classer ne peut pas être chargée.
              </Alert>
            )}
            {!!unmatchedEmails.data?.length && (
              <Box sx={{ mt: 2.5 }}>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>
                  E-mails dont le dossier n’a pas été reconnu
                </Typography>
                {unmatchedEmails.data.map((message) => (
                  <Box
                    key={message.id}
                    sx={{
                      py: 1.5,
                      display: "flex",
                      gap: 1.5,
                      alignItems: "center",
                      flexWrap: "wrap",
                      borderTop: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <EmailOutlined color="action" />
                    <Box sx={{ flex: 1, minWidth: 220 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {message.senderName || message.senderEmail}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {message.subject || "Sans objet"} · {message.attachmentCount}{" "}
                        pièce(s) · {formatDateTime(message.receivedAtUtc)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="warning.main"
                        sx={{ display: "block" }}
                      >
                        {message.routingReason}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={classifyEmail.isPending || archived}
                      onClick={() => classifyEmail.mutate(message.id)}
                    >
                      Classer dans ce dossier
                    </Button>
                  </Box>
                ))}
              </Box>
            )}
          </Card>
        )}
        {canValidate && (
          <Card sx={{ gridColumn: "1 / -1" }}>
            <Box
              sx={{
                p: 2.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              <Box>
                <Typography variant="h3">À vérifier avant comptabilisation</Typography>
                <Typography variant="body2" color="text.secondary">
                  Comparez la pièce originale avec les valeurs lues par l’IA.
                  Rien n’est validé sans votre accord.
                </Typography>
              </Box>
              <Chip
                label={`${extractionReviews.data?.length ?? 0} à contrôler`}
                color={extractionReviews.data?.length ? "warning" : "success"}
                variant="outlined"
              />
            </Box>
            {extractionReviews.isLoading && (
              <Box sx={{ px: 2.5, pb: 2.5 }}>
                <Skeleton height={58} />
              </Box>
            )}
            {extractionReviews.isError && (
              <Alert severity="error" sx={{ mx: 2.5, mb: 2.5 }}>
                Impossible de charger la file de contrôle.
              </Alert>
            )}
            {!extractionReviews.isLoading &&
              !extractionReviews.isError &&
              !extractionReviews.data?.length && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ px: 2.5, pb: 2.5 }}
                >
                  Aucune extraction en attente. Les nouvelles propositions
                  apparaîtront ici automatiquement.
                </Typography>
              )}
            {extractionReviews.data?.map((item) => (
              <Box
                key={item.id}
                sx={{
                  px: 2.5,
                  py: 1.75,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <InsertDriveFileOutlined color="primary" />
                <Box sx={{ flex: 1, minWidth: 220 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {item.document.originalName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {documentCategoryLabel(item.document.category)} ·{" "}
                    {item.modelName ?? "NuExtract3"} · tentative {item.attemptCount}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color={
                    item.validationIssues.some(
                      (issue) => issue.severity === "ERROR",
                    )
                      ? "error"
                      : item.validationIssues.length
                        ? "warning"
                        : "success"
                  }
                  label={
                    item.validationIssues.length
                      ? `${item.validationIssues.length} point(s) à examiner`
                      : "Calculs cohérents — lecture à confirmer"
                  }
                  variant="outlined"
                />
                <Button variant="contained" onClick={() => openReview(item)}>
                  Vérifier les données
                </Button>
              </Box>
            ))}
          </Card>
        )}
        <Card>
          <Box
            sx={{
              p: 2.5,
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography variant="h3">Documents reçus</Typography>
              <Typography variant="body2" color="text.secondary">
                Tous les fichiers déposés par le client ou ajoutés par le cabinet.
              </Typography>
            </Box>
            {canUpload && !archived && (
              <Button
                variant="contained"
                startIcon={<UploadFileRounded />}
                onClick={() => {
                  setUploadOpen(true);
                  setError("");
                }}
              >
                Déposer un document
              </Button>
            )}
          </Box>
          <Box
            sx={{
              px: 2.5,
              pb: 2,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr 1fr",
                sm: "120px 140px minmax(180px, 1fr)",
              },
              gap: 1.5,
            }}
          >
            <TextField
              select
              size="small"
              label="Année"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Mois"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map(
                (value) => (
                  <MenuItem key={value} value={value}>
                    {String(value).padStart(2, "0")}
                  </MenuItem>
                ),
              )}
            </TextField>
            <TextField
              select
              size="small"
              label="Catégorie"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              sx={{ gridColumn: { xs: "span 2", sm: "auto" } }}
            >
              <MenuItem value="">Toutes</MenuItem>
              {documentCategories.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          {error && (
            <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>
              {error}
            </Alert>
          )}
          {documents.isLoading && (
            <Box sx={{ p: 2.5 }}>
              <Skeleton height={70} />
              <Skeleton height={70} />
            </Box>
          )}
          {documents.isError && (
            <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>
              Impossible de charger les documents.
            </Alert>
          )}
          {!documents.isLoading && !documents.data?.length && (
            <Box sx={{ p: 6, textAlign: "center" }}>
              <InsertDriveFileOutlined
                sx={{ fontSize: 44, color: "text.disabled" }}
              />
              <Typography sx={{ fontWeight: 700, mt: 1 }}>
                Aucun document pour cette période
              </Typography>
            </Box>
          )}
          {documents.data?.map((document) => (
            <Box
              key={document.id}
              sx={{
                px: 3,
                py: 2,
                borderTop: "1px solid",
                borderColor: "divider",
                display: "flex",
                gap: 2,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2.5,
                  bgcolor: "primary.light",
                  color: "primary.main",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <InsertDriveFileOutlined />
              </Box>
              <Box sx={{ flex: "1 1 300px", minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {document.originalName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {documentCategoryLabel(document.category)} ·{" "}
                  {fileSize(document.sizeBytes)} · version {document.version} · reçu le{" "}
                  {formatDateTime(document.createdAtUtc)}
                </Typography>
                <Box
                  sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
                >
                  <Chip
                    icon={documentOrigin(document).icon}
                    label={documentOrigin(document).label}
                    color={documentOrigin(document).color}
                    size="small"
                    variant="outlined"
                  />
                  <Typography variant="caption" color="text.secondary">
                    par {documentOrigin(document).detail}
                  </Typography>
                </Box>
              </Box>
              <Box
                sx={{
                  flex: "1 1 260px",
                  display: "flex",
                  gap: 0.75,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <Chip
                  label={
                    document.processingStatus === "TRAITE"
                      ? "Dossier classé"
                      : "Classement à terminer"
                  }
                  color={
                    document.processingStatus === "TRAITE" ? "success" : "warning"
                  }
                  size="small"
                  variant="outlined"
                />
                <Tooltip
                  title={
                    document.malwareScanStatus === "INFECTE"
                      ? `Menace détectée : ${document.malwareSignature ?? "signature inconnue"}`
                      : "Le fichier a été contrôlé avant son ouverture."
                  }
                >
                  <Chip
                    label={malwareStatus(document).label}
                    color={malwareStatus(document).color}
                    size="small"
                    variant="outlined"
                  />
                </Tooltip>
                <Chip
                  label={extractionStatus(document.extractionStatus).label}
                  color={extractionStatus(document.extractionStatus).color}
                  size="small"
                  variant="outlined"
                />
              </Box>
              <Box
                sx={{
                  flex: "0 1 auto",
                  display: "flex",
                  gap: 0.5,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {canValidate &&
                  !archived &&
                  document.malwareScanStatus === "SAIN" &&
                  ["image/jpeg", "image/png", "application/pdf"].includes(
                    document.mimeType,
                  ) &&
                  !["EN_ATTENTE", "EN_COURS", "A_REVOIR"].includes(
                    document.extractionStatus,
                  ) && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AutoAwesomeRounded />}
                      disabled={requestExtraction.isPending}
                      onClick={() => requestExtraction.mutate(document.id)}
                    >
                      Lire avec l’IA
                    </Button>
                  )}
                {canValidate && reviewByDocument.has(document.id) && (
                  <Button
                    size="small"
                    color="warning"
                    variant="contained"
                    onClick={() => openReview(reviewByDocument.get(document.id)!)}
                  >
                    Vérifier les données
                  </Button>
                )}
                {canCreateInvoice &&
                  !archived &&
                  document.extractionStatus === "VALIDEE" &&
                  hasInvoiceExtraction(document) && (
                    <Button
                      size="small"
                      color="primary"
                      variant="contained"
                      startIcon={<ReceiptLongOutlined />}
                      onClick={() => {
                        const target = new URLSearchParams({
                          dossierId,
                          sourceDocumentId: document.id,
                        });
                        navigate(`/factures?${target.toString()}`);
                      }}
                    >
                      Créer la facture
                    </Button>
                  )}
                {canUpload &&
                  !archived &&
                  document.processingStatus !== "TRAITE" && (
                    <Button
                      size="small"
                      variant="text"
                      color="success"
                      startIcon={<CheckCircleOutlineRounded />}
                      onClick={() =>
                        action.mutate({ type: "processed", document })
                      }
                    >
                      Terminer le classement
                    </Button>
                  )}
                <Tooltip title="Voir le document">
                  <IconButton
                    color="primary"
                    disabled={document.malwareScanStatus === "INFECTE"}
                    onClick={() => {
                      setPreviewSheet(0);
                      setPreviewTarget(document);
                    }}
                  >
                    <VisibilityOutlined />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Télécharger">
                  <IconButton
                    disabled={document.malwareScanStatus === "INFECTE"}
                    onClick={() => void download(document)}
                  >
                    <DownloadRounded />
                  </IconButton>
                </Tooltip>
                {canUpload && !archived && (
                  <Tooltip title="Supprimer">
                    <IconButton
                      color="error"
                      onClick={() => setDeleteTarget(document)}
                    >
                      <DeleteOutlineRounded />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          ))}
        </Card>
        <Card>
          <Box
            sx={{
              p: 2.5,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Box>
              <Typography variant="h3">Documents demandés au client</Typography>
              <Typography variant="body2" color="text.secondary">
                Suivi des pièces manquantes · {String(month).padStart(2, "0")}/{year}
              </Typography>
            </Box>
            {canUpload && !archived && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddRounded />}
                onClick={() => setExpectationOpen(true)}
              >
                Nouvelle demande
              </Button>
            )}
          </Box>
          {expectations.isLoading && (
            <Box sx={{ p: 2.5 }}>
              <Skeleton height={60} />
            </Box>
          )}
          {!expectations.isLoading && !expectations.data?.length && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ px: 2.5, pb: 3 }}
            >
              Aucune pièce n’a été demandée au client pour cette période.
            </Typography>
          )}
          {expectations.data?.map((entry) => (
            <Box
              key={entry.id}
              sx={{
                px: 2.5,
                py: 1.8,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {entry.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {documentCategoryLabel(entry.category)}
                    {entry.dueOn
                      ? ` · Échéance ${formatDate(entry.dueOn)}`
                      : ""}
                  </Typography>
                  {entry.message && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      {entry.message}
                    </Typography>
                  )}
                  {entry.rejectionReason && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ display: "block" }}
                    >
                      Correction demandée : {entry.rejectionReason}
                    </Typography>
                  )}
                  {entry.deliveryStatus === "ENVOYEE" &&
                    entry.recipientEmail && (
                      <Typography
                        variant="caption"
                        color="success.main"
                        sx={{ display: "block" }}
                      >
                        Lien sécurisé envoyé à {entry.recipientEmail}
                        {entry.publicTokenExpiresAtUtc
                          ? ` · expire le ${formatDateTime(entry.publicTokenExpiresAtUtc)}`
                          : ""}
                      </Typography>
                    )}
                  {entry.deliveryStatus === "PORTAIL" && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      Visible dans le portail du client assigné
                    </Typography>
                  )}
                  {entry.deliveryStatus === "ECHEC" && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ display: "block" }}
                    >
                      L’e-mail n’a pas été envoyé
                      {entry.deliveryError ? ` · ${entry.deliveryError}` : ""}
                    </Typography>
                  )}
                </Box>
                <Chip
                  label={entry.receivedDocumentId ? "Reçu" : "Manquant"}
                  size="small"
                  color={entry.receivedDocumentId ? "success" : "error"}
                  variant="outlined"
                />
              </Box>
              <Box sx={{ display: "flex", gap: 1, mt: 1.2, flexWrap: "wrap" }}>
                <Chip
                  label={requestStatus(entry).label}
                  size="small"
                  color={requestStatus(entry).color}
                  variant="outlined"
                />
                {canUpload &&
                  !archived &&
                  entry.receivedDocumentId &&
                  !["VALIDEE", "ANNULEE"].includes(entry.status ?? "") && (
                    <>
                      <Button
                        size="small"
                        color="success"
                        onClick={() =>
                          action.mutate({ type: "validate", id: entry.id })
                        }
                      >
                        Valider
                      </Button>
                      <Button
                        size="small"
                        color="warning"
                        onClick={() => setRejectTarget(entry)}
                      >
                        Demander correction
                      </Button>
                    </>
                  )}
                {canUpload &&
                  !archived &&
                  !["VALIDEE", "ANNULEE"].includes(entry.status ?? "") && (
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() =>
                        action.mutate({ type: "cancel", id: entry.id })
                      }
                    >
                      Annuler
                    </Button>
                  )}
                {canUpload &&
                  !archived &&
                  !entry.receivedDocumentId &&
                  !["VALIDEE", "ANNULEE"].includes(entry.status ?? "") && (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={action.isPending}
                      onClick={() => {
                        setResendTarget(entry);
                        setResendEmail(entry.recipientEmail ?? "");
                      }}
                    >
                      {entry.recipientEmail
                        ? "Renvoyer le lien"
                        : "Envoyer par e-mail"}
                    </Button>
                  )}
              </Box>
              {canUpload &&
              !archived &&
              !entry.receivedDocumentId &&
              !["VALIDEE", "ANNULEE"].includes(entry.status ?? "") &&
              documents.data?.length ? (
                <Box sx={{ display: "flex", gap: 1, mt: 1.2 }}>
                  <SearchableSelect
                    label="Document reçu"
                    size="small"
                    value={receiveSelections[entry.id] ?? ""}
                    onChange={(value) =>
                      setReceiveSelections({
                        ...receiveSelections,
                        [entry.id]: value,
                      })
                    }
                    options={documents.data.map((document) => ({
                      value: document.id,
                      label: document.originalName,
                    }))}
                    placeholder="Rechercher un document…"
                    sx={{ flex: 1 }}
                  />
                  <Button
                    size="small"
                    disabled={!receiveSelections[entry.id]}
                    onClick={() =>
                      action.mutate({
                        type: "receive",
                        id: entry.id,
                        documentId: receiveSelections[entry.id],
                      })
                    }
                  >
                    Lier
                  </Button>
                </Box>
              ) : null}
            </Box>
          ))}
        </Card>
      </Box>
      <Dialog
        open={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(null)}
        fullWidth
        maxWidth="xl"
        slotProps={{ paper: { sx: { height: { xs: "94vh", md: "88vh" } } } }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3" noWrap>
              Aperçu du document
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {previewTarget?.originalName}
            </Typography>
          </Box>
          {previewTarget && (
            <Button
              variant="outlined"
              startIcon={<DownloadRounded />}
              onClick={() => void download(previewTarget)}
            >
              Télécharger
            </Button>
          )}
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            p: { xs: 1.5, md: 2.5 },
            bgcolor: "grey.100",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {preview.isLoading && (
            <Box sx={{ p: 3 }}>
              <Skeleton height={48} />
              <Skeleton height={420} />
            </Box>
          )}
          {preview.isError && (
            <Alert severity="error">
              Impossible de générer l’aperçu. Vous pouvez toujours télécharger
              le document.
            </Alert>
          )}
          {preview.data?.kind === "image" && preview.data.url && (
            <Box
              component="img"
              src={preview.data.url}
              alt={preview.data.originalName}
              sx={{
                maxWidth: "100%",
                maxHeight: "100%",
                m: "auto",
                objectFit: "contain",
                bgcolor: "common.white",
                boxShadow: 2,
              }}
            />
          )}
          {preview.data?.kind === "pdf" && previewTarget && (
            <PdfDocumentViewer
              sourcePath={`/api/organizations/${organizationId}/dossiers/${dossierId}/documents/${previewTarget.id}/content`}
              originalName={preview.data.originalName}
              minHeight={500}
              maxHeight={760}
            />
          )}
          {preview.data?.kind === "text" && (
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2.5,
                overflow: "auto",
                flex: 1,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                bgcolor: "common.white",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                fontFamily: "monospace",
                fontSize: 13,
              }}
            >
              {preview.data.content}
              {preview.data.truncated
                ? "\n\n— Aperçu limité. Téléchargez le fichier pour voir la suite. —"
                : ""}
            </Box>
          )}
          {preview.data?.kind === "spreadsheet" && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                minHeight: 0,
                flex: 1,
              }}
            >
              <TextField
                select
                size="small"
                label="Feuille"
                value={previewSheet}
                onChange={(event) =>
                  setPreviewSheet(Number(event.target.value))
                }
                sx={{ width: { xs: "100%", sm: 280 }, bgcolor: "common.white" }}
              >
                {preview.data.sheets?.map((sheet, index) => (
                  <MenuItem key={`${sheet.name}-${index}`} value={index}>
                    {sheet.name}
                  </MenuItem>
                ))}
              </TextField>
              {preview.data.sheets?.[previewSheet]?.truncated && (
                <Alert severity="info">
                  L’aperçu est limité aux 250 premières lignes et 50 colonnes.
                </Alert>
              )}
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflow: "auto",
                  bgcolor: "common.white",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <Box
                  component="table"
                  sx={{
                    borderCollapse: "collapse",
                    minWidth: "100%",
                    width: "max-content",
                    "& td, & th": {
                      borderRight: "1px solid",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      px: 1.5,
                      py: 1,
                      maxWidth: 360,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 13,
                    },
                    "& th": {
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                    },
                  }}
                >
                  <thead>
                    <tr>
                      <th>#</th>
                      {Array.from({
                        length: Math.max(
                          0,
                          ...(preview.data.sheets?.[previewSheet]?.rows.map(
                            (row) => row.length,
                          ) ?? []),
                        ),
                      }).map((_, index) => (
                        <th key={index}>{index + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.data.sheets?.[previewSheet]?.rows.map(
                      (row, rowIndex) => (
                        <tr key={rowIndex}>
                          <td>{rowIndex + 1}</td>
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              title={cell == null ? "" : String(cell)}
                            >
                              {cell == null ? "" : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ),
                    )}
                  </tbody>
                </Box>
              </Box>
            </Box>
          )}
          {preview.data?.kind === "unsupported" && (
            <Alert severity="info">{preview.data.message}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewTarget(null)}>Fermer</Button>
        </DialogActions>
      </Dialog>
      {reviewTarget && (
        <DocumentExtractionReviewDialog
          key={`${organizationId}:${dossierId}:${reviewTarget.id}`}
          organizationId={organizationId}
          dossierId={dossierId}
          target={reviewTarget}
          onClose={() => setReviewTarget(null)}
        />
      )}
      <Dialog
        open={uploadOpen}
        onClose={
          upload.isPending
            ? undefined
            : () => {
                setUploadOpen(false);
                setScanIntent(null);
              }
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {scanIntent === "invoice"
            ? "Scanner une facture avec l’IA"
            : scanIntent === "bank"
              ? "Scanner un relevé bancaire avec l’IA"
              : "Ajouter un document au dossier"}
        </DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Button
            component="label"
            variant="outlined"
            startIcon={<UploadFileRounded />}
          >
            {files.length
              ? `${files.length} fichier(s) sélectionné(s)`
              : scanIntent
                ? "Choisir une image ou un PDF"
                : "Choisir un ou plusieurs fichiers"}
            <input
              hidden
              type="file"
              multiple={!scanIntent}
              accept={
                scanIntent
                  ? ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  : accepted
              }
              onChange={(event) =>
                setFiles(Array.from(event.target.files ?? []))
              }
            />
          </Button>
          {files.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {files.map((item) => item.name).join(" · ")}
            </Typography>
          )}
          <TextField
            select
            label="Catégorie"
            value={uploadCategory}
            onChange={(event) => setUploadCategory(event.target.value)}
          >
            {documentCategories.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          {missing.length > 0 && (
            <SearchableSelect
              label="Document attendu correspondant"
              value={expectationId}
              onChange={setExpectationId}
              options={[
                { value: "", label: "Aucun" },
                ...missing.map((entry) => ({
                  value: entry.id,
                  label: entry.label,
                })),
              ]}
              placeholder="Rechercher une demande…"
            />
          )}
          <FormControlLabel
            control={
              <Switch
                checked={shareWithClient}
                onChange={(_, checked) => setShareWithClient(checked)}
              />
            }
            label="Rendre ce document visible dans le portail client"
          />
          <Typography variant="caption" color="text.secondary">
            {scanIntent
              ? "La pièce sera ajoutée au dossier puis envoyée immédiatement à l’extraction IA. Les PDF sont traités page par page et une validation humaine reste obligatoire."
              : "PDF, images, Excel, XML ou CSV · 20 Mo maximum."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setUploadOpen(false);
              setScanIntent(null);
            }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={() => upload.mutate()}
            disabled={!files.length || upload.isPending}
          >
            {upload.isPending
              ? scanIntent
                ? "Envoi à l’IA…"
                : "Ajout…"
              : scanIntent
                ? "Scanner avec l’IA"
                : "Ajouter au dossier"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={expectationOpen}
        onClose={() => setExpectationOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Demander une pièce au client</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
          <TextField
            label="Libellé"
            value={expectationLabel}
            onChange={(event) => setExpectationLabel(event.target.value)}
            placeholder="Ex. Relevé bancaire BIAT"
          />
          <TextField
            select
            label="Catégorie"
            value={expectationCategory}
            onChange={(event) => setExpectationCategory(event.target.value)}
          >
            {documentCategories.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label="Échéance souhaitée"
            value={expectationDueOn}
            onChange={(event) => setExpectationDueOn(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Message au client"
            value={expectationMessage}
            onChange={(event) => setExpectationMessage(event.target.value)}
            placeholder="Ex. Merci de déposer le relevé complet avec toutes les pages."
            multiline
            minRows={3}
          />
          <TextField
            type="email"
            label="E-mail du destinataire"
            value={expectationRecipientEmail}
            onChange={(event) =>
              setExpectationRecipientEmail(event.target.value)
            }
            placeholder="client@exemple.com"
            helperText="Sans compte Fiscora : un lien sécurisé valable 7 jours sera envoyé. Laissez vide seulement si un utilisateur du portail est déjà assigné à ce dossier."
          />
          <Alert severity="info">
            Le client n’a pas besoin de créer un compte. Le lien ne permet de
            déposer qu’un seul fichier pour cette demande.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpectationOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!expectationLabel.trim()}
            onClick={() => action.mutate({ type: "expectation" })}
          >
            Envoyer la demande
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(resendTarget)}
        onClose={() => setResendTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {resendTarget?.recipientEmail
            ? "Renvoyer un nouveau lien"
            : "Envoyer la demande par e-mail"}
        </DialogTitle>
        <DialogContent sx={{ pt: "12px !important" }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            L’ancien lien sera remplacé. Le nouveau lien expirera dans 7 jours
            et acceptera un seul fichier.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            type="email"
            label="E-mail du destinataire"
            value={resendEmail}
            onChange={(event) => setResendEmail(event.target.value)}
            placeholder="client@exemple.com"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResendTarget(null)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!resendEmail.trim() || action.isPending}
            onClick={() =>
              action.mutate({
                type: "resend",
                id: resendTarget?.id,
                recipientEmail: resendEmail,
              })
            }
          >
            Envoyer
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Demander une correction</DialogTitle>
        <DialogContent sx={{ pt: "12px !important" }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Le client verra la raison et pourra redéposer la bonne pièce.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Raison de la correction"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Ex. Le relevé bancaire est incomplet, il manque la dernière page."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectTarget(null)}>Annuler</Button>
          <Button
            color="warning"
            variant="contained"
            disabled={!rejectReason.trim() || action.isPending}
            onClick={() =>
              rejectTarget &&
              action.mutate({ type: "reject", id: rejectTarget.id })
            }
          >
            Demander correction
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Supprimer ce document ?</DialogTitle>
        <DialogContent>
          <Typography>{deleteTarget?.originalName}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Annuler</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() =>
              deleteTarget &&
              action.mutate({ type: "delete", document: deleteTarget })
            }
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
