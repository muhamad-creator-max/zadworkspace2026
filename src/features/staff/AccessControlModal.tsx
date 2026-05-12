"use client";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { listPageAccess, grantPageAccess, revokePageAccess } from "./api";
import type { StaffMember, PageAccess } from "@/lib/types";

const AVAILABLE_PAGES = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/customers", label: "Customers" },
  { path: "/sessions", label: "Sessions" },
  { path: "/rooms", label: "Rooms" },
  { path: "/inventory", label: "Inventory" },
  { path: "/subscriptions", label: "Subscriptions" },
  { path: "/transactions", label: "Transactions & Orders" },
  { path: "/staff", label: "Staff & Access Control" },
];

export function AccessControlModal({
  open,
  onClose,
  staffMember,
  onAccessUpdated,
}: {
  open: boolean;
  onClose: () => void;
  staffMember: StaffMember;
  onAccessUpdated: () => void;
}) {
  const { push } = useToast();
  const [pageAccess, setPageAccess] = useState<PageAccess[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const loadAccess = async () => {
      try {
        setLoading(true);
        const access = await listPageAccess(staffMember.id);
        setPageAccess(access);
      } catch (e: any) {
        push({ kind: "err", msg: e.message });
      } finally {
        setLoading(false);
      }
    };
    loadAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staffMember.id]);

  const hasAccess = (path: string) => pageAccess.some((p) => p.page_path === path);

  const toggleAccess = async (path: string) => {
    try {
      if (hasAccess(path)) {
        await revokePageAccess(staffMember.id, path);
        setPageAccess(pageAccess.filter((p) => p.page_path !== path));
        push({ kind: "ok", msg: `Revoked access to ${path}` });
      } else {
        const newAccess = await grantPageAccess(staffMember.id, path);
        setPageAccess([...pageAccess, newAccess]);
        push({ kind: "ok", msg: `Granted access to ${path}` });
      }
      onAccessUpdated();
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Manage access for ${staffMember.name}`}
      size="lg"
    >
      <div className="space-y-3">
        <p style={{ color: "var(--muted)" }} className="text-sm">
          Enable access to pages below for this staff member. Admins always have full access.
        </p>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {AVAILABLE_PAGES.map((page) => {
            const allowed = hasAccess(page.path);
            return (
              <div
                key={page.path}
                className="flex items-center justify-between p-3 rounded-lg border transition"
                style={{
                  borderColor: "var(--border)",
                  background: allowed ? "rgba(208, 255, 182, 0.1)" : "transparent",
                }}
              >
                <label className="flex items-center gap-3 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowed}
                    onChange={() => toggleAccess(page.path)}
                    disabled={loading || staffMember.role === "admin"}
                    className="h-4 w-4 rounded"
                  />
                  <div>
                    <div className="font-medium">{page.label}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      {page.path}
                    </div>
                  </div>
                </label>
                {allowed && (
                  <span className="badge" style={{ background: "var(--brand-success)", color: "#1d3a16" }}>
                    ✓ Allowed
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {staffMember.role === "admin" && (
          <div
            className="p-3 rounded-lg text-sm"
            style={{ background: "rgba(53, 74, 55, 0.1)", color: "var(--text)" }}
          >
            Admin members have access to all pages automatically.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
