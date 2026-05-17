"use client";
import { createClient } from "@/lib/supabase/client";
import type { StaffMember, AccessRequest, PageAccess } from "@/lib/types";
import { currentActor, logDeletion } from "@/lib/deleteLog";

const sb = () => createClient();

// ============ ACCESS REQUESTS ============
export async function submitAccessRequest(data: {
  email: string;
  name: string;
  password: string;
  phone?: string;
}): Promise<AccessRequest> {
  // Hash password (bcrypt would be ideal, but for demo using simple hash)
  const passwordHash = await hashPassword(data.password);

  const { data: req, error } = await sb()
    .from("access_requests")
    .insert({
      email: data.email,
      name: data.name,
      password_hash: passwordHash,
      phone: data.phone || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return req;
}

export async function listAccessRequests(): Promise<AccessRequest[]> {
  const { data, error } = await sb()
    .from("access_requests")
    .select("*")
    .is("deleted_at", null)
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getPendingAccessRequests(): Promise<AccessRequest[]> {
  const { data, error } = await sb()
    .from("access_requests")
    .select("*")
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function approveAccessRequest(
  requestId: string,
  adminStaffId: string
): Promise<{ request: AccessRequest; staffMember: StaffMember }> {
  const { data: req, error: reqError } = await sb()
    .from("access_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (reqError) throw reqError;
  if (!req) throw new Error("Request not found");

  // Create auth user via Supabase Admin API (this will need server-side action)
  // For now, we'll mark request as approved and handle user creation separately
  const { data: updated, error: updateError } = await sb()
    .from("access_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminStaffId,
    })
    .eq("id", requestId)
    .select()
    .single();

  if (updateError) throw updateError;

  // Create staff member record
  const { data: staff, error: staffError } = await sb()
    .from("staff_members")
    .insert({
      email: req.email,
      name: req.name,
      role: "staff",
      phone: req.phone,
    })
    .select()
    .single();

  if (staffError) throw staffError;

  return { request: updated, staffMember: staff };
}

export async function declineAccessRequest(
  requestId: string,
  adminStaffId: string
): Promise<AccessRequest> {
  const { data, error } = await sb()
    .from("access_requests")
    .update({
      status: "declined",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminStaffId,
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============ STAFF MEMBERS ============
export async function listStaffMembers(): Promise<StaffMember[]> {
  const { data, error } = await sb()
    .from("staff_members")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getCurrentStaffMember(): Promise<StaffMember | null> {
  const {
    data: { user },
  } = await sb().auth.getUser();
  console.log("[getCurrentStaffMember] auth user:", user?.id, user?.email);
  if (!user) return null;

  const { data, error } = await sb()
    .from("staff_members")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  console.log("[getCurrentStaffMember] staff result:", data, "error:", error?.message);
  if (error || !data) return null;
  return data;
}

export async function updateStaffMember(
  staffId: string,
  updates: { name?: string; phone?: string; role?: "admin" | "staff" }
): Promise<StaffMember> {
  const { data, error } = await sb()
    .from("staff_members")
    .update(updates)
    .eq("id", staffId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function softDeleteStaffMember(staffId: string): Promise<void> {
  const { data: member } = await sb().from("staff_members").select("*").eq("id", staffId).single();
  const deleted_by = await currentActor();
  const { error } = await sb()
    .from("staff_members")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", staffId);
  if (error) throw error;
  await logDeletion({
    entity_type: "staff_member",
    entity_id: staffId,
    entity_label: member?.name ?? null,
    snapshot: member,
    deleted_by,
  });
}

// ============ PAGE ACCESS ============
export async function listPageAccess(staffId: string): Promise<PageAccess[]> {
  const { data, error } = await sb()
    .from("page_access")
    .select("*")
    .eq("staff_id", staffId)
    .order("page_path", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function grantPageAccess(
  staffId: string,
  pagePath: string
): Promise<PageAccess> {
  const { data, error } = await sb()
    .from("page_access")
    .insert({ staff_id: staffId, page_path: pagePath })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function revokePageAccess(
  staffId: string,
  pagePath: string
): Promise<void> {
  const { error } = await sb()
    .from("page_access")
    .delete()
    .eq("staff_id", staffId)
    .eq("page_path", pagePath);

  if (error) throw error;
}

export async function checkPageAccess(
  staffId: string,
  pagePath: string
): Promise<boolean> {
  const staff = await getCurrentStaffMember();
  if (!staff) return false;

  // Admins have access to all pages
  if (staff.role === "admin") return true;

  const { data, error } = await sb()
    .from("page_access")
    .select("id")
    .eq("staff_id", staffId)
    .eq("page_path", pagePath)
    .single();

  if (error) return false;
  return !!data;
}

// ============ HELPERS ============
async function hashPassword(password: string): Promise<string> {
  // Simple hash for demo — in production use bcrypt
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
