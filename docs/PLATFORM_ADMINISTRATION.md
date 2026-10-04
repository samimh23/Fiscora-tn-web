# Interface d'administration Fiscora

La route `/administration-plateforme` est un espace séparé de l'interface des
cabinets. Elle n'est accessible que lorsque l'utilisateur authentifié possède
`isPlatformAdmin = true`.

La première version permet au propriétaire de Fiscora de consulter :

- les indicateurs globaux de cabinets, utilisateurs, dossiers et stockage ;
- l'état de PostgreSQL, du stockage documentaire, des e-mails et de TTN ;
- les alertes opérationnelles ;
- la liste agrégée des cabinets ;
- les comptes utilisateurs et leurs accès ;
- le nombre de sessions actives par utilisateur ;
- la suspension et la réactivation motivées des cabinets ;
- la désactivation et la réactivation motivées des utilisateurs ;
- la révocation des sessions renouvelables ;
- le suivi des traitements OCR, e-mail et TTN ;
- les dernières actions du journal d'audit.

Le menu « Administration Fiscora » est affiché dans le menu du compte. Un
utilisateur non autorisé qui saisit directement l'URL est redirigé.

## Navigation

Le menu « Pilotage détaillé » reste visible à gauche sur ordinateur et tablette.
Sur mobile, le bouton de menu ouvre les mêmes sections dans un panneau latéral.
La vue d'ensemble présente uniquement les indicateurs, services et alertes ; les
listes et outils s'ouvrent dans une zone dédiée, sans faire défiler le tableau de
bord. Les sections sont regroupées en gestion et opérations.

La section sélectionnée est conservée dans l'URL, par exemple
`/administration-plateforme?section=cabinets`. Les liens directs, le rechargement
et les boutons précédent/suivant du navigateur sont pris en charge. Une section
inconnue affiche la vue d'ensemble. Les recherches des cabinets et utilisateurs
sont indépendantes et conservées lors des changements de section dans la page.

La navigation ne modifie aucune donnée. Les listes de cabinets, utilisateurs,
traitements et audit sont chargées quand leur section est ouverte.

Chaque action sensible demande une justification et affiche une confirmation.
L'administrateur connecté ne peut pas désactiver son propre compte depuis
l'interface.
