# Staff Management System

## Overview

The Zad Workspace staff management system provides:
- **Access Requests**: Staff members submit requests to join the system
- **Admin Approval**: Admins review and approve/decline requests
- **Role-Based Access**: Admin vs Staff roles with different permissions
- **Page Access Control**: Fine-grained control over which pages each staff member can access

## Database Schema

### staff_members
- `id` (UUID): Primary key
- `user_id` (UUID): Reference to Supabase Auth user
- `email` (text): Staff member email (unique)
- `name` (text): Staff member name
- `role` (enum): 'admin' or 'staff'
- `phone` (text, nullable): Contact phone
- `created_at`, `updated_at`: Timestamps
- `deleted_at` (nullable): Soft delete timestamp

### access_requests
- `id` (UUID): Primary key
- `email` (text): Requested email
- `name` (text): Requested name
- `password_hash` (text): Hashed password (stored temporarily)
- `phone` (text, nullable): Requested phone
- `status` (enum): 'pending', 'approved', 'declined'
- `requested_at`: When request was submitted
- `reviewed_at` (nullable): When admin reviewed it
- `reviewed_by` (UUID, nullable): ID of reviewing admin
- `created_at`, `updated_at`: Timestamps
- `deleted_at` (nullable): Soft delete

### page_access
- `id` (UUID): Primary key
- `staff_id` (UUID): Reference to staff_members
- `page_path` (text): e.g., '/dashboard', '/customers', '/staff'
- `created_at`: When access was granted

## User Flows

### 1. Staff Member Requesting Access

**URL**: `/access-request`

Steps:
1. New staff member visits `/access-request` page
2. Fills form: Full Name, Email, Phone (optional), Password (min 6 chars)
3. Submits request
4. System stores request with 'pending' status
5. Staff member sees confirmation and redirected to login
6. Request awaits admin review

### 2. Admin Reviewing Requests

**URL**: `/dashboard` → Sidebar → Staff & Access Control (admin only)

Steps:
1. Admin sees "Pending Access Requests" section at top
2. Each request shows: Name, Email, Phone, Submit time
3. Admin can:
   - **Approve**: Creates user in Supabase Auth and staff_members record
   - **Decline**: Sets status to 'declined'
4. After approval, new staff member can log in with their email and password
5. They start with no page access (empty page_access table)

### 3. Admin Configuring Page Access

**URL**: `/dashboard` → Sidebar → Staff & Access Control (admin only)

Steps:
1. Admin finds staff member in "Staff Members" table
2. Clicks "Pencil" icon to edit
3. Modal opens showing all available pages:
   - Dashboard
   - Customers
   - Sessions (placeholder, not yet built)
   - Rooms
   - Inventory
   - Subscriptions
   - Transactions & Orders
   - Staff & Access Control (admin-only)
4. Admin checks/unchecks pages to grant/revoke access
5. Changes apply immediately

### 4. Staff Member Logging In

**URL**: `/login`

Steps:
1. Staff member enters email and password
2. System authenticates via Supabase Auth
3. Creates staff_members record (if not exists)
4. Logs them in
5. Sidebar only shows pages they have access to
6. Attempting to navigate to unauthorized pages redirects with error

## Access Control Rules

### Row Level Security (RLS)

All staff tables have RLS enabled:

**staff_members**:
- Staff can view their own record
- Admins can view and modify all records

**access_requests**:
- Anyone can submit a request
- Staff can view their own request
- Admins can view/approve/decline all requests

**page_access**:
- Staff can view their own access grants
- Admins can view and manage all access grants

### Admin vs Staff Role

| Permission | Admin | Staff |
|-----------|-------|-------|
| View Staff page | ✓ | ✗ |
| Create/approve/decline access requests | ✓ | ✗ |
| Manage staff roles | ✓ | ✗ |
| Grant/revoke page access | ✓ | ✗ |
| Delete staff members | ✓ | ✗ |
| Manage customers | ✓ | ✓* |
| Manage rooms | ✓ | ✓* |
| Manage inventory | ✓ | ✓* |
| Manage subscriptions | ✓ | ✓* |
| View transactions | ✓ | ✓* |

*Only if granted page access by admin

## API Endpoints

### Access Requests
- `submitAccessRequest(data)` - Submit new access request
- `listAccessRequests()` - List all requests (admin)
- `getPendingAccessRequests()` - Get pending requests (admin)
- `approveAccessRequest(requestId, adminStaffId)` - Approve and create user
- `declineAccessRequest(requestId, adminStaffId)` - Decline request

### Staff Members
- `listStaffMembers()` - List all staff (admin)
- `getCurrentStaffMember()` - Get current logged-in staff
- `updateStaffMember(staffId, updates)` - Update staff info (admin)
- `softDeleteStaffMember(staffId)` - Remove staff member (admin)

### Page Access
- `listPageAccess(staffId)` - List access for staff member
- `grantPageAccess(staffId, pagePath)` - Grant access to page
- `revokePageAccess(staffId, pagePath)` - Revoke access from page
- `checkPageAccess(staffId, pagePath)` - Check if staff has access

## Hooks

### useStaffAccess
```typescript
const { staff, loading, authorized } = useStaffAccess(requiredRole?)

// Options:
// requiredRole: "admin" | "staff" | undefined
// Returns:
// - staff: Current StaffMember or null
// - loading: Is still checking auth
// - authorized: Does user have required role
```

Used to protect pages and require specific roles.

## Configuration

### Default Admin

Bootstrap admin credentials:
- Email: `admin@zad.local`
- Password: `123123`
- Role: admin

### Environment Variables

No additional env vars needed. Uses existing Supabase config.

### Available Pages for Access Control

```
/dashboard
/customers
/sessions (reserved for future)
/rooms
/inventory
/subscriptions
/transactions
/staff (admin-only)
```

## Security Considerations

1. **Passwords**: Currently hashed with SHA-256 for request storage (should use bcrypt in production)
2. **Email Confirmation**: Should implement email verification before account activation
3. **Audit Logging**: Review/approval actions are stored (reviewed_by, reviewed_at)
4. **Soft Delete**: All deletions are soft (marked deleted_at, not removed)
5. **RLS Policies**: All tables protected with strict RLS policies

## Future Enhancements

1. Email verification for access requests
2. Staff profile page for self-service info updates
3. Session logging (what each staff member did, when)
4. Bulk access grants to multiple staff
5. Access request templates/categories
6. Staff suspension (disable without deleting)
7. Password reset flow
8. Two-factor authentication
