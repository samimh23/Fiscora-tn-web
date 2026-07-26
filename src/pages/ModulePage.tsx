import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { CheckCircleOutlineRounded, ConstructionRounded } from '@mui/icons-material';
import { PageHeader } from '../components/PageHeader';

const modules: Record<string, { title: string; description: string; next: string[] }> = {
  taches: { title: 'Tâches et workflow', description: 'Planification, affectation, checklist et validation du travail.', next: ['Liste et filtres avancés', 'Vue Kanban', 'Fiche tâche et commentaires'] },
  obligations: { title: 'Calendrier fiscal', description: 'Échéances fiscales et sociales de chaque dossier client.', next: ['Calendrier cabinet', 'Préparation et validation', 'Dépôt et paiement'] },
  documents: { title: 'Documents', description: 'Collecte, classement et suivi des pièces comptables.', next: ['Bibliothèque par dossier', 'Dépôt sécurisé', 'Documents manquants'] },
  factures: { title: 'Achats et ventes', description: 'Factures, avoirs, TVA et génération des écritures.', next: ['Liste des factures', 'Saisie guidée', 'Validation comptable'] },
  comptabilite: { title: 'Production comptable', description: 'Journaux, écritures, grand livre et balance.', next: ['Journaux comptables', 'Saisie des écritures', 'Rapports comptables'] },
  banque: { title: 'Rapprochement bancaire', description: 'Import et rapprochement des mouvements bancaires.', next: ['Comptes bancaires', 'Import de relevé', 'Rapprochement assisté'] },
  'etats-financiers': { title: 'États financiers', description: 'États NC 01, notes, contrôles et exports définitifs.', next: ['Mapping des comptes', 'Prévisualisation', 'Validation et export'] },
  declarations: { title: 'Déclarations', description: 'Préparation, revue et dépôt des déclarations tunisiennes.', next: ['Feuille mensuelle', 'Contrôles de cohérence', 'Circuit de validation'] },
  paie: { title: 'Paie et CNSS', description: 'Salariés, traitements mensuels et synthèses CNSS.', next: ['Registre du personnel', 'Préparation de paie', 'Déclaration CNSS'] },
  fiscalite: { title: 'Paramètres fiscaux', description: 'Taux officiels versionnés et applicables à chaque client.', next: ['TVA et retenues', 'TFP, FOPROLOS et TCL', 'Barèmes IRPP'] },
  honoraires: { title: 'Honoraires du cabinet', description: 'Facturation des clients et suivi des règlements.', next: ['Factures d’honoraires', 'Encaissements', 'Relances clients'] },
  temps: { title: 'Temps de travail', description: 'Temps par collaborateur, dossier et tâche.', next: ['Saisie quotidienne', 'Soumission des temps', 'Approbation responsable'] },
  rentabilite: { title: 'Rentabilité', description: 'Marge par client, coût de l’équipe et performance opérationnelle.', next: ['Synthèse cabinet', 'Analyse par dossier', 'Analyse par collaborateur'] },
  equipe: { title: 'Équipe et accès', description: 'Membres, invitations, rôles et permissions.', next: ['Annuaire du cabinet', 'Rôles personnalisés', 'Journal d’audit'] },
};

export function ModulePage({ moduleKey }: { moduleKey: string }) {
  const module = modules[moduleKey];
  return (
    <>
      <PageHeader eyebrow="Module planifié" title={module.title} description={module.description} />
      <Card>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}><Box sx={{ width: 52, height: 52, borderRadius: 3, bgcolor: 'primary.light', color: 'primary.main', display: 'grid', placeItems: 'center' }}><ConstructionRounded /></Box><Box><Chip label="Prochaine phase" size="small" color="secondary" /><Typography variant="h3" sx={{ fontSize: 26, mt: 1 }}>Ce module sera connecté au backend existant</Typography></Box></Box>
          <div className="module-grid">
            {module.next.map((item, index) => <Box key={item} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: index === 0 ? '#faf5e8' : 'background.paper' }}><CheckCircleOutlineRounded color={index === 0 ? 'secondary' : 'disabled'} /><Typography sx={{ mt: 1, fontWeight: 750 }}>{item}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{index === 0 ? 'Premier écran de ce module.' : 'Ajouté après validation de l’écran précédent.'}</Typography></Box>)}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
