"use client";
import { createClient } from "@/lib/supabase/client";
import { getCurrentStaffMember } from "@/features/staff/api";
import type { AttendanceEntry } from "@/lib/types";

const sb = () => createClient();

// Sign in: records a check-in at the current server time (now()) along with the
// money amount the staff started the shift with (bank_in, required).
export async function signIn(
  signName: string,
  bankIn: number
): Promise<AttendanceEntry> {
  const name = signName.trim();
  if (!name) throw new Error("Please type a sign name");
  if (!Number.isFinite(bankIn) || bankIn < 0)
    throw new Error("Please enter a valid Bank In amount");

  const me = await getCurrentStaffMember();

  const { data, error } = await sb()
    .from("attendance")
    .insert({
      sign_name: name,
      bank_in: bankIn,
      created_by: me?.id ?? null,
      // check_in defaults to now() in the DB — never set from the client.
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Check out: stamps the current time into check_out and records the money
// amount left before checkout (bank_out, required).
export async function checkOut(id: string, bankOut: number): Promise<void> {
  if (!Number.isFinite(bankOut) || bankOut < 0)
    throw new Error("Please enter a valid Bank Out amount");

  const { error } = await sb()
    .from("attendance")
    .update({ check_out: new Date().toISOString(), bank_out: bankOut })
    .eq("id", id)
    .is("check_out", null);
  if (error) throw error;
}

export async function softDeleteAttendance(id: string): Promise<void> {
  const { error } = await sb()
    .from("attendance")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// All attendance rows whose check_in falls within [from, to).
export async function listAttendanceBetween(
  from: Date,
  to: Date
): Promise<AttendanceEntry[]> {
  const { data, error } = await sb()
    .from("attendance")
    .select("*")
    .is("deleted_at", null)
    .gte("check_in", from.toISOString())
    .lt("check_in", to.toISOString())
    .order("check_in", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Search by sign name across all (non-deleted) rows. Returns most recent first.
export async function searchAttendance(query: string): Promise<AttendanceEntry[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await sb()
    .from("attendance")
    .select("*")
    .is("deleted_at", null)
    .ilike("sign_name", `%${q}%`)
    .order("check_in", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}
