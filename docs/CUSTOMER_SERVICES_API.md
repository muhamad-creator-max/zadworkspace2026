# Customer Services integration

The Zad Customer Services app (a separate Next.js app with its own Supabase project) lets checked-in customers use services such as the Task Tracker from their phones. It never reads this system's database. It asks this system exactly one question through a private, server-to-server endpoint:

> Does this phone number belong to someone who is checked in right now?

This system stays the source of truth for customers, check-ins and check-outs.

## Endpoint

`POST /api/internal/check-active-session` — implemented in `src/app/api/internal/check-active-session/route.ts`.

```http
POST /api/internal/check-active-session
Authorization: Bearer <INTERNAL_API_SECRET>
Content-Type: application/json

{ "phone": "01012345678" }
```

Checked in:

```json
{
  "allowed": true,
  "customer": { "id": "8b0c…", "type": "customer", "name": "Ahmed Mohamed", "phone": "01012345678" },
  "session":  { "id": "f31a…", "checked_in_at": "2026-10-04T12:30:00+00:00" }
}
```

Unknown number, or no active visit (deliberately the same answer, so the endpoint can't be used to find out who is a customer):

```json
{ "allowed": false }
```

| Status | Meaning |
| --- | --- |
| 200 | Answer above. An invalid phone format also returns `{ "allowed": false }` |
| 400 | Body isn't JSON |
| 401 | Missing or wrong bearer secret |
| 405 | Not a POST |
| 500 | Database lookup failed |
| 503 | `INTERNAL_API_SECRET` isn't configured (or is shorter than 32 characters) |

All responses are `Cache-Control: no-store`.

## How an active visit is determined

Taken from `supabase/schema.sql` and the existing session/checkout code — nothing in the schema was changed:

| Question | Answer in this system |
| --- | --- |
| Where are customers? | Two tables: `customers` (walk-ins) and `subscribers` (plan holders). Both soft-delete via `deleted_at`. |
| Phone field | `customers.phone` and `subscribers.phone`, free text typed by staff. |
| Where are visits? | `sessions` — one row per check-in. |
| Active visit | `sessions.status = 'active'` and `sessions.deleted_at is null` (the same rule `listActiveSessions` uses). |
| Link to the person | `sessions.customer_id → customers.id` **or** `sessions.subscriber_id → subscribers.id` (exactly one is set). |
| Checkout | `checkoutSession` sets `status = 'closed'`, `ended_at`, duration and price. Room switches keep the same session id. |
| Id returned | The `customers.id` or `subscribers.id` UUID, with `type: "customer" \| "subscriber"`, because the two tables' ids are separate. Customer Services stores the pair as its permanent link to the person (never the phone). |

Because staff type phones as free text, the endpoint loads only the visits that are active right now (a handful at any time) and compares **normalized** phones in code (`src/lib/phone.ts`: `+20 10 1234 5678`, `0020…`, `1012345678`, Arabic-Indic digits, spaces and dashes all become `01012345678`). Soft-deleted customers and subscribers never match. If one number somehow has two active visits, the earliest check-in wins.

`src/lib/phone.ts` has an identical copy in the Customer Services repo; keep the two in sync.

## Setup

1. Generate a secret: `openssl rand -base64 48`.
2. Add it to this app's environment (hosting provider and `.env` / `.env.local`):
   ```
   INTERNAL_API_SECRET=<the secret>
   ```
3. Set the same value as `WORKSPACE_SYSTEM_API_SECRET` in the Customer Services app, with `WORKSPACE_SYSTEM_API_URL` pointing at this app's base URL.

`src/proxy.ts` lets `/api/internal/*` through without a staff login; the route checks the bearer secret itself (constant-time comparison) and uses the service role key server-side only.

## Data quality note

When this integration was built (Oct 4, 2026), 84 of 951 active customer records and 4 of 55 subscribers had phone values that can't be recognized: mostly placeholders such as `0` or `00`, plus about 30 mobile numbers with a digit missing or extra. Those people can't sign in to Customer Services until their number is corrected. Validating the phone field in the customer and subscriber forms (for example with `parsePhone` from `src/lib/phone.ts`) would prevent new cases.
