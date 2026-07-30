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

Chaque action sensible demande une justification et affiche une confirmation.
L'administrateur connecté ne peut pas désactiver son propre compte depuis
l'interface.
