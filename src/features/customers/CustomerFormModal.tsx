"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createCustomer, updateCustomer } from "./api";
import type { Customer } from "@/lib/types";

export function CustomerFormModal({
  open,
  onClose,
  initial,
  prefillName,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Customer | null;
  prefillName?: string;
  onSaved: (c: Customer) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [study, setStudy] = useState("");
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? prefillName ?? "");
      setPhone(initial?.phone ?? "");
      setStudy(initial?.study ?? "");
    }
  }, [open, initial, prefillName]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      push({ kind: "err", msg: "Name and phone are required" });
      return;
    }
    setBusy(true);
    try {
      const result = initial
        ? await updateCustomer(initial.id, { name, phone, study })
        : await createCustomer({ name, phone, study });
      push({ kind: "ok", msg: initial ? "Customer updated" : "Customer added" });
      onSaved(result);
      onClose();
    } catch (e: any) {
      push({ kind: "err", msg: e.message ?? "Failed to save" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit customer" : "Add new customer"}
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Customer name</label>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Study / Profession</label>
          <input className="input mt-1" value={study} onChange={(e) => setStudy(e.target.value)} />
        </div>
        <div>
          <label className="label">Phone number</label>
          <input className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Add customer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
