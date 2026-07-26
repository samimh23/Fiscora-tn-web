# Compta TN — Frontend

Interface React + TypeScript de la plateforme comptable tunisienne.

## Développement local

Le backend NestJS doit être accessible sur `http://localhost:3000`.

```bash
npm install
npm run dev
```

Ouvrir ensuite `http://localhost:5173`.

## Première tranche fonctionnelle

- inscription et connexion ;
- renouvellement automatique de session ;
- sélection du cabinet ;
- navigation adaptée aux permissions ;
- tableau de bord alimenté par le backend ;
- liste et recherche des dossiers clients ;
- création, modification, suspension et archivage des dossiers ;
- fiche client complète avec données juridiques, fiscales et honoraires ;
- gestion des contacts et du contact principal ;
- affectation des collaborateurs et budget mensuel en heures ;
- tâches avec priorités, affectation, checklist, commentaires et validation ;
- génération et suivi des obligations fiscales jusqu’au dépôt et paiement ;
- bibliothèque documentaire MinIO avec dépôt, téléchargement et classement ;
- suivi mensuel des documents attendus, manquants et reçus ;
- structure des futurs modules.
