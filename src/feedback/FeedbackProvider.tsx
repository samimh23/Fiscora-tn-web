import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Alert, Snackbar } from "@mui/material";
import {
  FeedbackContext,
  type FeedbackSeverity,
} from "./feedback-context";

interface FeedbackState {
  message: string;
  severity: FeedbackSeverity;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const showFeedback = useCallback(
    (message: string, severity: FeedbackSeverity = "success") =>
      setFeedback({ message, severity }),
    [],
  );
  const value = useMemo(() => ({ showFeedback }), [showFeedback]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(feedback)}
        autoHideDuration={5000}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        onClose={(_, reason) => {
          if (reason !== "clickaway") setFeedback(null);
        }}
      >
        <Alert
          severity={feedback?.severity ?? "success"}
          variant="filled"
          onClose={() => setFeedback(null)}
          sx={{ minWidth: { xs: 280, sm: 360 }, boxShadow: 4 }}
        >
          {feedback?.message}
        </Alert>
      </Snackbar>
    </FeedbackContext.Provider>
  );
}
