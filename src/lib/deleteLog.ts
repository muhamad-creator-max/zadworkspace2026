"use client";
import { createClient } from "@/lib/supabase/client";
import { getCurrentStaffMember } from "@/features/staff/api";

const sb = () => createClient();

export async function currentActor(): Promise<string> {
  try {
    const staff = await getCurrentStaffMember();
    if (staff?.name) return staff.name;
    if (staff?.email) return staff.email;
  } catch {
    // fall through
  }
  return "admin";
}

export async function logDeletion(entry: {
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  entity_amount?: number | null;
  snapshot: unknown;
  deleted_by: string;
}): Promise<void> {
  const { error } = await sb().from("delete_log").insert({
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    entity_label: entry.entity_label,
    entity_amount: entry.entity_amount ?? null,
    snapshot: entry.snapshot,
    deleted_by: entry.deleted_by,
  });
  if (error) {
    console.error("[delete_log] failed:", error.message);
  }
}
