import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DossierSelectionContext } from "../hooks/dossierSelectionContext";
import type { DossierSummary, PagedResponse } from "../types/api";

function readSelection(key: string) {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/** One selection for the shell, module pages and assistant. URLs win over memory. */
export function DossierSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { organization, session } = useAuth();
  const organizationId = organization?.id ?? "";
  const scope = `${organizationId}.${session?.user.id ?? "anonymous"}`;
  const storageKey = `fiscora.lastDossier.${scope}`;
  const location = useLocation();
  const navigate = useNavigate();
  const [selection, setSelection] = useState(() => ({
    scope,
    dossierId: readSelection(storageKey),
    clearingUrl: false,
  }));
  const scopeChanged = selection.scope !== scope;
  const routeId = location.pathname.match(
    /^\/(?:portail\/)?dossiers\/([^/]+)/,
  )?.[1];
  const queryId = new URLSearchParams(location.search).get("dossierId");
  const dossierId = scopeChanged
    ? ""
    : (selection.clearingUrl ? "" : routeId || queryId) || selection.dossierId;
  const dossiers = useQuery({
    queryKey: ["dossier-options", organizationId, session?.user.id],
    queryFn: () =>
      api.get<PagedResponse<DossierSummary>>(
        `/api/organizations/${organizationId}/dossiers?page=1&pageSize=100`,
      ),
    enabled: Boolean(organizationId),
  });

  useEffect(() => {
    if (!scopeChanged) return;
    setSelection({
      scope,
      dossierId: readSelection(storageKey),
      clearingUrl: true,
    });
    const params = new URLSearchParams(location.search);
    params.delete("dossierId");
    const path = routeId
      ? location.pathname.startsWith("/portail/")
        ? "/portail/dossiers"
        : "/dossiers"
      : location.pathname;
    navigate(`${path}${params.size ? `?${params}` : ""}${location.hash}`, {
      replace: true,
    });
  }, [scopeChanged, scope, storageKey, routeId, location, navigate]);

  useEffect(() => {
    if (!scopeChanged && selection.clearingUrl && !routeId && !queryId) {
      setSelection((current) => ({ ...current, clearingUrl: false }));
    }
  }, [scopeChanged, selection.clearingUrl, routeId, queryId]);

  useEffect(() => {
    if (scopeChanged || !dossierId) return;
    setSelection((current) =>
      current.dossierId === dossierId ? current : { ...current, dossierId },
    );
    try {
      sessionStorage.setItem(storageKey, dossierId);
    } catch {
      /* Memory and URL still work. */
    }
  }, [dossierId, scopeChanged, storageKey]);

  useEffect(() => {
    // Never replace an explicit deep link because it is outside the first list page.
    if (!scopeChanged && !dossierId && dossiers.data?.items.length) {
      const firstId = dossiers.data.items[0].id;
      setSelection((current) => ({ ...current, dossierId: firstId }));
    }
  }, [scopeChanged, dossierId, dossiers.data]);

  const selectDossier = useCallback(
    (id: string) => {
      setSelection({ scope, dossierId: id, clearingUrl: false });
      try {
        if (id) sessionStorage.setItem(storageKey, id);
        else sessionStorage.removeItem(storageKey);
      } catch {
        /* Memory and URL still work. */
      }
      if (routeId && id) {
        const prefix = location.pathname.startsWith("/portail/")
          ? "/portail/dossiers"
          : "/dossiers";
        navigate(`${prefix}/${encodeURIComponent(id)}${location.hash}`, {
          replace: true,
        });
        return;
      }
      const params = new URLSearchParams(location.search);
      if (id) params.set("dossierId", id);
      else params.delete("dossierId");
      navigate(
        `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`,
        { replace: true },
      );
    },
    [scope, storageKey, routeId, location, navigate],
  );

  return (
    <DossierSelectionContext.Provider
      value={{ dossierId, selectDossier, dossiers }}
    >
      {children}
    </DossierSelectionContext.Provider>
  );
}
