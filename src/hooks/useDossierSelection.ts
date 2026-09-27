import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * Dossier courant d'un écran de module (comptabilité, paie, immobilisations…).
 *
 * La sélection vit dans l'URL et non dans un état local, pour trois raisons :
 * un lien « ?dossierId=… » ouvre bien le bon client, le dossier reste le même
 * quand on passe d'un module à l'autre, et la page est partageable. Sans cela
 * chaque module repartait sur son propre choix par défaut : on pouvait croire
 * consulter un client tout en regardant la comptabilité d'un autre.
 */
export function useDossierSelection() {
  const { organization } = useAuth();
  const storageKey = `fiscora.lastDossier.${organization?.id ?? "none"}`;
  const [searchParams, setSearchParams] = useSearchParams();
  const fromUrl = searchParams.get("dossierId") ?? "";

  let fromStorage = "";
  if (!fromUrl) {
    try {
      fromStorage = sessionStorage.getItem(storageKey) ?? "";
    } catch {
      // Stockage indisponible (navigation privée) : l’URL reste la source.
    }
  }
  const dossierId = fromUrl || fromStorage;

  // Le dossier doit être mémorisé quelle que soit son origine — y compris
  // lorsqu'il vient de l'URL ou d'un sélecteur interne à la page — sinon le
  // module suivant, ouvert sans paramètre, repart sur un autre client.
  useEffect(() => {
    if (!fromUrl) return;
    try {
      sessionStorage.setItem(storageKey, fromUrl);
    } catch {
      // Stockage indisponible (navigation privée) : l’URL suffit.
    }
  }, [fromUrl, storageKey]);

  // Reprise du dernier dossier consulté quand on arrive sans paramètre.
  useEffect(() => {
    if (!fromStorage || fromUrl) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("dossierId", fromStorage);
        return next;
      },
      { replace: true },
    );
  }, [fromStorage, fromUrl, setSearchParams]);

  const setDossierId = useCallback(
    (value: string) => {
      try {
        if (value) sessionStorage.setItem(storageKey, value);
        else sessionStorage.removeItem(storageKey);
      } catch {
        // Stockage indisponible (navigation privée) : l'URL suffit.
      }
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value) next.set("dossierId", value);
          else next.delete("dossierId");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, storageKey],
  );

  return [dossierId, setDossierId] as const;
}
