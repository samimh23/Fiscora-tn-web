export const money = (value?: string | number | null) =>
  value === null || value === undefined || value === ''
    ? '—'
    : new Intl.NumberFormat('fr-TN', {
        style: 'currency',
        currency: 'TND',
        minimumFractionDigits: 3,
      }).format(Number(value));

export const shortDate = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('fr-TN').format(new Date(`${value}T00:00:00`)) : '—';

export const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const journalTypeLabels: Record<string, string> = {
  ACHATS: 'Achats',
  VENTES: 'Ventes',
  BANQUE: 'Banque',
  CAISSE: 'Caisse',
  OPERATIONS_DIVERSES: 'Opérations diverses',
  PAIE: 'Paie',
};

export const entryStatusLabels: Record<string, string> = {
  BROUILLON: 'Brouillon',
  A_VALIDER: 'À valider',
  REJETEE: 'Rejetée',
  COMPTABILISEE: 'Comptabilisée',
  EXTOURNEE: 'Extournée',
};

export const declarationStatusLabels: Record<string, string> = {
  BROUILLON: 'Brouillon',
  PRETE_POUR_REVISION: 'Prête pour révision',
  REJETEE: 'Rejetée',
  VALIDEE: 'Validée',
  DEPOSEE: 'Déposée',
};
