// Domain enums are stored SCREAMING_SNAKE_CASE. Showing them raw ("A_FAIRE",
// "NON_COMMENCEE") makes the product read like a database browser, so every
// user-facing surface should run them through here first.

const KNOWN: Record<string, string> = {
  // Tâches
  A_FAIRE: "À faire",
  EN_COURS: "En cours",
  PRETE_POUR_REVISION: "Prête pour révision",
  TERMINEE: "Terminée",
  BLOQUEE: "Bloquée",
  ANNULEE: "Annulée",
  // Priorités
  BASSE: "Basse",
  NORMALE: "Normale",
  HAUTE: "Haute",
  URGENTE: "Urgente",
  // Factures
  BROUILLON: "Brouillon",
  VALIDEE: "Validée",
  COMPTABILISEE: "Comptabilisée",
  EXTOURNEE: "Extournée",
  ACHAT: "Achat",
  VENTE: "Vente",
  FACTURE: "Facture",
  AVOIR: "Avoir",
  DEVIS: "Devis",
  // Règlements
  NON_REGLEE: "Non réglée",
  PARTIELLEMENT_REGLEE: "Partiellement réglée",
  REGLEE: "Réglée",
  // Banque
  NON_RAPPROCHEE: "Non rapprochée",
  RAPPROCHEE: "Rapprochée",
  IGNOREE: "Ignorée",
  // Obligations
  NON_COMMENCEE: "Non commencée",
  EN_PREPARATION: "En préparation",
  PRETE: "Prête",
  DEPOSEE: "Déposée",
  PAYEE: "Payée",
  // Documents
  A_TRAITER: "À traiter",
  TRAITE: "Traité",
  CLASSE: "Classé",
  EN_ATTENTE: "En attente",
  REUSSIE: "Réussie",
  ECHEC: "Échec",
  SAIN: "Sain",
  INFECTE: "Infecté",
  ERREUR: "Erreur",
  ARCHIVE: "Archivé",
};

/** Turns a single enum token into a readable French label. */
export function humanizeEnum(value?: string | null): string {
  if (!value) return "";
  const key = value.trim().toUpperCase();
  if (KNOWN[key]) return KNOWN[key];
  const words = key.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Humanizes every SCREAMING_SNAKE token embedded in a longer string, so
 * composed server strings like "Priorité HAUTE" or "ACHAT · FACTURE" read
 * naturally without changing the API contract.
 */
export function humanizeText(value?: string | null): string {
  if (!value) return "";
  return value.replace(/\b[A-Z][A-Z_]{2,}\b/g, (token) => humanizeEnum(token));
}
