import { lazy, Suspense, type ReactNode } from "react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { ClientPortalShell } from "./components/ClientPortalShell";
import { LoadingScreen } from "./components/LoadingScreen";
import { PlatformAdminShell } from "./components/PlatformAdminShell";

const AuthPage = lazy(() =>
  import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const DossiersPage = lazy(() =>
  import("./pages/DossiersPage").then((module) => ({
    default: module.DossiersPage,
  })),
);
const DossierDetailPage = lazy(() =>
  import("./pages/DossierDetailPage").then((module) => ({
    default: module.DossierDetailPage,
  })),
);
const AccountingPage = lazy(() =>
  import("./pages/AccountingPage").then((module) => ({ default: module.AccountingPage })),
);
const DossierWorkspacePage = lazy(() =>
  import("./pages/DossierWorkspacePage").then((module) => ({ default: module.DossierWorkspacePage })),
);
const FinancialStatementsPage = lazy(() =>
  import("./pages/FinancialStatementsPage").then((module) => ({
    default: module.FinancialStatementsPage,
  })),
);
const PayrollPage = lazy(() =>
  import("./pages/PayrollPage").then((module) => ({
    default: module.PayrollPage,
  })),
);
const FixedAssetsPage = lazy(() =>
  import("./pages/FixedAssetsPage").then((module) => ({
    default: module.FixedAssetsPage,
  })),
);
const FiscalSettingsPage = lazy(() =>
  import("./pages/FiscalSettingsPage").then((module) => ({
    default: module.FiscalSettingsPage,
  })),
);
const BillingPage = lazy(() =>
  import("./pages/BillingPage").then((module) => ({
    default: module.BillingPage,
  })),
);
const TimeTrackingPage = lazy(() =>
  import("./pages/TimeTrackingPage").then((module) => ({
    default: module.TimeTrackingPage,
  })),
);
const ProfitabilityPage = lazy(() =>
  import("./pages/ProfitabilityPage").then((module) => ({
    default: module.ProfitabilityPage,
  })),
);
const TeamAdminPage = lazy(() =>
  import("./pages/TeamAdminPage").then((module) => ({
    default: module.TeamAdminPage,
  })),
);
const ForeignTradePage = lazy(() =>
  import("./pages/ForeignTradePage").then((module) => ({
    default: module.ForeignTradePage,
  })),
);
const ElectronicInvoicesPage = lazy(() =>
  import("./pages/ElectronicInvoicesPage").then((module) => ({
    default: module.ElectronicInvoicesPage,
  })),
);
const AcceptInvitationPage = lazy(() =>
  import("./pages/AcceptInvitationPage").then((module) => ({
    default: module.AcceptInvitationPage,
  })),
);
const ClientPortalDashboardPage = lazy(() =>
  import("./pages/ClientPortalDashboardPage").then((module) => ({ default: module.ClientPortalDashboardPage })),
);
const ClientPortalDossierPage = lazy(() =>
  import("./pages/ClientPortalDossierPage").then((module) => ({ default: module.ClientPortalDossierPage })),
);
const ClientPortalDossiersPage = lazy(() =>
  import("./pages/ClientPortalDossiersPage").then((module) => ({ default: module.ClientPortalDossiersPage })),
);
const ClientPortalSettingsPage = lazy(() =>
  import("./pages/ClientPortalSettingsPage").then((module) => ({ default: module.ClientPortalSettingsPage })),
);
const ClientPortalNotificationsPage = lazy(() =>
  import("./pages/ClientPortalNotificationsPage").then((module) => ({ default: module.ClientPortalNotificationsPage })),
);
const PlatformAdminPage = lazy(() =>
  import("./pages/PlatformAdminPage").then((module) => ({
    default: module.PlatformAdminPage,
  })),
);
const SubscriptionPage = lazy(() =>
  import("./pages/SubscriptionPage").then((module) => ({
    default: module.SubscriptionPage,
  })),
);

const lazyPage = (page: ReactNode) => (
  <Suspense fallback={<LoadingScreen />}>{page}</Suspense>
);

function ProtectedRoute() {
  const { isAuthenticated, isBooting } = useAuth();
  if (isBooting) return <LoadingScreen />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/connexion" replace />;
}

function PublicOnlyRoute() {
  const { isAuthenticated, isBooting } = useAuth();
  if (isBooting) return <LoadingScreen />;
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
}

function isClientRole(role?: string) {
  return role?.toLocaleLowerCase("fr").includes("portail client") ?? false;
}

function WorkspaceShell() {
  const { organization } = useAuth();
  return isClientRole(organization?.role) ? <ClientPortalShell /> : <AppShell />;
}

function HomePage() {
  const { organization } = useAuth();
  return isClientRole(organization?.role)
    ? lazyPage(<ClientPortalDashboardPage />)
    : lazyPage(<DashboardPage />);
}

function CabinetOnlyRoute() {
  const { organization } = useAuth();
  return isClientRole(organization?.role) ? <Navigate to="/portail" replace /> : <Outlet />;
}

function ClientOnlyRoute() {
  const { organization } = useAuth();
  return isClientRole(organization?.role) ? <Outlet /> : <Navigate to="/" replace />;
}

function PlatformAdminOnlyRoute() {
  const { session } = useAuth();
  return session?.user.isPlatformAdmin ? (
    <Outlet />
  ) : (
    <Navigate to="/" replace />
  );
}

const router = createBrowserRouter([
  { path: "/invitation/:token", element: lazyPage(<AcceptInvitationPage />) },
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/connexion", element: lazyPage(<AuthPage mode="login" />) },
      { path: "/inscription", element: lazyPage(<AuthPage mode="register" />) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <PlatformAdminOnlyRoute />,
        children: [
          {
            path: "/administration-plateforme",
            element: <PlatformAdminShell />,
            children: [
              { index: true, element: lazyPage(<PlatformAdminPage />) },
            ],
          },
        ],
      },
      {
        element: <WorkspaceShell />,
        children: [
          { index: true, element: <HomePage /> },
          {
            element: <CabinetOnlyRoute />,
            children: [
          { path: "/dossiers", element: lazyPage(<DossiersPage />) },
          { path: "/dossiers/:dossierId", element: lazyPage(<DossierDetailPage />) },
          {
            path: "/etats-financiers",
            element: lazyPage(<FinancialStatementsPage />),
          },
          { path: "/paie", element: lazyPage(<PayrollPage />) },
          { path: "/immobilisations", element: lazyPage(<FixedAssetsPage />) },
          { path: "/fiscalite", element: lazyPage(<FiscalSettingsPage />) },
          { path: "/honoraires", element: lazyPage(<BillingPage />) },
          { path: "/temps", element: lazyPage(<TimeTrackingPage />) },
          { path: "/rentabilite", element: lazyPage(<ProfitabilityPage />) },
          { path: "/equipe", element: lazyPage(<TeamAdminPage />) },
          { path: "/abonnement", element: lazyPage(<SubscriptionPage />) },
          { path: "/taches", element: lazyPage(<DossierWorkspacePage module="tasks" />) },
          { path: "/obligations", element: lazyPage(<DossierWorkspacePage module="obligations" />) },
          { path: "/documents", element: lazyPage(<DossierWorkspacePage module="documents" />) },
          { path: "/factures", element: lazyPage(<DossierWorkspacePage module="commercial" />) },
          { path: "/comptabilite", element: lazyPage(<AccountingPage />) },
          { path: "/banque", element: lazyPage(<DossierWorkspacePage module="banking" />) },
          { path: "/commerce-exterieur", element: lazyPage(<ForeignTradePage />) },
          { path: "/facturation-electronique", element: lazyPage(<ElectronicInvoicesPage />) },
          { path: "/declarations", element: lazyPage(<DossierWorkspacePage module="declarations" />) },
            ],
          },
          {
            element: <ClientOnlyRoute />,
            children: [
              { path: "/portail", element: lazyPage(<ClientPortalDashboardPage />) },
              { path: "/portail/dossiers", element: lazyPage(<ClientPortalDossiersPage />) },
              { path: "/portail/dossiers/:dossierId", element: lazyPage(<ClientPortalDossierPage />) },
              { path: "/portail/notifications", element: lazyPage(<ClientPortalNotificationsPage />) },
              { path: "/portail/parametres", element: lazyPage(<ClientPortalSettingsPage />) },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
