# Fiscora — audit UX et parcours de modification

Audit initial du 5 septembre 2026. Ce document suit les parcours à rendre
cohérents avant un pilote professionnel. Il distingue volontairement la
**modification** d’un brouillon de la **correction comptable** d’un élément
validé ou comptabilisé.

## Principes retenus

1. Un brouillon peut être modifié directement.
2. Un document émis ou validé ne doit pas être supprimé silencieusement.
3. Une écriture comptabilisée se corrige par extourne.
4. Une facture réglée se corrige par avoir ou remboursement.
5. Toute action destructive ou irréversible explique son effet avant
   confirmation et conserve la piste d’audit.
6. Les tableaux affichent une colonne `Actions` nommée et des libellés métier,
   pas seulement des icônes ou des codes techniques.

## Résultat du premier passage

| Zone | Création | Modification sûre | Correction / annulation | Priorité | État |
| --- | --- | --- | --- | --- | --- |
| Dossiers et contacts | Oui | Oui | Suspension / archivage | P0 | Déjà cohérent |
| Journaux comptables | Oui | Manquante | Code/type verrouillés après usage | P0 | Corrigé dans ce passage |
| Écritures | Oui | Brouillon uniquement | Extourne après comptabilisation | P0 | Déjà cohérent |
| Factures d’honoraires | Oui | Manquante | Annulation non destructive | P0 | Corrigé dans ce passage |
| Opérations import/export | Oui | API présente, bouton absent | Comptabilisation puis règlement | P0 | Corrigé dans ce passage |
| Factures achat/vente | Oui | Brouillon | Avoir après comptabilisation | P0 | À retester de bout en bout |
| Règlements tiers | Oui | Brouillon annulable | Extourne / remboursement tracé | P0 | Corrigé dans ce passage |
| Banque | Oui | Oui sur paramètres | Dérapprochement encadré | P0 | À retester de bout en bout |
| Immobilisations | Oui | Oui avant opérations | Cession / mise au rebut | P1 | Déjà largement couvert |
| Salariés et paie | Oui | Salarié modifiable | Paie validée verrouillée | P1 | Ajouter historique lisible |
| Paramètres fiscaux | Oui | Non par conception | Nouvelle version datée | P0 | UX à expliciter |
| Fiscal annuel / TEJ | Oui | Recalcul avant clôture | Snapshot après clôture | P0 | Validation métier externe requise |
| Documents | Oui | Métadonnées modifiables | Suppression tracée | P0 | Ajouter extraction et revue humaine |
| Portail client | Oui | Préférences/profil | Actions cabinet tracées | P1 | Test mobile et accessibilité |

## Prochains correctifs UX

### P0 — avant pilote

- Uniformiser les libellés de statut et les confirmations métier.
- Étendre les retours de succès et la protection des formulaires aux écrans
  métier secondaires qui ne font pas encore partie du parcours critique.
- Étendre l’audit responsive et RTL automatisé aux écrans métier secondaires ;
  le cockpit, les dossiers, les honoraires et le commerce extérieur sont déjà
  couverts sur ordinateur, tablette et mobile.
- Étendre les tests navigateur existants aux extournes d’écritures, avoirs et
  remboursements tiers avec des jeux de données dédiés. L’émission,
  l’annulation non destructive et la correction d’un règlement d’honoraires
  sont déjà couvertes.

### P1 — qualité professionnelle

- Remplacer les grands formulaires par des sections progressives avec résumé.
- Ajouter recherche, tri, filtres persistants et pagination aux longues listes.
- Afficher l’auteur, la date et la dernière modification sur les fiches.
- Créer un composant commun pour les états vide, erreur et chargement avec
  bouton `Réessayer`.
- Revoir l’arabe en RTL écran par écran, pas uniquement via inversion globale.

### P2 — confort

- Raccourcis clavier documentés.
- Préférences de colonnes et densité des tableaux.
- Actions groupées sur documents, tâches et rapprochements.
- Aide contextuelle courte pour les règles fiscales et comptables complexes.

## Correctifs livrés dans ce passage

- Journaux : modification ajoutée côté interface et API. Dès qu’un journal
  contient une écriture, son code et son type sont verrouillés ; son libellé
  reste corrigeable.
- Factures d’honoraires : modification du brouillon, émission, téléchargement
  PDF et annulation non destructive regroupés dans une colonne `Actions`.
- Factures d’honoraires : une facture comportant un règlement ne peut pas être
  annulée comme si elle n’avait jamais existé ; le futur parcours devra passer
  par une correction tracée ou un remboursement.
- Règlements d’honoraires : historique consultable par facture, correction ou
  remboursement daté avec motif obligatoire, conservation du règlement
  original et recalcul transactionnel du solde. Les écritures concurrentes sont
  sérialisées par verrou de ligne pour empêcher un sur-encaissement.
- Règlements clients et fournisseurs : annulation d’une saisie ou remboursement
  avec date et motif obligatoires, conservation du règlement original,
  extourne automatique de l’écriture comptabilisée et restauration des soldes
  de factures.
- Banque : tout rapprochement lié à un règlement corrigé est libéré et le relevé
  concerné est rouvert pour contrôle. L’utilisateur, la date, le motif, les
  factures restaurées et les opérations bancaires libérées sont conservés dans
  la piste d’audit.
- Chèques et traites impayés : le rejet utilise désormais le même mécanisme
  d’extourne, de restauration des soldes et de réouverture bancaire.
- Commerce extérieur : le bouton de modification d’un brouillon utilise
  désormais l’API de mise à jour déjà présente.
- Les statuts techniques des factures d’honoraires sont présentés avec des
  libellés métier français.
- Un système de retour global affiche désormais les succès métier de manière
  cohérente sans dépendre d’un message local à chaque page.
- Une protection commune détecte les formulaires modifiés et bloque la
  fermeture de la boîte, la navigation interne ainsi que le rechargement ou la
  fermeture du navigateur. Elle couvre les dossiers, contacts, affectations,
  journaux, factures d’honoraires, règlements et opérations de commerce
  extérieur.
- Une suite Playwright vérifie le dialogue de données non enregistrées, la
  conservation de la saisie, le retour de succès après mutation, l’absence de
  débordement horizontal aux trois tailles de référence et la direction RTL
  arabe. Les créations simulées par le test n’écrivent pas de données métier
  permanentes dans la base locale.
- La même suite vérifie l’émission d’une facture d’honoraires, son annulation
  sans suppression de l’historique et l’obligation de saisir un motif avant la
  correction d’un règlement.

## Vérification technique

- Construction backend : réussie.
- Tests backend : 64 réussis sur 64, dont des tests dédiés aux parcours de
  modification, d’annulation et de correction, ainsi qu’à la restauration des
  factures et des rapprochements lors d’une extourne de règlement tiers.
- Construction frontend de production : réussie.
- Tests navigateur Playwright : 8 réussis ; 10 variantes fonctionnelles sont
  ignorées volontairement sur tablette et mobile car les parcours métier sont
  exécutés une seule fois sur ordinateur. Les contrôles responsive et RTL sont
  bien exécutés sur les trois tailles.
- Lint frontend : aucune erreur ; quatre avertissements préexistants dans le
  suivi des tâches et le contexte de temps de travail.
- Lint ciblé des fichiers backend modifiés : réussi.
- Contrôle visuel de la connexion dans un viewport étroit : hiérarchie claire,
  champs lisibles et aucune rupture de mise en page observée.
- Le parcours authentifié `Dossiers clients > Nouveau dossier` a été rejoué
  avec l’environnement Docker local complet. Après modification puis
  annulation, le dialogue `Modifications non enregistrées` apparaît ; l’action
  `Continuer la saisie` conserve les données saisies.
- Le lint global backend reste bloqué par un important passif de formatage
  Prettier dans des fichiers non concernés par ce passage. Il doit être traité
  dans un commit mécanique séparé pour ne pas masquer les changements métier.
- La construction frontend signale encore deux gros morceaux JavaScript : le
  socle principal (environ 760 Ko minifié) et le dossier du portail client
  (environ 423 Ko). Un découpage supplémentaire sera nécessaire avant le
  pilote pour améliorer le premier chargement.
