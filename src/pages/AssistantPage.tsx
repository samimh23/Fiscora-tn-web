import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AutoAwesomeOutlined,
  ContentCopyRounded,
  DescriptionOutlined,
  RestartAltRounded,
  SendRounded,
  ShieldOutlined,
  SyncRounded,
} from "@mui/icons-material";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { DossierSelector } from "../components/WorkspaceTools";
import { useDossierSelection } from "../hooks/useDossierSelection";

interface AssistantCitation {
  label: string;
  chunkId: string;
  sourceId: string;
  sourceName: string;
  pageNumber: number | null;
}

interface AssistantAnswer {
  id: string;
  answer: string;
  citations: AssistantCitation[];
  model: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: AssistantCitation[];
}

const suggestions = [
  "Quel est le total TTC des factures validées ?",
  "Quels fournisseurs apparaissent dans les pièces ?",
  "Résume les montants de TVA présents dans les documents.",
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function AssistantPage() {
  const { organization } = useAuth();
  const organizationId = organization?.id ?? "";
  const [dossierId, setDossierId] = useDossierSelection();
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [indexStatus, setIndexStatus] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const endpoint = `/api/organizations/${organizationId}/dossiers/${dossierId}/assistant`;

  useEffect(() => {
    setMessages([]);
    setError("");
    setIndexStatus("");
  }, [dossierId]);

  const reindex = useMutation({
    mutationFn: () =>
      api.post<{ documentsIndexed: number; chunksIndexed: number }>(
        `${endpoint}/reindex`,
      ),
    onSuccess: (result) => {
      setError("");
      setIndexStatus(
        `${result.documentsIndexed} document(s) validé(s), ${result.chunksIndexed} source(s) prête(s).`,
      );
    },
    onError: (reason) => {
      setIndexStatus("");
      setError(
        errorMessage(reason, "Impossible d’actualiser les sources du dossier."),
      );
    },
  });

  const ask = useMutation({
    mutationFn: (text: string) =>
      api.post<AssistantAnswer>(`${endpoint}/ask`, { question: text }),
    onSuccess: (result) => {
      setError("");
      setMessages((current) => [
        ...current,
        {
          id: result.id,
          role: "assistant",
          text: result.answer,
          citations: result.citations,
        },
      ]);
    },
    onError: (reason) =>
      setError(
        errorMessage(
          reason,
          "L’assistant n’a pas pu répondre. Réessayez dans un instant.",
        ),
      ),
  });

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, ask.isPending]);

  const send = (text = question) => {
    const clean = text.trim();
    if (!clean || !dossierId || ask.isPending) return;
    setError("");
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text: clean },
    ]);
    setQuestion("");
    ask.mutate(clean);
  };

  const copyAnswer = async (message: ChatMessage) => {
    await navigator.clipboard.writeText(message.text);
    setCopiedMessageId(message.id);
    window.setTimeout(() => setCopiedMessageId(""), 1500);
  };

  return (
    <>
      <PageHeader
        eyebrow="Dossier client"
        title="Assistant Fiscora"
        description="Interrogez uniquement les données extraites puis validées par le cabinet. Chaque réponse indique les pièces utilisées."
        action={<DossierSelector value={dossierId} onChange={setDossierId} />}
      />

      <Stack
        direction="row"
        sx={{ mb: 2, gap: 1, alignItems: "center", flexWrap: "wrap" }}
      >
        <Chip
          icon={<ShieldOutlined />}
          label="Sources validées uniquement"
          color="success"
          variant="outlined"
        />
        <Chip label="Réponses avec citations" variant="outlined" />
        <Box sx={{ flex: 1 }} />
        {messages.length > 0 && (
          <Button
            size="small"
            color="inherit"
            startIcon={<RestartAltRounded />}
            onClick={() => {
              setMessages([]);
              setError("");
            }}
          >
            Nouvelle conversation
          </Button>
        )}
      </Stack>

      {!dossierId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Choisissez un dossier client pour ouvrir son assistant.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1fr) 320px" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <Card>
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            <Box
              aria-live="polite"
              sx={{
                minHeight: 430,
                maxHeight: "calc(100vh - 360px)",
                overflowY: "auto",
                p: { xs: 2, sm: 2.5 },
              }}
            >
              {!messages.length ? (
                <Stack
                  spacing={2.5}
                  sx={{
                    minHeight: 370,
                    textAlign: "center",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Avatar
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: "primary.light",
                      color: "primary.dark",
                    }}
                  >
                    <AutoAwesomeOutlined />
                  </Avatar>
                  <Box>
                    <Typography variant="h3">
                      Commencez par une question
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5, maxWidth: 540 }}
                    >
                      L’assistant ne consulte que les pièces validées du dossier
                      sélectionné. Il ne crée aucune écriture comptable.
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    sx={{ gap: 1, flexWrap: "wrap", justifyContent: "center" }}
                  >
                    {suggestions.map((suggestion) => (
                      <Chip
                        key={suggestion}
                        label={suggestion}
                        variant="outlined"
                        onClick={() => send(suggestion)}
                        disabled={!dossierId || ask.isPending}
                        sx={{ height: "auto", py: 0.5, maxWidth: "100%" }}
                      />
                    ))}
                  </Stack>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  {messages.map((message) => (
                    <Box
                      key={message.id}
                      sx={{
                        display: "flex",
                        justifyContent:
                          message.role === "user" ? "flex-end" : "flex-start",
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: { xs: "92%", sm: "78%" },
                          bgcolor:
                            message.role === "user"
                              ? "primary.main"
                              : "grey.50",
                          color:
                            message.role === "user"
                              ? "primary.contrastText"
                              : "text.primary",
                          border: "1px solid",
                          borderColor:
                            message.role === "user"
                              ? "primary.main"
                              : "divider",
                          borderRadius: 2,
                          px: 2,
                          py: 1.5,
                        }}
                      >
                        <Typography sx={{ whiteSpace: "pre-wrap" }}>
                          {message.text}
                        </Typography>
                        {message.citations?.length ? (
                          <Stack
                            direction="row"
                            sx={{ mt: 1.5, gap: 0.75, flexWrap: "wrap" }}
                          >
                            {message.citations.map((citation) => (
                              <Chip
                                key={citation.chunkId}
                                size="small"
                                icon={<DescriptionOutlined />}
                                label={`[${citation.label}] ${citation.sourceName}`}
                                variant="outlined"
                                sx={{ bgcolor: "background.paper" }}
                              />
                            ))}
                          </Stack>
                        ) : null}
                        {message.role === "assistant" && (
                          <Tooltip
                            title={
                              copiedMessageId === message.id
                                ? "Réponse copiée"
                                : "Copier la réponse"
                            }
                          >
                            <IconButton
                              size="small"
                              aria-label="Copier la réponse"
                              onClick={() => void copyAnswer(message)}
                              sx={{ mt: 1, ml: -0.5 }}
                            >
                              <ContentCopyRounded fontSize="inherit" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                  ))}
                  {ask.isPending && (
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center" }}
                    >
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">
                        Recherche dans les pièces validées…
                      </Typography>
                    </Stack>
                  )}
                  <div ref={conversationEndRef} />
                </Stack>
              )}
            </Box>
            <Divider />
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              sx={{ p: 2, alignItems: "flex-end" }}
            >
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={5}
                label="Votre question"
                placeholder="Ex. Quel est le total TTC des factures de septembre ?"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                disabled={!dossierId || ask.isPending}
                helperText="Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne"
              />
              <Button
                variant="contained"
                endIcon={
                  ask.isPending ? (
                    <CircularProgress size={16} />
                  ) : (
                    <SendRounded />
                  )
                }
                onClick={() => send()}
                disabled={!question.trim() || !dossierId || ask.isPending}
                sx={{ minWidth: 120, mb: { sm: 3 } }}
              >
                Envoyer
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <DescriptionOutlined color="primary" />
                  <Typography variant="h4">Sources du dossier</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Actualisez après avoir approuvé de nouvelles extractions. Les
                  brouillons et pièces rejetées restent exclus.
                </Typography>
                {indexStatus && <Alert severity="success">{indexStatus}</Alert>}
                <Button
                  variant="outlined"
                  startIcon={
                    reindex.isPending ? (
                      <CircularProgress size={16} />
                    ) : (
                      <SyncRounded />
                    )
                  }
                  onClick={() => reindex.mutate()}
                  disabled={!dossierId || reindex.isPending}
                >
                  Actualiser les sources
                </Button>
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stack spacing={1.25}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <ShieldOutlined color="primary" />
                  <Typography variant="h4">Cadre de confiance</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Accès limité au dossier sélectionné, sources citées et
                  historique conservé pour audit.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Vérifiez toujours les pièces originales avant une décision
                  comptable, fiscale ou sociale.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </>
  );
}
