"use client";
import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; kind: "ok" | "err"; msg: string };
const Ctx = createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p, { ...t, id }]);
    setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-xl px-4 py-2 text-sm shadow-soft-lg"
            style={{
              background: t.kind === "ok" ? "#D0FFB6" : "#FAA9A9",
              color: t.kind === "ok" ? "#1d3a16" : "#5a1414",
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast must be used inside ToastProvider");
  return c;
}
