"use server";
import { createClient } from "@supabase/supabase-js";

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function approveAccessRequestAction(
  requestId: string,
  adminStaffId: string
): Promise<{ staffMember: any; request: any; error?: string }> {
  try {
    const sb = createServiceClient();

    const { data: req, error: reqError } = await sb
      .from("access_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (reqError || !req) return { error: "Request not found", staffMember: null, request: null };

    const { data: authData, error: authError } = await sb.auth.admin.createUser({
      email: req.email,
      password: req.password_hash,
      email_confirm: true,
    });
    if (authError) return { error: authError.message, staffMember: null, request: null };

    const { data: updated, error: updateError } = await sb
      .from("access_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: adminStaffId })
      .eq("id", requestId)
      .select()
      .single();
    if (updateError) return { error: updateError.message, staffMember: null, request: null };

    const { data: staff, error: staffError } = await sb
      .from("staff_members")
      .insert({
        user_id: authData?.user?.id ?? null,
        email: req.email,
        name: req.name,
        role: "staff",
        phone: req.phone,
      })
      .select()
      .single();
    if (staffError) return { error: staffError.message, staffMember: null, request: null };

    return { request: updated, staffMember: staff };
  } catch (e: any) {
    return { error: e.message ?? "Unknown error", staffMember: null, request: null };
  }
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function submitAccessRequestAction(data: {
  username: string;
  password: string;
  phone?: string;
}): Promise<{ error?: string }> {
  try {
    const sb = createServiceClient();
    const email = `${data.username}@zad.local`;

    const { data: existing } = await sb
      .from("access_requests")
      .select("id")
      .eq("email", email)
      .limit(1);
    if (existing && existing.length > 0) return { error: "Username already taken" };

    const { data: existingStaff } = await sb
      .from("staff_members")
      .select("id")
      .eq("email", email)
      .limit(1);
    if (existingStaff && existingStaff.length > 0) return { error: "Username already taken" };

    const { error } = await sb.from("access_requests").insert({
      email,
      name: data.username,
      password_hash: data.password,
      phone: data.phone || null,
      status: "pending",
    });

    if (error) return { error: error.message };
    return {};
  } catch (e: any) {
    return { error: e.message ?? "Unknown error" };
  }
}
