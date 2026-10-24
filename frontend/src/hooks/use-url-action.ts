import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Runs `handler` once when the `name` query parameter is present, then removes
 * the parameter so refreshes and back-navigation do not repeat the action.
 * Used for links such as `/app/budgets?new=1` or `/app/assistant?q=...`.
 */
export function useUrlAction(name: string, handler: (value: string) => void) {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(name);
  const handled = useRef<string | null>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (value === null) {
      handled.current = null;
      return;
    }
    // StrictMode re-runs effects; never fire twice for the same value.
    if (handled.current === value) return;
    handled.current = value;
    handlerRef.current(value);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(name);
        return next;
      },
      { replace: true },
    );
  }, [name, value, setSearchParams]);
}
