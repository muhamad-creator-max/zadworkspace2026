import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PAGES = [
  "/dashboard",
  "/customers",
  "/rooms",
  "/inventory",
  "/subscriptions",
  "/transactions",
  "/staff",
  "/checkout",
  "/invoice",
  "/tasks",
  "/attendance",
  "/delete-log",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/access-request") ||
    pathname.startsWith("/blocked") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  // A session is only "valid" if the auth user maps to an ACTIVE (non-deleted)
  // staff member. The client guard (getCurrentStaffMember) enforces the same
  // rule, so they must agree — otherwise a deleted-but-authenticated user
  // ping-pongs forever between /dashboard and /login.
  let staff: { id: string; role: string } | null = null;
  if (authUser) {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await sb
      .from("staff_members")
      .select("id, role")
      .eq("user_id", authUser.id)
      .is("deleted_at", null)
      .single();
    staff = data ?? null;
  }

  // Treat a user with no active staff record as unauthenticated.
  const user = staff ? authUser : null;

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Enforce page-level access control for authenticated users
  if (user && staff) {
    const matchedPage = PROTECTED_PAGES.find((p) => pathname.startsWith(p));
    if (matchedPage) {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // Admins always have full access
      if (staff.role === "admin") return response;

      // /checkout and /invoice are part of the Dashboard check-in/out flow —
      // they have no nav entry and are only reached from the Dashboard, so
      // gate them on Dashboard access rather than a separate grant.
      const requiredPage =
        matchedPage === "/checkout" || matchedPage === "/invoice"
          ? "/dashboard"
          : matchedPage;

      // Check page_access table for non-admins
      const { data: access } = await sb
        .from("page_access")
        .select("id")
        .eq("staff_id", staff.id)
        .eq("page_path", requiredPage)
        .single();

      if (!access) {
        const url = request.nextUrl.clone();
        url.pathname = "/blocked";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
