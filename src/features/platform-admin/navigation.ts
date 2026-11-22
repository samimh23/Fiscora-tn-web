import {
  ApartmentOutlined,
  AutoAwesomeOutlined,
  DashboardOutlined,
  EmailOutlined,
  GroupsOutlined,
  MonitorHeartOutlined,
  PaidOutlined,
  PsychologyOutlined,
  ReceiptLongOutlined,
  SyncRounded,
} from "@mui/icons-material";

export const platformAdminSections = [
  {
    key: "overview",
    label: "Vue d’ensemble",
    icon: DashboardOutlined,
    description: "Disponibilité des services et alertes de la plateforme.",
  },
  {
    key: "cabinets",
    label: "Cabinets",
    icon: ApartmentOutlined,
    description: "Consultez les cabinets et gérez leur accès à la plateforme.",
  },
  {
    key: "utilisateurs",
    label: "Utilisateurs",
    icon: GroupsOutlined,
    description:
      "Gérez les comptes, leurs cabinets, leurs rôles et leur sécurité.",
  },
  {
    key: "abonnements",
    label: "Abonnements",
    icon: ReceiptLongOutlined,
    description: "Suivez les offres, les abonnements et leur facturation.",
  },
  {
    key: "traitements",
    label: "Traitements",
    icon: SyncRounded,
    description: "Suivez les extractions et les traitements de fond.",
  },
  {
    key: "emails",
    label: "E-mails",
    icon: EmailOutlined,
    description: "Contrôlez la configuration et les envois transactionnels.",
  },
  {
    key: "training",
    label: "Jeux de données IA",
    icon: AutoAwesomeOutlined,
    description:
      "Collectez les exemples autorisés et exportez un dataset pour LoRA.",
  },
  {
    key: "ia",
    label: "IA & assistant",
    icon: PsychologyOutlined,
    description:
      "Suivez les appels IA, leurs erreurs, leur coût et les avis sur les réponses.",
  },
  {
    key: "couts",
    label: "Coûts cloud",
    icon: PaidOutlined,
    description: "Suivez les dépenses Azure et Google Cloud et les budgets.",
  },
  {
    key: "supervision",
    label: "Supervision",
    icon: MonitorHeartOutlined,
    description:
      "Surveillez la santé de l’API, les performances et les erreurs.",
  },
] as const;

export function getPlatformAdminSection(key: string | null) {
  return (
    platformAdminSections.find((section) => section.key === key) ??
    platformAdminSections[0]
  );
}
