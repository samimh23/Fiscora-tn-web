export const legalFormOptions = [
  { value: 'SARL', label: 'SARL' },
  { value: 'SUARL', label: 'SUARL' },
  { value: 'SA', label: 'Société anonyme (SA)' },
  { value: 'PERSONNE_PHYSIQUE', label: 'Personne physique' },
  { value: 'ASSOCIATION', label: 'Association' },
  { value: 'AUTRE', label: 'Autre' },
];

export const taxRegimeOptions = [
  { value: 'REEL', label: 'Régime réel' },
  { value: 'REEL_SIMPLIFIE', label: 'Réel simplifié' },
  { value: 'FORFAITAIRE', label: 'Forfaitaire' },
  { value: 'AUTRE', label: 'Autre' },
];

export const billingFrequencyOptions = [
  { value: 'MENSUELLE', label: 'Mensuelle' },
  { value: 'TRIMESTRIELLE', label: 'Trimestrielle' },
  { value: 'ANNUELLE', label: 'Annuelle' },
  { value: 'PAR_SERVICE', label: 'Par prestation' },
];

export const dossierStatusLabels: Record<string, string> = {
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
  ARCHIVE: 'Archivé',
};

export const legalFormLabel = (value: string) => legalFormOptions.find((item) => item.value === value)?.label ?? value;
export const taxRegimeLabel = (value: string) => taxRegimeOptions.find((item) => item.value === value)?.label ?? value;
export const billingFrequencyLabel = (value?: string) => billingFrequencyOptions.find((item) => item.value === value)?.label ?? value ?? '—';
