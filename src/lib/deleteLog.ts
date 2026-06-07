"use client";
import { createClient } from "@/lib/supabase/client";
import { getCurrentStaffMember } from "@/features/staff/api";
import type { DeleteLogEntry } from "@/lib/types";

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

const ENTITY_TABLE: Record<string, string> = {
  invoice:        "invoices",
  session:        "sessions",
  customer:       "customers",
  subscriber:     "subscribers",
  plan:           "plans",
  room:           "rooms",
  inventory_item: "items",
  staff_member:   "staff_members",
  expense:        "expenses",
  income:         "incomes",
};

export type RestoreResult = {
  restored: string[];   // log entry IDs successfully restored
  failed: { id: string; entity_type: string; reason: string }[];
};

export async function restoreEntities(entries: DeleteLogEntry[]): Promise<RestoreResult> {
  const client = sb();
  const restored: string[] = [];
  const failed: RestoreResult["failed"] = [];

  await Promise.all(
    entries.map(async (entry) => {
      const table = ENTITY_TABLE[entry.entity_type];
      if (!table) {
        failed.push({ id: entry.id, entity_type: entry.entity_type, reason: "Unknown entity type" });
        return;
      }

      const { error } = await client
        .from(table)
        .update({ deleted_at: null })
        .eq("id", entry.entity_id);

      if (error) {
        failed.push({ id: entry.id, entity_type: entry.entity_type, reason: error.message });
        return;
      }

      // Remove the log entry so it doesn't show again
      await client.from("delete_log").delete().eq("id", entry.id);
      restored.push(entry.id);
    }),
  );

  return { restored, failed };
}
