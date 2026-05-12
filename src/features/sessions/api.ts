"use client";
import { createClient } from "@/lib/supabase/client";
import type { Room, Session } from "@/lib/types";

const sb = () => createClient();

export async function listActiveSessions() {
  const { data, error } = await sb()
    .from("sessions")
    .select(
      "*, room:rooms(*), customer:customers(*), subscriber:subscribers(*, plan:plans(*))"
    )
    .is("deleted_at", null)
    .eq("status", "active")
    .order("started_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Session[];
}

export async function startSession(opts: {
  room_id: string;
  customer_id?: string;
  subscriber_id?: string;
}) {
  if (!opts.customer_id && !opts.subscriber_id)
    throw new Error("customer_id or subscriber_id required");
  const { data, error } = await sb()
    .from("sessions")
    .insert({
      room_id: opts.room_id,
      customer_id: opts.customer_id ?? null,
      subscriber_id: opts.subscriber_id ?? null,
      status: "active",
      created_by: "admin",
    })
    .select(
      "*, room:rooms(*), customer:customers(*), subscriber:subscribers(*, plan:plans(*))"
    )
    .single();
  if (error) throw error;
  return data as Session;
}

export async function listRooms(): Promise<Room[]> {
  const { data, error } = await sb()
    .from("rooms")
    .select("*")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Room[];
}

export async function getSessionFull(id: string) {
  const { data, error } = await sb()
    .from("sessions")
    .select(
      "*, room:rooms(*), customer:customers(*), subscriber:subscribers(*, plan:plans(*))"
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Session;
}
