import { createContext } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { DossierSummary, PagedResponse } from "../types/api";

export interface DossierSelection {
  dossierId: string;
  selectDossier: (id: string) => void;
  dossiers: UseQueryResult<PagedResponse<DossierSummary>, Error>;
}

export const DossierSelectionContext = createContext<DossierSelection | null>(
  null,
);
