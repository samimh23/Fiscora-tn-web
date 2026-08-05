import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  PauseRounded,
  PlayArrowRounded,
  StopRounded,
  TimerOutlined,
} from "@mui/icons-material";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { TimeEntry, WorkSession } from "../types/api";

interface StartSessionInput {
  dossierId: string;
  taskId?: string | null;
  description: string;
  billable?: boolean;
}

interface WorkSessionValue {
  session: WorkSession | null;
  loading: boolean;
  error: string;
  start: (input: StartSessionInput) => Promise<WorkSession>;
  stop: () => Promise<TimeEntry | null>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
}

const WorkSessionContext = createContext<WorkSessionValue | null>(null);

function message(reason: unknown) {
  return reason instanceof ApiError || reason instanceof Error
    ? reason.message
    : "Impossible de mettre à jour le suivi du temps.";
}

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remaining = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export function WorkSessionProvider({ children }: { children: ReactNode }) {
  const { organization, can } = useAuth();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<WorkSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const lastInteraction = useRef(Date.now());
  const manualPause = useRef(false);

  const activePath = organization?.id
    ? `/api/organizations/${organization.id}/work-sessions/active`
    : "";

  useEffect(() => {
    if (!activePath || !can("time_tracking.view")) {
      setSession(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<WorkSession | null>(activePath)
      .then((result) => {
        if (!cancelled) {
          setSession(result);
          setDisplaySeconds(result?.activeSeconds ?? 0);
          manualPause.current = result?.status === "EN_PAUSE";
        }
      })
      .catch((reason) => !cancelled && setError(message(reason)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activePath, can]);

  useEffect(() => {
    const markInteraction = () => {
      lastInteraction.current = Date.now();
    };
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    events.forEach((event) =>
      window.addEventListener(event, markInteraction, { passive: true }),
    );
    return () =>
      events.forEach((event) => window.removeEventListener(event, markInteraction));
  }, []);

  const heartbeat = useCallback(
    async (active: boolean) => {
      if (!organization?.id || !session) return;
      try {
        const next = await api.post<WorkSession>(
          `/api/organizations/${organization.id}/work-sessions/${session.id}/heartbeat`,
          { active },
        );
        setSession(next);
        setDisplaySeconds(next.activeSeconds);
        setError("");
      } catch (reason) {
        setError(message(reason));
        if (reason instanceof ApiError && reason.status === 404) setSession(null);
      }
    },
    [organization?.id, session],
  );

  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(() => {
      const active =
        !manualPause.current &&
        document.visibilityState === "visible" &&
        Date.now() - lastInteraction.current <= 120_000;
      void heartbeat(active);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [heartbeat, session]);

  useEffect(() => {
    if (!session || session.status !== "ACTIVE") return;
    const interval = window.setInterval(() => {
      if (
        !manualPause.current &&
        document.visibilityState === "visible" &&
        Date.now() - lastInteraction.current <= 120_000
      ) {
        setDisplaySeconds((value) => value + 1);
      }
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [session]);

  const start = useCallback(
    async (input: StartSessionInput) => {
      if (!organization?.id) throw new Error("Choisissez un cabinet.");
      setLoading(true);
      try {
        const next = await api.post<WorkSession>(
          `/api/organizations/${organization.id}/dossiers/${input.dossierId}/work-sessions/start`,
          {
            taskId: input.taskId ?? null,
            description: input.description,
            billable: input.billable ?? true,
          },
        );
        manualPause.current = false;
        lastInteraction.current = Date.now();
        setSession(next);
        setDisplaySeconds(next.activeSeconds);
        setError("");
        await queryClient.invalidateQueries({ queryKey: ["time-entries"] });
        return next;
      } catch (reason) {
        setError(message(reason));
        throw reason;
      } finally {
        setLoading(false);
      }
    },
    [organization?.id, queryClient],
  );

  const stop = useCallback(async () => {
    if (!organization?.id || !session) return null;
    setLoading(true);
    try {
      const result = await api.post<{
        session: WorkSession;
        timeEntry: TimeEntry | null;
      }>(
        `/api/organizations/${organization.id}/work-sessions/${session.id}/stop`,
      );
      setSession(null);
      setDisplaySeconds(0);
      manualPause.current = false;
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      return result.timeEntry;
    } catch (reason) {
      setError(message(reason));
      throw reason;
    } finally {
      setLoading(false);
    }
  }, [organization?.id, queryClient, session]);

  const pause = useCallback(async () => {
    manualPause.current = true;
    await heartbeat(false);
  }, [heartbeat]);

  const resume = useCallback(async () => {
    manualPause.current = false;
    lastInteraction.current = Date.now();
    await heartbeat(true);
  }, [heartbeat]);

  const value = useMemo<WorkSessionValue>(
    () => ({ session, loading, error, start, stop, pause, resume }),
    [error, loading, pause, resume, session, start, stop],
  );

  return (
    <WorkSessionContext.Provider value={value}>
      {children}
      {session && (
        <Paper
          elevation={8}
          sx={{
            position: "fixed",
            zIndex: 1400,
            insetInlineEnd: 24,
            bottom: 20,
            width: { xs: "calc(100% - 32px)", sm: 390 },
            p: 1.5,
            border: "1px solid",
            borderColor: session.status === "ACTIVE" ? "primary.main" : "warning.main",
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: session.status === "ACTIVE" ? "primary.main" : "warning.light",
                color: session.status === "ACTIVE" ? "white" : "warning.dark",
              }}
            >
              <TimerOutlined />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography sx={{ fontWeight: 800 }} noWrap>
                  {session.taskTitle || session.description}
                </Typography>
                <Chip
                  size="small"
                  label={session.status === "ACTIVE" ? "Actif" : "En pause"}
                  color={session.status === "ACTIVE" ? "success" : "warning"}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary" noWrap>
                {session.dossierName || "Dossier"} · {duration(displaySeconds)}
              </Typography>
            </Box>
            {loading ? (
              <CircularProgress size={24} />
            ) : session.status === "ACTIVE" ? (
              <Button
                size="small"
                onClick={() => void pause().catch(() => undefined)}
                startIcon={<PauseRounded />}
              >
                Pause
              </Button>
            ) : (
              <Button
                size="small"
                onClick={() => void resume().catch(() => undefined)}
                startIcon={<PlayArrowRounded />}
              >
                Reprendre
              </Button>
            )}
            <Button
              size="small"
              color="error"
              onClick={() => void stop().catch(() => undefined)}
              startIcon={<StopRounded />}
            >
              Arrêter
            </Button>
          </Stack>
          {error && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
              {error}
            </Typography>
          )}
        </Paper>
      )}
    </WorkSessionContext.Provider>
  );
}

export function useWorkSession() {
  const context = useContext(WorkSessionContext);
  if (!context)
    throw new Error("useWorkSession doit être utilisé dans WorkSessionProvider.");
  return context;
}
