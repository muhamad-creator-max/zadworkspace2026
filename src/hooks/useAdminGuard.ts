"use client";
import { useEffect, useState } from "react";
import { getCurrentStaffMember } from "@/features/staff/api";

/**
 * Returns whether the current user is an admin.
 * `null` = still loading, `true` = admin, `false` = non-admin / unauthenticated.
 */
export function useAdminGuard(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    getCurrentStaffMember()
      .then((s) => setIsAdmin(s?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  return isAdmin;
}
