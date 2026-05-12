"use client";
import { useEffect, useState } from "react";
import { Check, X, Pencil, Trash2, Clock } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  getCurrentStaffMember,
  listAccessRequests,
  getPendingAccessRequests,
  declineAccessRequest,
  listStaffMembers,
  softDeleteStaffMember,
} from "@/features/staff/api";
import { approveAccessRequestAction } from "@/features/staff/actions";
import type { AccessRequest, StaffMember } from "@/lib/types";
import { dt } from "@/lib/format";
import { AccessControlModal } from "@/features/staff/AccessControlModal";

export default function StaffPage() {
  const { push } = useToast();
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null);
  const [accessControlOpen, setAccessControlOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const [current, staff, requests, pending] = await Promise.all([
          getCurrentStaffMember(),
          listStaffMembers(),
          listAccessRequests(),
          getPendingAccessRequests(),
        ]);
        setCurrentStaff(current);
        setStaffMembers(staff);
        setAccessRequests(requests);
        setPendingCount(pending.length);
      } catch (e: any) {
        push({ kind: "err", msg: e.message });
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (req: AccessRequest) => {
    try {
      if (!currentStaff) throw new Error("Not authenticated");
      const result = await approveAccessRequestAction(req.id, currentStaff?.id ?? "");
      if (result.error) throw new Error(result.error);
      const { staffMember } = result;
      push({ kind: "ok", msg: `Approved ${req.email}` });
      setAccessRequests(accessRequests.filter((r) => r.id !== req.id));
      setStaffMembers([staffMember, ...staffMembers]);
      setPendingCount(Math.max(0, pendingCount - 1));
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  const handleDecline = async (req: AccessRequest) => {
    try {
      if (!currentStaff) throw new Error("Not authenticated");
      await declineAccessRequest(req.id, currentStaff.id);
      push({ kind: "ok", msg: `Declined ${req.email}` });
      setAccessRequests(accessRequests.filter((r) => r.id !== req.id));
      setPendingCount(Math.max(0, pendingCount - 1));
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  const handleDelete = async () => {
    try {
      if (!deletingStaff) return;
      await softDeleteStaffMember(deletingStaff.id);
      push({ kind: "ok", msg: `Removed ${deletingStaff.name}` });
      setStaffMembers(staffMembers.filter((s) => s.id !== deletingStaff.id));
      setDeletingStaff(null);
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  if (loading) {
    return (
      <>
        <Topbar title="Staff & Access Control" />
        <div className="p-5 text-center" style={{ color: "var(--muted)" }}>
          Loading...
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Staff & Access Control" />
      <div className="p-5 space-y-6">
        {/* PENDING REQUESTS */}
        {pendingCount > 0 && (
          <section>
            <div className="mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Pending Access Requests <span style={{ color: "var(--brand-danger)" }}>({pendingCount})</span>
              </h2>
            </div>
            <div className="space-y-2">
              {accessRequests
                .filter((r) => r.status === "pending")
                .map((req) => (
                  <div key={req.id} className="card p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{req.name}</div>
                      <div className="text-sm" style={{ color: "var(--muted)" }}>
                        {req.email} {req.phone && `• ${req.phone}`}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: "var(--muted)" }}>
                        <Clock className="h-3 w-3" />
                        Requested {dt(req.requested_at)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-success !px-3 !py-2"
                        onClick={() => handleApprove(req)}
                      >
                        <Check className="h-4 w-4" /> Approve
                      </button>
                      <button
                        className="btn btn-danger !px-3 !py-2"
                        onClick={() => handleDecline(req)}
                      >
                        <X className="h-4 w-4" /> Decline
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* STAFF MEMBERS */}
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Staff Members · {staffMembers.length}
            </h2>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-zad">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Joined</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffMembers.map((staff) => (
                    <tr key={staff.id}>
                      <td className="font-medium">{staff.name}</td>
                      <td className="text-sm">{staff.email}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: staff.role === "admin" ? "var(--brand)" : "var(--border)",
                            color: staff.role === "admin" ? "#fff" : "var(--text)",
                          }}
                        >
                          {staff.role}
                        </span>
                      </td>
                      <td className="text-sm">{staff.phone || "—"}</td>
                      <td className="text-xs" style={{ color: "var(--muted)" }}>
                        {dt(staff.created_at)}
                      </td>
                      <td className="text-right">
                        <button
                          className="btn btn-ghost !px-2 !py-1"
                          onClick={() => {
                            setEditingStaff(staff);
                            setAccessControlOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {staff.role !== "admin" && (
                          <button
                            className="btn btn-ghost !px-2 !py-1 ml-1"
                            onClick={() => setDeletingStaff(staff)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!staffMembers.length && (
                    <tr>
                      <td colSpan={6} className="text-center" style={{ color: "var(--muted)" }}>
                        No staff members yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* DIALOGS */}
      <ConfirmDialog
        open={!!deletingStaff}
        title="Remove staff member?"
        message={`${deletingStaff?.name} will be removed from the system.`}
        confirmLabel="Remove"
        destructive
        onCancel={() => setDeletingStaff(null)}
        onConfirm={handleDelete}
      />

      {editingStaff && (
        <AccessControlModal
          open={accessControlOpen}
          onClose={() => setAccessControlOpen(false)}
          staffMember={editingStaff}
          onAccessUpdated={() => {
            push({ kind: "ok", msg: "Access updated" });
          }}
        />
      )}
    </>
  );
}
