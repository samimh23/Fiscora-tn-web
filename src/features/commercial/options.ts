export const money = (value?: string | number | null) =>
  value === null || value === undefined || value === ''
    ? '—'
    : new Intl.NumberFormat('fr-TN', {
        style: 'currency', currency: 'TND', minimumFractionDigits: 3,
      }).format(Number(value));

export const shortDate = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('fr-TN').format(new Date(`${value}T00:00:00`)) : '—';

export const partyTypeLabels: Record<string, string> = {
  CLIENT: 'Client',
  FOURNISSEUR: 'Fournisseur',
  CLIENT_ET_FOURNISSEUR: 'Client et fournisseur',
};

export const invoiceStatusLabels: Record<string, string> = {
  BROUILLON: 'Brouillon',
  VALIDEE: 'Validée',
  COMPTABILISEE: 'Comptabilisée',
  ANNULEE: 'Annulée',
};

export const settlementStatusLabels: Record<string, string> = {
  NON_REGLEE: 'Non réglée',
  PARTIELLEMENT_REGLEE: 'Partiellement réglée',
  REGLEE: 'Réglée',
};

export const paymentStatusLabels: Record<string, string> = {
  BROUILLON: 'À comptabiliser',
  COMPTABILISE: 'Comptabilisé',
  ANNULE: 'Annulé',
};

export const journalTypeLabels: Record<string, string> = {
  ACHATS: 'Achats', VENTES: 'Ventes', BANQUE: 'Banque', CAISSE: 'Caisse',
  OPERATIONS_DIVERSES: 'Opérations diverses', PAIE: 'Paie',
};
