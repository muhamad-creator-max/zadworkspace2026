"use client";
import { ReactNode } from "react";
import { Topbar } from "./Topbar";
import { useStaffAccess } from "@/lib/hooks/useStaffAccess";

export function ProtectedPageWrapper({
  children,
  title,
  requiredRole,
}: {
  children: ReactNode;
  title: string;
  requiredRole?: "admin" | "staff";
}) {
  const { loading, authorized } = useStaffAccess(requiredRole);

  if (loading) {
    return (
      <>
        <Topbar title={title} />
        <div className="p-5 text-center" style={{ color: "var(--muted)" }}>
          Loading...
        </div>
      </>
    );
  }

  if (!authorized) {
    return (
      <>
        <Topbar title={title} />
        <div className="p-5">
          <div className="card p-8 text-center">
            <p style={{ color: "var(--muted)" }}>
              {requiredRole === "admin"
                ? "Access denied. Admins only."
                : "You don't have access to this page."}
            </p>
          </div>
        </div>
      </>
    );
  }

  return children;
}
