import { useContext } from "react";
import { DossierSelectionContext } from "./dossierSelectionContext";

/** Shared selection; only the provider synchronizes URLs and browser storage. */
export function useCurrentDossier() {
  const selection = useContext(DossierSelectionContext);
  if (!selection) throw new Error("DossierSelectionProvider is required.");
  return selection;
}

export function useDossierSelection() {
  const { dossierId, selectDossier } = useCurrentDossier();
  return [dossierId, selectDossier] as const;
}
