# Staff Management System - Visual Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     STAFF MANAGEMENT SYSTEM                   │
├─────────────────────────────────────────────────────────────┤
│                                                                 │
│  PUBLIC                          AUTHENTICATED                │
│  ┌────────────────────┐          ┌──────────────────────┐    │
│  │ Access Request Page │          │   Dashboard          │    │
│  │ /access-request     │          │   /dashboard         │    │
│  │                     │  ────→   │                      │    │
│  │ • Name              │          │ (Staff + Admin)      │    │
│  │ • Email             │          │ Pages based on       │    │
│  │ • Phone             │          │ page_access table    │    │
│  │ • Password          │          │                      │    │
│  └────────────────────┘          └──────────────────────┘    │
│           ↓                                   ↑                  │
│      Submitted as:                   Links to authorized        │
│   • access_request                   pages only                 │
│   • status = pending                                            │
│                                                                 │
│                      ADMIN ONLY                                │
│                   ┌─────────────────┐                          │
│                   │  Staff Page     │                          │
│                   │  /staff         │                          │
│                   │                 │                          │
│                   │ ✓ Pending Reqs  │                          │
│                   │ ✓ Staff Members │                          │
│                   │ ✓ Access Modal  │                          │
│                   └─────────────────┘                          │
│                      ↓          ↑                               │
│                   Approve    Revoke                            │
│                      ↓          ↑                               │
│              ┌──────────────────────┐                          │
│              │  page_access table   │                          │
│              │ (staff_id, page_path)│                          │
│              └──────────────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow: New Staff Onboarding

```
Step 1: Request Access
┌─────────────────────────┐
│ New Staff submits form   │
│ • Name: John Doe        │
│ • Email: john@...       │
│ • Password: secret123   │
└──────────────┬──────────┘
               ↓
┌─────────────────────────────────────────┐
│ access_requests table                   │
│ • status: 'pending'                     │
│ • email: john@example.com               │
│ • password_hash: [SHA-256]              │
└──────────────┬──────────────────────────┘

Step 2: Admin Reviews
               ↓
┌──────────────────────────────────────────┐
│ Admin clicks "Approve" in /staff          │
└──────────────┬───────────────────────────┘
               ↓ (Two things happen:)
      ┌────────┴────────┐
      ↓                 ↓
┌─────────────┐   ┌──────────────────┐
│ Supabase    │   │ staff_members    │
│ Auth User   │   │ table            │
│ Created     │   │ • user_id        │
└─────────────┘   │ • email          │
                  │ • name           │
                  │ • role: 'staff'  │
                  └──────────────────┘

Step 3: Page Access
               ↓
┌──────────────────────────────────────────┐
│ Admin clicks Pencil icon to edit access   │
│ Modal shows: Dashboard, Customers, ...    │
│ Checks/unchecks pages                     │
└──────────────┬───────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│ page_access table populated               │
│ • staff_id: [john's id]                   │
│ • page_path: '/dashboard'                 │
│ • page_path: '/customers'                 │
│ ... (only granted pages)                  │
└──────────────────────────────────────────┘

Step 4: Staff Uses System
               ↓
        ┌─ John logs in ─┐
        ↓                ↓
   Sidebar shown    /dashboard
   only allowed     page_access
   pages            checked
```

## Table Relationships

```
        ┌─────────────────┐
        │  Supabase Auth  │
        │    (users)      │
        └────────┬────────┘
                 │ user_id
                 ↓
        ┌──────────────────┐
        │ staff_members    │─────┐
        │ ─────────────────│     │
        │ id               │     │
        │ user_id (FK)     │     │
        │ email            │     │
        │ name             │     │
        │ role             │     │ staff_id
        │ phone            │     │
        │ deleted_at       │     │
        └──────────────────┘     │
                                  ↓
                        ┌──────────────────┐
                        │  page_access     │
                        │ ─────────────────│
                        │ id               │
                        │ staff_id (FK)    │
                        │ page_path        │
                        │ created_at       │
                        └──────────────────┘

        ┌──────────────────┐
        │access_requests   │
        │ ─────────────────│
        │ id               │
        │ email            │
        │ name             │
        │ status (pending) │
        │ reviewed_by (FK) │───┐
        │ reviewed_at      │   │ (to staff_members)
        │ deleted_at       │   │
        └──────────────────┘   │
                               │
                        ┌──────┴─────┐
                        │ (Admin)    │
                        └────────────┘
```

## User Roles & Permissions Matrix

```
┌──────────────────────────┬────────────┬────────┐
│ Action                   │ Admin      │ Staff  │
├──────────────────────────┼────────────┼────────┤
│ See /staff page          │ ✓          │ ✗      │
│ Approve access requests  │ ✓          │ ✗      │
│ Decline access requests  │ ✓          │ ✗      │
│ Manage staff members     │ ✓          │ ✗      │
│ Manage page access       │ ✓          │ ✗      │
├──────────────────────────┼────────────┼────────┤
│ Log in                   │ ✓          │ ✓*     │
│ View /dashboard          │ ✓          │ ✓*     │
│ View /customers          │ ✓          │ ✓*     │
│ View /rooms              │ ✓          │ ✓*     │
│ View /inventory          │ ✓          │ ✓*     │
│ View /subscriptions      │ ✓          │ ✓*     │
│ View /transactions       │ ✓          │ ✓*     │
└──────────────────────────┴────────────┴────────┘
  * Only if granted by admin in page_access table
```

## Login & Access Flow

```
      User visits /login
              ↓
      ┌──────────────────┐
      │ Enter email &    │
      │ password         │
      └────────┬─────────┘
               ↓
      ┌──────────────────────────┐
      │ Supabase Auth            │
      │ Verifies credentials     │
      └────────┬─────────────────┘
               ↓
      ┌──────────────────────────┐
      │ useStaffAccess hook      │
      │ Fetches staff_members    │
      │ Gets role (admin/staff)  │
      └────────┬─────────────────┘
               ↓
      ┌──────────────────────────┐
      │ Sidebar renders          │
      │ Shows/hides pages based: │
      │ • role == 'admin'?       │
      │ • Check page_access rows │
      └────────┬─────────────────┘
               ↓
      ┌──────────────────────────┐
      │ Dashboard loads          │
      │ Staff sees only allowed  │
      │ pages in sidebar         │
      └──────────────────────────┘
```

## Admin Workflow: Managing Access

```
Admin Home
    ↓
   Click "Staff" (Settings icon in Sidebar)
    ↓
┌────────────────────────────────────┐
│ STAFF PAGE                          │
├────────────────────────────────────┤
│                                    │
│ PENDING REQUESTS                   │
│ ┌──────────────────────────────┐  │
│ │ John Doe                     │  │
│ │ john@example.com             │  │
│ │ [Approve] [Decline]          │  │
│ └──────────────────────────────┘  │
│                                    │
│ STAFF MEMBERS                      │
│ ┌──────────────────────────────┐  │
│ │ Jane Smith    │ admin │ [✏️] │  │
│ │ John Doe      │ staff │ [✏️] │  │
│ │               │       │ [🗑️] │  │
│ └──────────────────────────────┘  │
└────────────────────────────────────┘
    ↓ (Click Pencil)
┌────────────────────────────────────┐
│ ACCESS CONTROL MODAL                │
│ Manage access for: John Doe        │
├────────────────────────────────────┤
│                                    │
│ □ Dashboard                        │
│ ☑ Customers        [✓ Allowed]    │
│ ☑ Rooms            [✓ Allowed]    │
│ □ Inventory                        │
│ ☑ Subscriptions    [✓ Allowed]    │
│ ☑ Transactions     [✓ Allowed]    │
│ □ Staff & Access                   │
│                                    │
│              [Close]               │
└────────────────────────────────────┘
    ↓ (Page access updated immediately)
John logs in next time:
  • Sees: Customers, Rooms, Subscriptions, Transactions
  • Missing: Dashboard, Inventory, Staff
```

## Access Request Form

```
┌──────────────────────────────────────┐
│   Request Access                     │
│                                      │
│ Full Name *                          │
│ [John Doe                           ]│
│                                      │
│ Email Address *                      │
│ [john@example.com                   ]│
│                                      │
│ Phone (Optional)                     │
│ [+20 100 123 4567                   ]│
│                                      │
│ Password *                           │
│ [••••••••••]  Min 6 characters      │
│                                      │
│            [Submit Request]          │
│                                      │
│ Have access? Sign in ↗              │
└──────────────────────────────────────┘
    ↓ (After submit)
┌──────────────────────────────────────┐
│ ✓ Request Submitted                  │
│                                      │
│ Your access request has been         │
│ submitted successfully. An admin     │
│ will review it shortly.              │
│ Redirecting to login...              │
└──────────────────────────────────────┘
```

## Sample Scenarios

### Scenario 1: New Staff Hires
```
1. Email new hire: "Visit /access-request and submit your info"
2. New hire visits /access-request, fills form, submits
3. Admin logs in, sees pending request on /staff page
4. Admin clicks "Approve"
5. System creates Auth user + staff_members record
6. Admin edits staff member, grants: Customers, Rooms, Inventory pages
7. New hire logs in with email/password
8. Sidebar only shows: Customers, Rooms, Inventory
9. Cannot access: Dashboard, Subscriptions, Transactions, Staff
```

### Scenario 2: Restricted Access for Junior Staff
```
1. New staff hired as "Data Entry" role
2. Admin grants access to: Customers, Inventory only
3. Staff logs in, sees only those pages
4. Later, staff promoted
5. Admin clicks edit, checks: Subscriptions, Transactions
6. Staff logs out/in, now sees 4 pages
```

### Scenario 3: Terminating Staff
```
1. Admin clicks trash icon next to staff member
2. Confirm dialog appears
3. Soft deleted (marked deleted_at timestamp)
4. Staff can no longer log in (query filters deleted_at IS NULL)
5. All page_access records still exist (soft delete)
```

## Files to Remember

Key files for understanding the system:

1. **Database**: `supabase/staff_schema.sql` — Run this in Supabase
2. **API**: `src/features/staff/api.ts` — All CRUD operations
3. **Pages**: 
   - `/access-request` — Staff requests
   - `/staff` — Admin management
4. **Hook**: `useStaffAccess(role?)` — Auth check
5. **Sidebar**: `src/components/layout/Sidebar.tsx` — Dynamic nav
6. **Docs**: `STAFF_SETUP.md` — Quick start guide
