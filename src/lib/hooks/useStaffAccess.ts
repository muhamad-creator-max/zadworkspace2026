import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentStaffMember } from "@/features/staff/api";
import type { StaffMember } from "@/lib/types";

export function useStaffAccess(requiredRole?: "admin" | "staff") {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const current = await getCurrentStaffMember();
        setStaff(current);

        if (!current) {
          router.replace("/login");
          return;
        }

        if (requiredRole && current.role !== requiredRole) {
          router.replace("/dashboard");
          return;
        }
        setAuthorized(true);
      } catch (err) {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    check();
  }, [requiredRole, router]);

  return { staff, loading, authorized };
}
