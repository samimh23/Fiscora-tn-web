import { api } from "../../api/client";

export interface AssistantCitation {
  label: string;
  chunkId: string;
  sourceId: string;
  sourceName: string;
  pageNumber: number | null;
  kind?:
    | "DOCUMENT"
    | "BUSINESS_INVOICE"
    | "PRODUCT_HELP"
    | "PAYMENT"
    | "FINANCIAL_REPORT"
    | "PARTY_BALANCE";
  path?: string;
  excerpt?: string;
  pages?: number[];
}

export interface AssistantFeedback {
  rating: 1 | -1;
  comment: string | null;
}

export interface AssistantAction {
  label: string;
  path: string;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: AssistantCitation[];
  actions?: AssistantAction[];
  scope?: string;
  model?: string;
  status?: "failed" | "stopped";
  error?: string;
  /** Server id of the stored answer, used to rate it. */
  turnId?: string;
  feedback?: AssistantFeedback | null;
}

interface AssistantHistoryTurn {
  id: string;
  createdAtUtc: string;
  question: string;
  answer: string;
  citations: AssistantCitation[];
  actions?: AssistantAction[];
  scope?: string;
  model?: string;
  feedback?: AssistantFeedback | null;
}

export interface AssistantHistoryCursor {
  beforeCreatedAt: string;
  beforeId: string;
}

export interface AssistantHistoryPage {
  items: AssistantHistoryTurn[];
  nextCursor: AssistantHistoryCursor | null;
}

export function conversationStorageKey(
  organizationId: string,
  dossierId: string,
  userId: string,
) {
  return `fiscora.assistant.startedAt.${organizationId}.${dossierId}.${userId}`;
}

export function readConversationStartedAt(key: string) {
  return window.sessionStorage.getItem(key) ?? "";
}

export function startNewConversation(key: string) {
  const startedAt = new Date().toISOString();
  window.sessionStorage.setItem(key, startedAt);
  return startedAt;
}

export function turnsToMessages(
  turns: AssistantHistoryTurn[],
): AssistantMessage[] {
  return turns.flatMap((turn) => [
    {
      id: `${turn.id}:user`,
      role: "user" as const,
      text: turn.question,
    },
    {
      id: `${turn.id}:assistant`,
      role: "assistant" as const,
      text: turn.answer,
      citations: turn.citations,
      actions: turn.actions,
      scope:
        turn.scope ??
        (turn.citations.some((c) => c.kind === "PRODUCT_HELP")
          ? "PRODUCT_HELP"
          : undefined),
      model: turn.model,
      turnId: turn.id,
      feedback: turn.feedback ?? null,
    },
  ]);
}

export function fetchAssistantHistory(
  organizationId: string,
  dossierId: string,
  startedAt: string,
  cursor?: AssistantHistoryCursor | null,
) {
  const params = new URLSearchParams({ limit: "20" });
  if (startedAt) params.set("after", startedAt);
  if (cursor) {
    params.set("beforeCreatedAt", cursor.beforeCreatedAt);
    params.set("beforeId", cursor.beforeId);
  }
  return api.get<AssistantHistoryPage>(
    `/api/organizations/${organizationId}/dossiers/${dossierId}/assistant/history?${params.toString()}`,
  );
}

/** Rates one of my own answers: 1 = useful, -1 = wrong, 0 = remove. */
export function sendAssistantFeedback(
  organizationId: string,
  turnId: string,
  rating: 1 | -1 | 0,
  comment?: string,
) {
  return api.post<{ id: string; feedback: AssistantFeedback | null }>(
    `/api/organizations/${organizationId}/assistant/turns/${turnId}/feedback`,
    { rating, ...(comment ? { comment } : {}) },
  );
}

/** Labels such as "S4" that the answer text actually cites. */
export function citedLabels(text: string) {
  return new Set([...text.matchAll(/\[(S\d+)\]/g)].map((match) => match[1]));
}
