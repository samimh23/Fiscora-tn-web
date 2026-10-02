# Diagramme de cas d’utilisation global — Fiscora

Version mise à jour le 2 octobre 2026, alignée sur les rôles par défaut et les principaux parcours de l’application.

- `fiscora-use-case-global.png` : image haute résolution à insérer dans le rapport.
- `fiscora-use-case-global.svg` : version vectorielle, sans perte de qualité.
- `fiscora-use-case-global-corrige.mdj` : modèle global éditable dans StarUML.

## Lecture du diagramme

Le **client du portail** consulte uniquement ses dossiers et les éléments partagés, dépose ses documents, échange avec le cabinet et répond aux demandes d’approbation. Il n’est pas un collaborateur salarié et n’entre pas dans les calculs de coût ou de rentabilité du personnel.

Le **collaborateur du cabinet** travaille dans les dossiers auxquels il a accès. Il prépare les pièces, les factures, les écritures, les rapprochements, les déclarations et les autres travaux comptables. Il traite ses tâches affectées et saisit son temps. Les accès aux modules restent soumis aux permissions ; une affectation à une tâche ne constitue pas, à elle seule, une restriction de tous les modules du dossier.

Le **propriétaire du cabinet** hérite des actions du collaborateur et dispose des actions de gestion, d’affectation, d’approbation, de validation et de clôture. Il configure les honoraires et les coûts et consulte la rentabilité. Un rôle personnalisé peut déléguer certaines de ces permissions à un responsable.

L’**administrateur de plateforme** supervise les organisations, les comptes et le fonctionnement du service SaaS. Ce rôle est distinct du propriétaire d’un cabinet et n’implique pas automatiquement un accès aux données comptables d’un cabinet.

Les **services IA externes** participent à l’extraction et aux réponses de l’assistant. Ils ne réalisent pas la validation humaine des travaux.

## Changements par rapport au précédent schéma

1. Libellés en français et cas regroupés par objectifs métier.
2. Séparation explicite du portail client, de la production du cabinet et de l’administration de plateforme.
3. Ajout du suivi du temps, de son approbation, des honoraires, des coûts et de la rentabilité.
4. Séparation de la préparation et de la validation finale : les permissions de validation ne sont pas attribuées au collaborateur par défaut.
5. Suppression des relations `include` / `extend` qui exprimaient un simple ordre de travail ou des actions non systématiques. Le global présente les objectifs ; les sous-flux peuvent être détaillés dans des diagrammes spécialisés.
6. Authentification, MFA éventuelle et contrôle des permissions indiqués comme préconditions communes. Le service de notification interne n’est plus représenté comme un acteur externe.

La marge estimée du dossier repose sur les honoraires convenus HT moins le coût du temps approuvé. Les honoraires estimés ne constituent ni une facture ni un encaissement. La rentabilité réelle du cabinet nécessite aussi la prise en compte des autres charges.

## Références dans le code

- Backend : `src/database/permissions.ts` — rôles et permissions par défaut.
- Backend : `src/tasks/task-access.ts` et `src/productivity/productivity.service.ts` — tâches affectées, temps approuvés, coûts et rentabilité.
- Backend : `src/client-portal/client-portal.controller.ts` — échanges et approbations du client.
- Backend : `src/assistant/assistant.controller.ts` — assistant et contrôle des accès.
- Backend : `src/platform-admin/platform-admin.controller.ts` — supervision SaaS.

Les exports SVG/PNG ont été contrôlés visuellement. Les identifiants et références internes du modèle StarUML ont été vérifiés ; le modèle d’origine et sa copie dans le dossier local `output/uml` sont conservés.
