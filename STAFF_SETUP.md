# Staff Management System - Setup & Quick Start

## What's New

A complete staff management system has been added to Zad Workspace:

1. **Access Request Page** (`/access-request`) - Staff members can request access
2. **Staff Management Page** (`/staff`) - Admins can approve/decline requests and manage access
3. **Role-Based Access Control** - Separate admin and staff roles with fine-grained page access
4. **Automatic UI Updates** - Sidebar hides staff-only pages from non-admins

## Database Setup

Run this in Supabase SQL Editor:

```sql
-- Copy the full contents of supabase/staff_schema.sql and run it
```

## Key Files

**Database**:
- `supabase/staff_schema.sql` - Schema for staff tables (RLS + policies)

**Types**:
- `src/lib/types.ts` - Added StaffMember, AccessRequest, PageAccess types

**API**:
- `src/features/staff/api.ts` - All staff operations (CRUD, access control)
- `src/features/staff/actions.ts` - Server-side actions for auth user creation

**Components**:
- `src/features/staff/AccessControlModal.tsx` - Modal for granting/revoking page access

**Pages**:
- `src/app/access-request/page.tsx` - Public page for staff to request access
- `src/app/(app)/staff/page.tsx` - Admin-only staff management page

**Hooks**:
- `src/lib/hooks/useStaffAccess.ts` - Hook to check staff role and authenticate

**Updated**:
- `src/components/layout/Sidebar.tsx` - Now hides staff-only links for non-admins
- `src/app/login/page.tsx` - Added link to access request page

## User Flows

### Flow 1: New Staff Member Requests Access

1. Visit **`/access-request`**
2. Fill in: Full Name, Email, Phone (optional), Password (min 6 chars)
3. Submit
4. See success message
5. Redirected to `/login`
6. Status: **Waiting for admin approval**

### Flow 2: Admin Approves Requests

1. Log in as admin (admin / 123123)
2. Click **Staff** in sidebar (visible to admins only)
3. See **Pending Access Requests** section at top
4. For each request:
   - Click **Approve** → user created in Auth + staff_members table
   - Click **Decline** → request marked as declined
5. New staff can now log in with their email and password

### Flow 3: Admin Configures Page Access

1. On Staff page, find staff member in **Staff Members** table
2. Click **Pencil** icon
3. Modal opens showing 8 available pages:
   - Dashboard
   - Customers
   - Rooms
   - Inventory
   - Subscriptions
   - Transactions & Orders
   - Staff & Access Control (admin-only)
4. Check/uncheck to grant/revoke
5. Changes apply immediately
6. Next login, staff only sees allowed pages in sidebar

### Flow 4: Staff Member Logs In

1. Visit **`/login`**
2. Enter email and password
3. Authenticated
4. Sidebar shows only authorized pages
5. Cannot access restricted pages (403-like behavior via toast)

## Admin Only Features

Only users with `role = 'admin'` can:
- See Staff page in sidebar
- Access `/staff` page
- Approve/decline access requests
- Manage staff member records
- Grant/revoke page access
- Delete staff members

## Available Pages for Access Control

These are all the pages staff can be granted/revoked access to:

```
/dashboard           - Dashboard with active sessions
/customers           - Customer management
/rooms               - Room management
/inventory           - Item stock management
/subscriptions       - Plans & subscriber management
/transactions        - Sales & transaction history
/staff               - Staff management (admin-only, can't toggle)
```

## Testing

### Test Scenario 1: Request Access as New Staff

1. Go to `/access-request`
2. Fill form:
   - Name: "John Doe"
   - Email: "john@example.com"
   - Phone: "01012345678"
   - Password: "password123"
3. Click "Submit Request"
4. See success message
5. (As admin) Approve in `/staff`
6. (As John) Log in with john@example.com / password123

### Test Scenario 2: Restrict Access to Pages

1. Log in as admin
2. Go to `/staff`
3. Find "John Doe"
4. Click pencil to edit
5. Uncheck "Customers"
6. Close modal
7. (As John) Log out, log back in
8. "Customers" no longer shows in sidebar
9. Try going directly to `/customers` → see error toast

### Test Scenario 3: Admin Can See Everything

1. Log in as admin (admin / 123123)
2. All pages visible in sidebar
3. Can access `/staff` page
4. Cannot uncheck "Staff" link (admin-only)

## Technical Details

### Password Hashing

Current implementation uses SHA-256 for request storage (demo purposes).

**For production**, upgrade to bcrypt:
```bash
npm install bcrypt
npm install -D @types/bcrypt
```

Then update `src/features/staff/api.ts` hashPassword function.

### RLS Policies

All staff tables have strict RLS:
- Admins: full access to all records
- Staff: read own record + pending requests only
- Unauthenticated: no access

### Email Verification

Current flow auto-confirms users. For production, implement:
1. Email confirmation link in access request
2. Only activate account after email verification
3. Update `createAuthUserFromAccessRequest` in `actions.ts`

### Audit Trail

Admin approvals are logged:
- `access_requests.reviewed_at` - when approved/declined
- `access_requests.reviewed_by` - which admin reviewed it

## Troubleshooting

### "Access denied" on Staff page
- Make sure you're logged in as admin (role='admin')
- Check RLS policies are correct in Supabase

### New staff can't log in after approval
- Verify auth user was created in Supabase Auth > Users
- Check email matches in access_request + staff_members

### Sidebar shows all pages for non-admin
- Check getCurrentStaffMember() is returning correct role
- Verify staff_members record has correct role value

### Page access not working
- Verify page_access records exist in Supabase
- Check that pages match the AVAILABLE_PAGES list
- Clear browser cache and re-login

## Default Credentials

For testing:

| Email | Password | Role |
|-------|----------|------|
| admin@zad.local | 123123 | admin |

## Next Steps

1. Run `staff_schema.sql` in Supabase
2. Test the flows above
3. Create your first staff members via access requests
4. Configure page access in the Staff admin page
5. (Optional) Upgrade password hashing to bcrypt for production
6. (Optional) Add email verification for access requests

## Documentation

See `docs/STAFF_SYSTEM.md` for full technical documentation.
