import { useContext, useEffect, useId, useState } from "react";
import { UnsavedChangesContext } from "../unsaved-changes/unsaved-changes-context";

export interface UnsavedChangesGuard {
  requestClose: () => void;
  confirmationOpen: boolean;
  keepEditing: () => void;
  discardChanges: () => void;
}

export function useUnsavedChangesGuard(
  isDirty: boolean,
  onDiscard: () => void,
): UnsavedChangesGuard {
  const [closeRequested, setCloseRequested] = useState(false);
  const sourceId = useId();
  const registry = useContext(UnsavedChangesContext);
  if (!registry)
    throw new Error(
      "useUnsavedChangesGuard doit être utilisé dans UnsavedChangesProvider.",
    );
  useEffect(() => {
    registry.registerDirtyState(sourceId, isDirty);
    return () => registry.unregister(sourceId);
  }, [isDirty, registry, sourceId]);

  const requestClose = () => {
    if (isDirty) setCloseRequested(true);
    else onDiscard();
  };
  const keepEditing = () => {
    setCloseRequested(false);
  };
  const discardChanges = () => {
    setCloseRequested(false);
    onDiscard();
  };

  return {
    requestClose,
    confirmationOpen: closeRequested,
    keepEditing,
    discardChanges,
  };
}
