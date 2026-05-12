# 🚀 Get Started - Staff Management System

## In 5 Minutes, You'll Have Staff Management Running

### Step 1: Open Supabase (2 min)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your Zad Workspace project
3. Click **SQL Editor** in left sidebar
4. Click **New Query**

### Step 2: Copy & Paste Database Migration (1 min)

1. Open `supabase/staff_schema.sql` in your project
2. **Copy the ENTIRE file** (Ctrl+A, Ctrl+C)
3. Paste into Supabase SQL Editor
4. Click **Run** button (blue)
5. Wait for completion (should show green checkmark)

✅ **Database is now set up!**

### Step 3: Test the System (2 min)

#### Test 1: Request Access
1. Open `http://localhost:3000/access-request`
2. Fill the form:
   - Name: `Test User`
   - Email: `test@example.com`
   - Password: `password123`
3. Click **Submit Request**
4. ✅ See success message

#### Test 2: Approve Request
1. Log in: username `admin`, password `123123`
2. Click **Staff** link in sidebar (new!)
3. Click **Approve** on the request
4. ✅ See success toast

#### Test 3: Configure Access
1. Find "Test User" in staff table
2. Click the pencil icon
3. Check: Customers, Rooms, Inventory
4. Click **Close**
5. ✅ See success toast

#### Test 4: Login as New Staff
1. Click **Sign out** button
2. Log in as: email `test@example.com`, password `password123`
3. ✅ Sidebar shows only: Customers, Rooms, Inventory
4. ✅ Missing: Dashboard, Subscriptions, Transactions

**All tests pass? You're done! 🎉**

---

## 📚 If You Want to Learn More

- **Quick reference**: [STAFF_SETUP.md](STAFF_SETUP.md)
- **Architecture**: [STAFF_VISUAL_GUIDE.md](STAFF_VISUAL_GUIDE.md)
- **Full details**: [docs/STAFF_SYSTEM.md](docs/STAFF_SYSTEM.md)
- **What was built**: [BUILD_COMPLETE.md](BUILD_COMPLETE.md)

---

## ❓ Something Went Wrong?

### "SQL error when running migration"
- Make sure you copied the ENTIRE file
- Check you selected the correct Supabase project
- Try running smaller sections individually

### "Can't see /staff page as admin"
- Make sure you're logged in as admin (admin / 123123)
- Check that default admin was created (see below)

### "Can't approve requests"
- Verify you're logged in as admin
- Check that you see "Staff" in the sidebar

### Need more help?
See **IMMEDIATE_SETUP.md** troubleshooting section (detailed solutions)

---

## 🎯 What You Can Do Now

### As Admin
- ✅ View pending access requests
- ✅ Approve staff members
- ✅ Manage page access control
- ✅ Delete staff members

### As Staff
- ✅ Request access (public form)
- ✅ Log in with email/password
- ✅ See only authorized pages
- ✅ Use the coworking system

---

## 📋 Default Admin Credentials

```
Email:    admin@zad.local
Password: 123123
```

---

## ✨ System Features

After running the migration, you have:

✅ **Access Request Page** (`/access-request`)
   - Anyone can submit a request
   - Form: name, email, phone, password

✅ **Staff Management Page** (`/staff`)
   - Admin-only dashboard
   - Approve/decline requests
   - Manage page access
   - Delete staff members

✅ **Page Access Control**
   - Admin grants pages per staff
   - 8 pages available
   - Sidebar auto-hides unauthorized pages
   - Changes apply immediately

✅ **Secure Login**
   - Email/password authentication
   - Role-based permissions
   - Database-level security (RLS)

---

## 🔒 Security

✅ Passwords are hashed
✅ Only approved staff can log in
✅ Admin-only pages protected
✅ Database enforces security (RLS)
✅ Soft delete everywhere (no data loss)

---

## 📊 After Setup

Your system now has:

| Users | Can Do |
|-------|--------|
| Admin | Manage staff, approve requests, control access |
| Staff | Request access, use authorized pages |
| Public | Request access, view login page |

---

## 🎓 Next Steps

1. ✅ Run database migration (you are here)
2. ✅ Test all 4 scenarios (above)
3. Create your first staff members!
4. Deploy to production (no changes needed)

---

## 📞 Need Help?

**Quick issues**: See IMMEDIATE_SETUP.md troubleshooting  
**API reference**: See docs/STAFF_SYSTEM.md  
**Architecture**: See STAFF_VISUAL_GUIDE.md  
**Full overview**: See BUILD_COMPLETE.md  

---

**Status**: ✅ Ready to deploy  
**Time to setup**: ~5 minutes  
**Time to full mastery**: ~30 minutes  

Start with the SQL migration above! 🚀
