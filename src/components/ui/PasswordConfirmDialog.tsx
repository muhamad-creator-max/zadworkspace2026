"use client";
import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { verifyCurrentPassword } from "@/features/finance/api";

export function PasswordConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onCancel,
  onConfirmed,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirmed: () => void | Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    if (!password) {
      setError("Password is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyCurrentPassword(password);
      if (!ok) {
        setError("Incorrect password");
        setBusy(false);
        return;
      }
      await onConfirmed();
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>
        {message}
      </p>
      <label className="label">Confirm with your password</label>
      <input
        type="password"
        className="input mt-1"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Your account password"
      />
      {error && (
        <div
          className="mt-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--brand-danger)", color: "#5a1414" }}
        >
          {error}
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          className="btn btn-danger"
          onClick={submit}
          disabled={busy || !password}
        >
          {busy ? "Verifying…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
