import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Server-to-server endpoints (used by Zad Customer Services) authenticate
  // with a bearer secret inside the route, not with a staff login.
  if (request.nextUrl.pathname.startsWith("/api/internal/")) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
