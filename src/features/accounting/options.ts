export const money = (value?: string | number | null) =>
  value === null || value === undefined || value === ""
    ? "—"
    : new Intl.NumberFormat("fr-TN", {
        style: "currency",
        currency: "TND",
        minimumFractionDigits: 3,
      }).format(Number(value));

export const shortDate = (value?: string | null) => {
  if (!value) return "—";

  // PostgreSQL DATE values normally arrive as YYYY-MM-DD, but raw report
  // queries may be serialized as full ISO timestamps depending on the driver.
  // Parse the calendar part explicitly so we neither append a second time
  // suffix nor shift the displayed day because of a timezone conversion.
  const calendarDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = calendarDate
    ? new Date(
        Number(calendarDate[1]),
        Number(calendarDate[2]) - 1,
        Number(calendarDate[3]),
      )
    : new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fr-TN").format(date);
};

export const monthNames = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export const journalTypeLabels: Record<string, string> = {
  ACHATS: "Achats",
  VENTES: "Ventes",
  BANQUE: "Banque",
  CAISSE: "Caisse",
  OPERATIONS_DIVERSES: "Opérations diverses",
  PAIE: "Paie",
};

export const entryStatusLabels: Record<string, string> = {
  BROUILLON: "Brouillon",
  A_VALIDER: "À valider",
  REJETEE: "Rejetée",
  COMPTABILISEE: "Comptabilisée",
  EXTOURNEE: "Extournée",
};

export const declarationStatusLabels: Record<string, string> = {
  BROUILLON: "Brouillon",
  PRETE_POUR_REVISION: "Prête pour révision",
  REJETEE: "Rejetée",
  VALIDEE: "Validée",
  DEPOSEE: "Déposée",
};
