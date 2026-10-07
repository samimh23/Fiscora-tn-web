# Interface d'administration Fiscora

La route `/administration-plateforme` est un espace séparé de l'interface des
cabinets. Elle n'est accessible que lorsque l'utilisateur authentifié possède
`isPlatformAdmin = true`.

La première version permet au propriétaire de Fiscora de consulter :

- les indicateurs globaux de cabinets, utilisateurs, dossiers et stockage ;
- l'état de PostgreSQL, du stockage documentaire, des e-mails et des sauvegardes ;
- les alertes opérationnelles ;
- la liste agrégée des cabinets ;
- les comptes utilisateurs et leurs accès ;
- les cabinets et rôles de chaque utilisateur ;
- les statuts de vérification de l'e-mail et de double authentification ;
- la suspension et la réactivation motivées des cabinets ;
- la désactivation et la réactivation motivées des utilisateurs ;
- la révocation des sessions renouvelables ;
- le suivi des traitements OCR et e-mail ;
- les abonnements et la supervision technique.

Analytics SaaS, le journal d'audit de plateforme et la facturation TTN ont été
retirés de l'interface et des API dédiées. Les traces internes des actions
sensibles restent conservées ; les factures ordinaires restent disponibles.

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
et traitements sont chargées quand leur section est ouverte.

La liste des utilisateurs propose une recherche et des filtres par cabinet,
rôle et statut du compte. Le rôle est lié au cabinet : les filtres combinés
cabinet/rôle doivent correspondre à la même affectation active. Les comptes
« Portail client » restent distingués des collaborateurs internes. Le rôle
« Admin Fiscora » est un privilège global, affiché séparément.

Sur mobile, les comptes sont présentés en cartes avec leurs actions visibles,
sans défilement horizontal. Sur les autres écrans, une table compacte est utilisée.

Le menu d'actions de chaque compte permet de consulter ses détails, de le
désactiver/réactiver et de révoquer ses connexions. Les détails montrent les
informations de sécurité, sans secret MFA ni jeton d'authentification. Les
compteurs de jetons ne sont pas présentés comme des appareils ou des personnes
en ligne. La révocation bloque le renouvellement des connexions ; les jetons
d'accès déjà délivrés expirent normalement. Les actions sur son propre compte
restent protégées.

Chaque action sensible demande une justification et affiche une confirmation.
L'administrateur connecté ne peut pas désactiver son propre compte depuis
l'interface.
