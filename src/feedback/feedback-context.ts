import { createContext } from "react";

export type FeedbackSeverity = "success" | "error" | "warning" | "info";

export interface FeedbackContextValue {
  showFeedback: (message: string, severity?: FeedbackSeverity) => void;
}

export const FeedbackContext = createContext<FeedbackContextValue | null>(null);
