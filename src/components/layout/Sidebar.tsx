"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  Package,
  IdCard,
  Receipt,
  LogOut,
  Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { getCurrentStaffMember } from "@/features/staff/api";

const links = [
  { href: "/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { href: "/customers",     label: "Customers",     icon: Users },
  { href: "/rooms",         label: "Rooms",         icon: DoorOpen },
  { href: "/inventory",     label: "Inventory",     icon: Package },
  { href: "/subscriptions", label: "Subscriptions", icon: IdCard },
  { href: "/transactions",  label: "Orders & Sessions", icon: Receipt },
  { href: "/staff",         label: "Staff",         icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const current = await getCurrentStaffMember();
        setStaff(current);
      } catch (err) {
        // If error, staff not found, continue
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  const signOut = async () => {
    const s = createClient();
    await s.auth.signOut();
    router.replace("/login");
  };

  return (
    <aside
      className="hidden md:flex md:flex-col md:gap-1 md:p-3 md:w-56 md:shrink-0 md:border-r"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="px-3 py-4">
        <div className="text-lg font-bold tracking-tight" style={{ color: "var(--brand)" }}>
          Zad Workspace
        </div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>Coworking OS</div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {links.map(({ href, label, icon: Icon }) => {

          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition"
              style={
                active
                  ? { background: "var(--brand)", color: "#fff" }
                  : { color: "var(--text)" }
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={signOut}
        className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
        style={{ color: "var(--muted)" }}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </aside>
  );
}
