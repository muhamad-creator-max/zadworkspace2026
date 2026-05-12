# Immediate Setup - Copy & Paste

## Step 1: Run Database Migration

**⚠️ Important**: Copy the ENTIRE contents of `supabase/staff_schema.sql` and run it in Supabase SQL Editor.

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Paste the entire contents of `supabase/staff_schema.sql`
6. Click **Run**
7. Wait for completion (should show no errors)

**If you get errors**: 
- Make sure you already ran the main `supabase/schema.sql` first (for the main app tables)
- Check that the database is the correct one
- Verify auth.users table exists (should be default in Supabase)

## Step 2: Test the System

### Test 1: Request Access (as Public User)

1. Open browser to: `http://localhost:3000/access-request`
2. Fill form:
   - Name: `Test User`
   - Email: `test@example.com`
   - Phone: `01012345678` (optional)
   - Password: `password123`
3. Click **Submit Request**
4. See success message: "Request Submitted"
5. Redirected to login page

✅ Success: Access request created

### Test 2: Approve Request (as Admin)

1. Log in as admin: 
   - Username: `admin`
   - Password: `123123`
2. Click **Staff** in sidebar (new link)
3. See **Pending Access Requests** section
4. Find "Test User" request
5. Click **Approve** button
6. See toast: "Approved test@example.com"
7. See new staff member in **Staff Members** table

✅ Success: Staff member created

### Test 3: Grant Page Access (as Admin)

1. In **Staff Members** table, find "Test User"
2. Click **Pencil** icon
3. Modal opens: "Manage access for Test User"
4. See 8 pages with checkboxes:
   - Dashboard
   - Customers
   - Rooms
   - Inventory
   - Subscriptions
   - Transactions & Orders
   - Staff & Access Control (admin-only, can't toggle)
5. Check: Customers, Rooms, Inventory
6. Uncheck: Dashboard, Subscriptions, Transactions
7. Click **Close**
8. See toast: "Access updated"

✅ Success: Page access configured

### Test 4: Login as New Staff

1. Log out (click Sign out in sidebar)
2. Log in with new staff:
   - Username: `test@example.com`
   - Password: `password123`
3. Verify sidebar shows ONLY:
   - Customers ✓
   - Rooms ✓
   - Inventory ✓
4. Verify sidebar does NOT show:
   - Dashboard ✗
   - Subscriptions ✗
   - Transactions ✗
   - Staff ✗ (admin-only)
5. Try clicking one of the hidden pages → redirects with error

✅ Success: Page access control working

## Step 3: Verify Everything Works

Run all tests above in order. If all pass, the system is ready to use!

### Checklist

- [ ] Database migration ran without errors
- [ ] Admin can see `/staff` page
- [ ] Can submit access request
- [ ] Admin can approve/decline requests
- [ ] Admin can manage page access in modal
- [ ] New staff sees only granted pages
- [ ] Sidebar hides unauthorized pages
- [ ] Cannot access unauthorized pages directly

## Troubleshooting

### Issue: "Cannot find 'staff_schema.sql'"

**Solution**: The file is in `supabase/staff_schema.sql` in your project directory. If you don't see it, it wasn't created. Contact support.

### Issue: SQL Error "Relation staff_members does not exist"

**Solution**: The migration didn't run. Make sure you:
1. Copied the ENTIRE file contents
2. Selected correct Supabase project
3. Got no errors when running

Try running each SQL section individually to find which fails.

### Issue: Admin can't see Staff page

**Solution**: Check that:
1. You're logged in as admin (admin / 123123)
2. `staff_members` table has a record for this user with `role='admin'`
3. The sidebar is showing other admin links (Dashboard, etc.)

### Issue: "Access denied" on `/staff` page

**Solution**: The user's staff record doesn't have `role='admin'`. Fix:
```sql
-- In Supabase SQL Editor:
UPDATE staff_members 
SET role = 'admin' 
WHERE email = 'admin@zad.local';
```

### Issue: New staff can't log in

**Solution**: Check that:
1. User was created in Supabase Auth (go to Auth > Users)
2. Email matches exactly (case-sensitive)
3. `staff_members` table has matching record
4. User hasn't been soft-deleted (`deleted_at IS NULL`)

### Issue: Page access not working

**Solution**: 
1. Clear browser cache: Ctrl+Shift+Delete
2. Log out completely
3. Log back in
4. Check that `page_access` table has records:
   ```sql
   SELECT * FROM page_access WHERE staff_id = '...';
   ```

## System Status

After successful setup:

✅ Staff can request access at `/access-request`  
✅ Admins can manage access at `/staff`  
✅ Page access control working  
✅ Sidebar shows only authorized pages  
✅ Ready for production use (with optional enhancements)

## What You Can Do Now

### As Admin
- [ ] Visit `/staff` page
- [ ] Approve/decline access requests
- [ ] Manage which pages staff can access
- [ ] Soft-delete staff members

### As Staff (after approval)
- [ ] Log in with email/password
- [ ] See only authorized pages
- [ ] Use the system normally
- [ ] Cannot see/access unauthorized pages

## Next Steps

1. ✅ Run database migration (you are here)
2. ✅ Test all flows (above)
3. Optional: Upgrade password hashing to bcrypt (see `BUILD_COMPLETE.md`)
4. Optional: Add email verification (see `docs/STAFF_SYSTEM.md`)
5. Deploy to production

## Questions?

See detailed documentation:
- **Quick start**: `STAFF_SETUP.md`
- **Visual guide**: `STAFF_VISUAL_GUIDE.md`
- **Full docs**: `docs/STAFF_SYSTEM.md`
- **Implementation**: `STAFF_IMPLEMENTATION_SUMMARY.md`

---

**Status**: Staff management system ready to deploy 🚀
