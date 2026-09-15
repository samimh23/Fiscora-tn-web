import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { UnsavedChangesDialog } from "../components/UnsavedChangesDialog";
import { UnsavedChangesContext } from "./unsaved-changes-context";

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirtySources, setDirtySources] = useState<Set<string>>(() => new Set());
  const hasUnsavedChanges = dirtySources.size > 0;
  const blocker = useBlocker(hasUnsavedChanges);

  const registerDirtyState = useCallback(
    (sourceId: string, isDirty: boolean) => {
      setDirtySources((current) => {
        const alreadyRegistered = current.has(sourceId);
        if (alreadyRegistered === isDirty) return current;
        const next = new Set(current);
        if (isDirty) next.add(sourceId);
        else next.delete(sourceId);
        return next;
      });
    },
    [],
  );
  const unregister = useCallback((sourceId: string) => {
    setDirtySources((current) => {
      if (!current.has(sourceId)) return current;
      const next = new Set(current);
      next.delete(sourceId);
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({ registerDirtyState, unregister }),
    [registerDirtyState, unregister],
  );

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!hasUnsavedChanges) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [hasUnsavedChanges],
    ),
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        guard={{
          requestClose: () => undefined,
          confirmationOpen: blocker.state === "blocked",
          keepEditing: () => {
            if (blocker.state === "blocked") blocker.reset();
          },
          discardChanges: () => {
            if (blocker.state === "blocked") blocker.proceed();
          },
        }}
      />
    </UnsavedChangesContext.Provider>
  );
}
