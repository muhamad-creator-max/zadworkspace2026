"use client";
import { useCallback, useEffect, useState, type SetStateAction } from "react";

// useState that remembers the last value the user set (per browser tab, via
// sessionStorage), so filters survive navigating away and back. Defaults are
// never written, so a fresh tab always starts from the default.
// Stored values are restored after mount to keep SSR hydration consistent —
// gate data loading on useMounted() so it doesn't fire with the defaults first.
export function usePersistedState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {}
  }, [key]);

  const set = useCallback((v: SetStateAction<T>) => {
    setValue((prev) => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      try { sessionStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);

  return [value, set] as const;
}

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
