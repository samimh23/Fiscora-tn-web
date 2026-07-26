export const taskStatusLabels: Record<string, string> = {
  A_FAIRE: 'À faire', EN_COURS: 'En cours', PRETE_POUR_REVISION: 'Prête pour révision',
  TERMINEE: 'Terminée', ANNULEE: 'Annulée',
};
export const taskPriorityLabels: Record<string, string> = {
  BASSE: 'Basse', NORMALE: 'Normale', HAUTE: 'Haute', URGENTE: 'Urgente',
};
export const obligationStatusLabels: Record<string, string> = {
  NON_COMMENCEE: 'Non commencée', EN_COURS: 'En cours', PRETE_POUR_REVISION: 'Prête pour révision',
  VALIDEE: 'Validée', DEPOSEE: 'Déposée', PAYEE: 'Payée',
};
export const documentCategories = [
  { value: 'BOITE_RECEPTION', label: 'Boîte de réception' },
  { value: 'FACTURES_ACHATS', label: 'Factures d’achats' },
  { value: 'FACTURES_VENTES', label: 'Factures de ventes' },
  { value: 'RELEVES_BANCAIRES', label: 'Relevés bancaires' },
  { value: 'CONTRATS', label: 'Contrats' },
  { value: 'DECLARATIONS', label: 'Déclarations' },
  { value: 'PAIE', label: 'Paie' },
  { value: 'JURIDIQUE', label: 'Juridique' },
  { value: 'DIVERS', label: 'Divers' },
];
export const documentCategoryLabel = (value: string) => documentCategories.find((item) => item.value === value)?.label ?? value;
export const formatDate = (value: string) => new Intl.DateTimeFormat('fr-TN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
