import { ArrowBackRounded } from "@mui/icons-material";
import {
  Box,
  Button,
  Container,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { Brand } from "../components/Brand";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

const privacySections: LegalSection[] = [
  {
    title: "1. Données traitées",
    paragraphs: [
      "Fiscora traite les informations nécessaires à la gestion d’un cabinet et de ses dossiers : identité et coordonnées des utilisateurs, données du cabinet, dossiers clients, documents comptables, écritures, actions réalisées dans l’application et journaux de sécurité.",
      "Lors d’une connexion avec Google, Fiscora reçoit uniquement les informations d’identité nécessaires à l’authentification : identifiant Google stable, adresse e-mail vérifiée, nom affiché et, le cas échéant, domaine Google Workspace. Fiscora ne reçoit jamais votre mot de passe Google et ne demande aucun accès à Gmail, Google Drive ou Google Calendar.",
    ],
  },
  {
    title: "2. Finalités",
    paragraphs: [
      "Ces données sont utilisées pour authentifier les utilisateurs, isoler les données de chaque cabinet, fournir les fonctions comptables et fiscales, sécuriser les accès, conserver une piste d’audit, traiter les documents déposés et assurer le support du service.",
    ],
  },
  {
    title: "3. Hébergement et prestataires",
    paragraphs: [
      "L’application et les données métier sont hébergées sur Microsoft Azure. Certains traitements d’intelligence artificielle, notamment l’extraction documentaire et l’assistant, peuvent être exécutés sur Google Cloud. Brevo est utilisé pour les e-mails transactionnels et l’ingestion d’e-mails lorsqu’elle est activée.",
      "Les prestataires reçoivent uniquement les données nécessaires au service concerné. Les accès techniques sont protégés par des identités gérées, des secrets sécurisés et des contrôles d’autorisation.",
    ],
  },
  {
    title: "4. Conservation et sécurité",
    paragraphs: [
      "Les données sont conservées pendant la durée nécessaire à la fourniture du service et aux obligations comptables, fiscales, contractuelles et de sécurité applicables. Les durées exactes peuvent varier selon la nature du document et les obligations du cabinet.",
      "Fiscora applique notamment le chiffrement des communications, l’isolation par organisation, le contrôle des rôles, la journalisation, l’analyse antivirus des fichiers et des sauvegardes de service. Aucun système ne peut toutefois garantir un risque nul.",
    ],
  },
  {
    title: "5. Vos droits",
    paragraphs: [
      "Vous pouvez demander l’accès, la rectification ou, lorsque la loi le permet, la suppression de vos données. Certaines informations doivent être conservées pour respecter les obligations légales du cabinet ou protéger la sécurité du service.",
      "Pour toute question relative aux données personnelles ou à la connexion Google, contactez samimahjoub090@gmail.com.",
    ],
  },
  {
    title: "6. Évolutions",
    paragraphs: [
      "Cette politique peut être mise à jour lorsque les fonctionnalités, les prestataires ou les exigences légales évoluent. La date de mise à jour affichée en tête de page permet d’identifier la version applicable.",
    ],
  },
];

const termsSections: LegalSection[] = [
  {
    title: "1. Objet du service",
    paragraphs: [
      "Fiscora est une plateforme professionnelle de gestion comptable, fiscale et collaborative destinée aux cabinets, à leurs collaborateurs et à leurs clients. Chaque utilisateur doit employer le service dans le cadre de ses droits et responsabilités professionnels.",
    ],
  },
  {
    title: "2. Comptes et accès",
    paragraphs: [
      "L’utilisateur est responsable de l’exactitude de ses informations, de la confidentialité de ses moyens d’accès et des actions réalisées depuis son compte. Les rôles et permissions doivent être attribués selon le principe du moindre privilège.",
      "La connexion Google est un moyen d’authentification supplémentaire. Elle ne crée pas automatiquement un accès à un cabinet : l’adresse Google vérifiée doit déjà correspondre à un compte Fiscora autorisé.",
    ],
  },
  {
    title: "3. Données comptables et intelligence artificielle",
    paragraphs: [
      "Les extractions, classements, rapprochements et réponses produits par l’intelligence artificielle constituent des propositions de travail. Ils ne remplacent ni le jugement professionnel ni les contrôles comptables et fiscaux.",
      "Une validation humaine reste obligatoire avant toute comptabilisation, déclaration, transmission ou décision ayant un effet financier ou juridique.",
    ],
  },
  {
    title: "4. Utilisation autorisée",
    paragraphs: [
      "Il est interdit d’utiliser Fiscora pour accéder aux données d’un tiers sans autorisation, contourner les contrôles de sécurité, introduire un contenu malveillant, perturber le service ou réaliser une activité contraire à la loi.",
    ],
  },
  {
    title: "5. Disponibilité et responsabilité",
    paragraphs: [
      "Fiscora met en œuvre des moyens raisonnables pour assurer la disponibilité, la sécurité et l’intégrité du service. Des interruptions peuvent néanmoins être nécessaires pour la maintenance, les mises à jour, un incident ou la défaillance d’un prestataire.",
      "Le cabinet demeure responsable de ses obligations professionnelles, de la vérification des résultats, de ses déclarations et de la conservation des justificatifs requis par la réglementation.",
    ],
  },
  {
    title: "6. Suspension et fin d’accès",
    paragraphs: [
      "Un accès peut être suspendu en cas de risque de sécurité, d’utilisation abusive, de violation de ces conditions ou à la demande d’un administrateur autorisé du cabinet. Les modalités de restitution et de conservation des données dépendent du contrat et des obligations légales applicables.",
    ],
  },
  {
    title: "7. Contact et droit applicable",
    paragraphs: [
      "Pour toute question sur le service ou ces conditions, contactez samimahjoub090@gmail.com. Sauf disposition impérative contraire, le service est régi par le droit tunisien.",
    ],
  },
];

export function LegalPage({ type }: { type: "privacy" | "terms" }) {
  const isPrivacy = type === "privacy";
  const title = isPrivacy
    ? "Politique de confidentialité"
    : "Conditions d’utilisation";
  const intro = isPrivacy
    ? "Comment Fiscora collecte, utilise et protège les données nécessaires au service."
    : "Les règles essentielles pour utiliser Fiscora dans un cadre professionnel.";
  const sections = isPrivacy ? privacySections : termsSections;

  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: "#f6f7f4" }}>
      <Box
        component="header"
        sx={{
          bgcolor: "#0b3f34",
          color: "white",
          borderBottom: "1px solid rgba(255,255,255,.12)",
        }}
      >
        <Container
          maxWidth="md"
          sx={{
            minHeight: 76,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Brand dark />
          <LanguageSwitcher />
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
        <Button
          component={RouterLink}
          to="/connexion"
          startIcon={<ArrowBackRounded />}
          sx={{ mb: 3 }}
        >
          Retour à la connexion
        </Button>
        <Paper
          variant="outlined"
          sx={{ p: { xs: 3, sm: 5, md: 7 }, borderRadius: 3 }}
        >
          <Typography variant="overline" color="secondary.main">
            Fiscora · Informations légales
          </Typography>
          <Typography variant="h1" sx={{ mt: 1, fontSize: { xs: 38, sm: 52 } }}>
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 2, fontSize: 17 }}>
            {intro}
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
            Dernière mise à jour : 16 septembre 2026
          </Typography>

          <Divider sx={{ my: 4 }} />

          <Stack spacing={4}>
            {sections.map((section) => (
              <Box component="section" key={section.title}>
                <Typography variant="h5" sx={{ mb: 1.5 }}>
                  {section.title}
                </Typography>
                <Stack spacing={1.4}>
                  {section.paragraphs.map((paragraph) => (
                    <Typography
                      key={paragraph}
                      color="text.secondary"
                      sx={{ lineHeight: 1.75 }}
                    >
                      {paragraph}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>

          <Divider sx={{ my: 4 }} />
          <Typography color="text.secondary" variant="body2">
            Consultez également la{" "}
            <Link
              component={RouterLink}
              to={isPrivacy ? "/conditions" : "/confidentialite"}
              sx={{ fontWeight: 700 }}
            >
              {isPrivacy
                ? "page des conditions d’utilisation"
                : "politique de confidentialité"}
            </Link>
            .
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
