import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Keeps the active tab in the `?tab=` query parameter so notification links
 * and shared URLs open the right tab, and back/forward navigation works.
 */
export function useTabParam<T extends string>(allowed: readonly T[], fallback: T) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const tab = raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;

  const setTab = useCallback(
    (value: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value === fallback) next.delete("tab");
          else next.set("tab", value);
          return next;
        },
        { replace: true },
      );
    },
    [fallback, setSearchParams],
  );

  return [tab, setTab] as const;
}
