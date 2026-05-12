# Apply RLS Fixes - Staff Management System

## Issue
When submitting the access request form, you get:
```
new row violates row-level security policy for table "access_requests"
```

## Root Cause
The RLS policy required `authenticated` users, but the access request form is for **unauthenticated users** (new staff without accounts).

## Solution (Choose One)

### Option A: Fresh Install (Recommended)
If you haven't run `supabase/staff_schema.sql` yet:

1. Run the updated `supabase/staff_schema.sql` (fixes are already included)
2. Done! ✅

### Option B: Patch Existing Install
If you already ran the old `supabase/staff_schema.sql`:

1. Open Supabase SQL Editor
2. Create new query
3. Copy entire contents of `supabase/staff_fixes.sql`
4. Click **Run**
5. Done! ✅

## What Was Fixed

1. ✅ RLS policy now allows `anon` (unauthenticated) users to submit requests
2. ✅ `user_id` column made nullable (staff created on approval, auth user created on first login)
3. ✅ Default admin staff record seeded automatically

## Test Now

1. Open `http://localhost:3000/access-request` (without logging in)
2. Submit the form
3. ✅ Should succeed (no RLS error)
4. Log in as admin → approve request
5. ✅ Should work without errors

---

**Status**: All fixes applied. System should now work end-to-end! 🚀
