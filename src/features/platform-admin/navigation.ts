import {
  ApartmentOutlined,
  DashboardOutlined,
  EmailOutlined,
  GroupsOutlined,
  HistoryOutlined,
  MonitorHeartOutlined,
  QueryStatsOutlined,
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
    key: "analytics",
    label: "Analytics SaaS",
    icon: QueryStatsOutlined,
    description:
      "Consultez les revenus et les indicateurs d’activité des cabinets.",
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
    key: "supervision",
    label: "Supervision",
    icon: MonitorHeartOutlined,
    description:
      "Surveillez la santé de l’API, les performances et les erreurs.",
  },
  {
    key: "audit",
    label: "Journal d’audit",
    icon: HistoryOutlined,
    description:
      "Retrouvez les actions administratives et leurs justifications.",
  },
] as const;

export function getPlatformAdminSection(key: string | null) {
  return (
    platformAdminSections.find((section) => section.key === key) ??
    platformAdminSections[0]
  );
}
