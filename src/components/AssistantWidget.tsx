import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Fab,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AutoAwesomeOutlined,
  CloseRounded,
  DescriptionOutlined,
  LaunchRounded,
  SendRounded,
  SmartToyOutlined,
  SyncRounded,
} from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useOptionalWorkSession } from "../time-tracking/WorkSessionContext";
import type { DossierSummary, PagedResponse } from "../types/api";

interface WidgetCitation {
  chunkId: string;
  label: string;
  sourceName: string;
  kind?: "DOCUMENT" | "PRODUCT_HELP";
  path?: string;
}

interface WidgetAction {
  label: string;
  path: string;
}

interface WidgetAnswer {
  id: string;
  answer: string;
  citations: WidgetCitation[];
  actions?: WidgetAction[];
}

interface WidgetMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: WidgetCitation[];
  actions?: WidgetAction[];
}

function requestError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "L’assistant n’a pas pu répondre. Réessayez dans un instant.";
}

export function AssistantWidget() {
  const { organization, can } = useAuth();
  const workSession = useOptionalWorkSession()?.session ?? null;
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dossierId, setDossierId] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);
  const organizationId = organization?.id ?? "";
  const isClientPortal =
    organization?.role.toLocaleLowerCase("fr").includes("portail client") ??
    false;
  const storageKey = `fiscora.lastDossier.${organizationId || "none"}`;
  const pathDossierId = useMemo(
    () => location.pathname.match(/^\/dossiers\/([^/]+)/)?.[1] ?? "",
    [location.pathname],
  );

  const dossiers = useQuery({
    queryKey: ["dossier-options", organizationId, "assistant-widget"],
    queryFn: () =>
      api.get<PagedResponse<DossierSummary>>(
        `/api/organizations/${organizationId}/dossiers?page=1&pageSize=100`,
      ),
    enabled: Boolean(open && organizationId),
  });

  useEffect(() => {
    if (!open || dossierId || !dossiers.data?.items.length) return;
    const available = dossiers.data.items;
    const stored = window.sessionStorage.getItem(storageKey) ?? "";
    const preferred = [pathDossierId, stored].find((candidate) =>
      available.some((item) => item.id === candidate),
    );
    setDossierId(preferred ?? available[0].id);
  }, [dossierId, dossiers.data?.items, open, pathDossierId, storageKey]);

  useEffect(() => {
    setDossierId("");
    setMessages([]);
    setError("");
  }, [organizationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const accountingEndpoint = `/api/organizations/${organizationId}/dossiers/${dossierId}/assistant`;
  const ask = useMutation({
    mutationFn: (text: string) =>
      api.post<WidgetAnswer>(
        `/api/organizations/${organizationId}/assistant/ask`,
        {
          question: text,
          currentPath: `${location.pathname}${location.search}`,
          dossierId: dossierId || undefined,
        },
      ),
    onSuccess: (result) => {
      setError("");
      setMessages((current) => [
        ...current,
        {
          id: result.id,
          role: "assistant",
          text: result.answer,
          citations: result.citations,
          actions: result.actions,
        },
      ]);
    },
    onError: (reason) => setError(requestError(reason)),
  });

  const reindex = useMutation({
    mutationFn: () => api.post(`${accountingEndpoint}/reindex`),
    onSuccess: () => setError(""),
    onError: (reason) => setError(requestError(reason)),
  });

  const chooseDossier = (value: string) => {
    setDossierId(value);
    setMessages([]);
    setError("");
    window.sessionStorage.setItem(storageKey, value);
  };

  const send = () => {
    const clean = question.trim();
    if (!clean || !organizationId || ask.isPending) return;
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text: clean },
    ]);
    setQuestion("");
    setError("");
    ask.mutate(clean);
  };

  const launcherBottom = workSession ? 112 : 20;
  const panelBottom = workSession ? 178 : 88;

  return (
    <>
      {open && (
        <Paper
          role="dialog"
          aria-label="Assistant Fiscora"
          elevation={16}
          sx={{
            position: "fixed",
            zIndex: 1350,
            insetInlineEnd: { xs: 12, sm: 24 },
            bottom: panelBottom,
            width: { xs: "calc(100% - 24px)", sm: 390 },
            height: { xs: "min(640px, calc(100vh - 120px))", sm: 570 },
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ bgcolor: "#103f33", color: "white", p: 2 }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "rgba(255,255,255,.12)",
                }}
              >
                <AutoAwesomeOutlined />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800 }}>
                  Assistant Fiscora
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(255,255,255,.72)" }}
                >
                  Guide des pages et données validées
                </Typography>
              </Box>
              {!isClientPortal && (
                <Tooltip title="Ouvrir l’espace complet">
                  <IconButton
                    aria-label="Ouvrir l’assistant complet"
                    onClick={() =>
                      navigate(
                        `/assistant${dossierId ? `?dossierId=${dossierId}` : ""}`,
                      )
                    }
                    sx={{ color: "white" }}
                  >
                    <LaunchRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <IconButton
                aria-label="Fermer l’assistant"
                onClick={() => setOpen(false)}
                sx={{ color: "white" }}
              >
                <CloseRounded />
              </IconButton>
            </Stack>
          </Box>

          <Stack
            direction="row"
            spacing={1}
            sx={{ p: 1.5, alignItems: "center" }}
          >
            <FormControl size="small" fullWidth>
              <InputLabel>Dossier client</InputLabel>
              <Select
                value={dossierId}
                label="Dossier client"
                onChange={(event) => chooseDossier(event.target.value)}
              >
                {dossiers.data?.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.legalName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {can("documents.validate") && (
              <Tooltip title="Reconstruire l’index des sources">
                <span>
                  <IconButton
                    aria-label="Reconstruire l’index des sources"
                    onClick={() => reindex.mutate()}
                    disabled={!dossierId || reindex.isPending}
                  >
                    {reindex.isPending ? (
                      <CircularProgress size={20} />
                    ) : (
                      <SyncRounded />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>

          <Box
            aria-live="polite"
            sx={{ flex: 1, overflowY: "auto", px: 1.5, pb: 1.5 }}
          >
            {error && (
              <Alert
                severity="error"
                onClose={() => setError("")}
                sx={{ mb: 1.5 }}
              >
                {error}
              </Alert>
            )}
            {!messages.length ? (
              <Stack
                spacing={1.5}
                sx={{
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  px: 2,
                }}
              >
                <SmartToyOutlined
                  sx={{ fontSize: 42, color: "primary.main" }}
                />
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>
                    Comment puis-je vous aider ?
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    Demandez comment réaliser une tâche sur la page actuelle, ou
                    interrogez les pièces validées du dossier choisi.
                  </Typography>
                </Box>
              </Stack>
            ) : (
              <Stack spacing={1.25}>
                {messages.map((message) => (
                  <Box
                    key={message.id}
                    sx={{
                      alignSelf:
                        message.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "88%",
                      bgcolor:
                        message.role === "user" ? "primary.main" : "grey.100",
                      color:
                        message.role === "user"
                          ? "primary.contrastText"
                          : "text.primary",
                      borderRadius: 2,
                      px: 1.5,
                      py: 1.1,
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {message.text}
                    </Typography>
                    {message.citations?.length ? (
                      <Stack sx={{ mt: 1, gap: 0.5 }}>
                        {message.citations.slice(0, 3).map((citation) => (
                          <Chip
                            key={citation.chunkId}
                            size="small"
                            icon={<DescriptionOutlined />}
                            label={citation.sourceName}
                            variant="outlined"
                            onClick={
                              citation.kind === "PRODUCT_HELP" && citation.path
                                ? () => navigate(citation.path!)
                                : undefined
                            }
                            sx={{
                              bgcolor: "white",
                              justifyContent: "flex-start",
                            }}
                          />
                        ))}
                      </Stack>
                    ) : null}
                    {message.actions?.length ? (
                      <Stack
                        direction="row"
                        sx={{ mt: 1, gap: 0.75, flexWrap: "wrap" }}
                      >
                        {message.actions.map((action) => (
                          <Chip
                            key={`${message.id}-${action.path}`}
                            size="small"
                            icon={<LaunchRounded />}
                            label={action.label}
                            color="primary"
                            variant="outlined"
                            onClick={() => navigate(action.path)}
                            sx={{ bgcolor: "white" }}
                          />
                        ))}
                      </Stack>
                    ) : null}
                  </Box>
                ))}
                {ask.isPending && (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <CircularProgress size={16} />
                    <Typography variant="caption" color="text.secondary">
                      Recherche dans les guides et sources…
                    </Typography>
                  </Stack>
                )}
                <div ref={endRef} />
              </Stack>
            )}
          </Box>

          <Stack
            direction="row"
            spacing={1}
            sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider" }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="Posez votre question…"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              disabled={!organizationId || ask.isPending}
            />
            <IconButton
              color="primary"
              aria-label="Envoyer la question"
              onClick={send}
              disabled={!question.trim() || !organizationId || ask.isPending}
            >
              <SendRounded />
            </IconButton>
          </Stack>
        </Paper>
      )}

      <Tooltip
        title={
          open ? "Fermer l’Assistant Fiscora" : "Ouvrir l’Assistant Fiscora"
        }
      >
        <Fab
          color="primary"
          aria-label={
            open ? "Fermer l’Assistant Fiscora" : "Ouvrir l’Assistant Fiscora"
          }
          onClick={() => setOpen((current) => !current)}
          sx={{
            position: "fixed",
            zIndex: 1351,
            insetInlineEnd: { xs: 16, sm: 24 },
            bottom: launcherBottom,
            boxShadow: 8,
          }}
        >
          {open ? <CloseRounded /> : <SmartToyOutlined />}
        </Fab>
      </Tooltip>
    </>
  );
}
