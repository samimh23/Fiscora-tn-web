import type { AssistantCitation, AssistantMessage } from "./history";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function isDocumentCitation(citation: AssistantCitation) {
  return (
    uuid.test(citation.sourceId) &&
    (citation.kind === "DOCUMENT" ||
      (!citation.kind && uuid.test(citation.chunkId)))
  );
}
export function safeAssistantPath(path?: string) {
  return path &&
    /^\/(?!\/)/.test(path) &&
    !path.includes("\\") &&
    !Array.from(path).some((character) => character.charCodeAt(0) < 32)
    ? path
    : null;
}
export function assistantMode(
  message: Pick<AssistantMessage, "scope" | "model" | "citations">,
) {
  if (
    message.scope === "PRODUCT_HELP" ||
    message.citations?.some((c) => c.kind === "PRODUCT_HELP")
  )
    return "Guide Fiscora";
  if (
    message.scope === "LIVE_FINANCIAL" ||
    message.model === "live-financial-readonly-v1"
  )
    return "Données comptables actuelles · lecture seule";
  if (
    message.scope === "ACCOUNTING_CALCULATION" ||
    message.model === "deterministic-accounting-v1"
  )
    return "Calcul comptable déterministe";
  if (message.scope === "CLARIFICATION" || message.model === "clarification-v1")
    return "Précision nécessaire";
  return "Sources documentaires validées";
}
