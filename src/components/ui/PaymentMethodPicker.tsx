"use client";

const METHODS = ["Cash", "Card", "Mobile Wallet", "Instapay"];

export function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {METHODS.map((m) => {
        const selected = value === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className="rounded-xl border px-3 py-2.5 text-sm font-medium transition-all"
            style={{
              borderColor: selected ? "var(--brand)" : "var(--border)",
              background: selected ? "rgba(var(--brand-rgb, 53,74,55), 0.08)" : "transparent",
              color: selected ? "var(--brand)" : "var(--muted)",
              boxShadow: selected ? "0 0 0 1.5px var(--brand)" : "none",
            }}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}
