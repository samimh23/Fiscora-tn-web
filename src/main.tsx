import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline } from "@mui/material";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { AppProviders } from "./AppProviders";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// A user can keep an older application shell open while a new deployment
// replaces its hashed lazy chunks. Vite emits this event when such a chunk is
// no longer available; one guarded refresh loads the new shell and assets.
const deploymentRecoveryKey = "fiscora:deployment-recovery";
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const lastRecovery = Number(
    window.sessionStorage.getItem(deploymentRecoveryKey) ?? "0",
  );
  if (Date.now() - lastRecovery > 60_000) {
    window.sessionStorage.setItem(deploymentRecoveryKey, String(Date.now()));
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </AppProviders>
  </StrictMode>,
);
