import { useEffect, useRef, useState } from "react";
import { AssistantRequestFence } from "./request-fence";

export function useAssistantRequest<T, V>(options: {
  scope: string;
  request: (variables: V, signal: AbortSignal) => Promise<T>;
  onSuccess: (result: T, variables: V) => void;
  onError: (error: unknown, variables: V) => void;
  onCancel: (variables: V) => void;
}) {
  const current = useRef(options);
  current.current = options;
  const fence = useRef(new AssistantRequestFence());
  const variables = useRef<V | null>(null);
  const [isPending, setPending] = useState(false);
  useEffect(() => {
    fence.current.invalidate();
    variables.current = null;
    setPending(false);
    const guard = fence.current;
    return () => guard.invalidate();
  }, [options.scope]);

  const reset = () => {
    fence.current.invalidate();
    variables.current = null;
    setPending(false);
  };
  return {
    isPending,
    reset,
    cancel: () => {
      const pending = variables.current;
      reset();
      if (pending) current.current.onCancel(pending);
    },
    mutate: (value: V) => {
      const token = fence.current.begin(current.current.scope);
      variables.current = value;
      setPending(true);
      const request = current.current.request;
      void Promise.resolve()
        .then(() => request(value, token.signal))
        .then((result) => {
          if (fence.current.isCurrent(token, current.current.scope))
            current.current.onSuccess(result, value);
        })
        .catch((error: unknown) => {
          if (
            fence.current.isCurrent(token, current.current.scope) &&
            !token.signal.aborted
          )
            current.current.onError(error, value);
        })
        .finally(() => {
          if (fence.current.isCurrent(token, current.current.scope)) {
            variables.current = null;
            setPending(false);
          }
        });
    },
  };
}
