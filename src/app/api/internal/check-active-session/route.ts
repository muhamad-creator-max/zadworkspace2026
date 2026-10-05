import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/phone";

/**
 * POST /api/internal/check-active-session
 *
 * Private, server-to-server endpoint for the Zad Customer Services app. It
 * answers one question: does this phone number belong to someone who is
 * checked in right now? This system stays the source of truth.
 *
 *   Authorization: Bearer <INTERNAL_API_SECRET>
 *   Body:          { "phone": "01012345678" }
 *   200:           { "allowed": true, "customer": { id, type, name, phone }, "session": { id, checked_in_at } }
 *                  { "allowed": false }   (unknown number, or no active visit)
 *
 * How a visit is identified here (see supabase/schema.sql):
 *   - `sessions` rows are visits; a visit is active while `status = 'active'`
 *     and it is not soft-deleted. Checkout sets `status = 'closed'` + `ended_at`.
 *   - A visit belongs to a walk-in customer (`customer_id` → customers) or a
 *     subscriber (`subscriber_id` → subscribers). Both keep a free-text phone.
 *   - Customer and subscriber ids live in different tables, so the response
 *     includes `type` alongside `id`.
 */

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

type Person = { id: string; name: string; phone: string | null; deleted_at: string | null };
type ActiveVisit = { id: string; started_at: string; customer: Person | null; subscriber: Person | null };

function isAuthorized(header: string | null, secret: string): boolean {
  const token = /^Bearer\s+(.+)$/i.exec(header ?? "")?.[1]?.trim();
  if (!token) return false;
  // Compare fixed-length digests in constant time.
  const presented = createHash("sha256").update(token).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(presented, expected);
}

export async function POST(request: Request) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret || secret.length < 32) {
    console.error("[check-active-session] INTERNAL_API_SECRET is missing or shorter than 32 characters");
    return NextResponse.json({ error: "not_configured" }, { status: 503, headers: NO_STORE });
  }
  if (!isAuthorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: NO_STORE });
  }
  const phone = normalizePhone((body as { phone?: unknown } | null)?.phone);
  if (!phone) return NextResponse.json({ allowed: false }, { headers: NO_STORE });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Only visits that are open right now can match — a handful at any time —
  // so stored phones can be normalized here without changing the schema.
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, started_at, customer:customers(id, name, phone, deleted_at), subscriber:subscribers(id, name, phone, deleted_at)",
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .order("started_at", { ascending: true })
    .limit(1000);

  if (error) {
    console.error("[check-active-session] lookup failed:", error.message);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500, headers: NO_STORE });
  }

  for (const visit of (data ?? []) as unknown as ActiveVisit[]) {
    const match = (
      [
        { type: "customer", person: visit.customer },
        { type: "subscriber", person: visit.subscriber },
      ] as const
    ).find(({ person }) => person && !person.deleted_at && normalizePhone(person.phone) === phone);

    if (match?.person) {
      return NextResponse.json(
        {
          allowed: true,
          customer: { id: match.person.id, type: match.type, name: match.person.name, phone },
          session: { id: visit.id, checked_in_at: visit.started_at },
        },
        { headers: NO_STORE },
      );
    }
  }

  return NextResponse.json({ allowed: false }, { headers: NO_STORE });
}
