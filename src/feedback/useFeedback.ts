import { useContext } from "react";
import { FeedbackContext } from "./feedback-context";

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context)
    throw new Error("useFeedback doit être utilisé dans FeedbackProvider.");
  return context;
}
