import { createContext } from "react";

export interface UnsavedChangesContextValue {
  registerDirtyState: (sourceId: string, isDirty: boolean) => void;
  unregister: (sourceId: string) => void;
}

export const UnsavedChangesContext =
  createContext<UnsavedChangesContextValue | null>(null);
