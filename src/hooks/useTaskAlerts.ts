"use client";
import { useEffect, useState } from "react";
import { hasActiveTaskAlerts } from "@/features/tasks/api";

// Polls every 60s for any task alert (one-time or pinned) that has fired
// and is still unchecked for the current member. Returns true if so — used
// by the sidebar to render a red dot on the Tasks icon.
export function useTaskAlerts(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const v = await hasActiveTaskAlerts();
        if (mounted) setActive(v);
      } catch {
        // ignore
      }
    };
    check();
    const t = setInterval(check, 60_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  return active;
}
