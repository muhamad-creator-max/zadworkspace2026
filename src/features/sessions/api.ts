"use client";
import { createClient } from "@/lib/supabase/client";
import type { Room, Session, SessionSegment } from "@/lib/types";
import { priceForDuration } from "@/lib/pricing";
import { minutesBetween } from "@/lib/format";

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

/**
 * Switch a customer/subscriber to a different room mid-session.
 * Closes the current room's time segment (with price), updates room_id,
 * and appends the closed segment to session_segments.
 * Returns the updated session.
 */
export async function switchRoom(sessionId: string, newRoomId: string): Promise<Session> {
  const supabase = sb();

  // Fetch current session with room details
  const { data: session, error: se } = await supabase
    .from("sessions")
    .select("*, room:rooms(*), customer:customers(*), subscriber:subscribers(*, plan:plans(*))")
    .eq("id", sessionId)
    .single();
  if (se) throw se;
  if (session.status !== "active") throw new Error("Session is already closed");
  if (session.room_id === newRoomId) throw new Error("Already in that room");

  // Fetch the new room for its name
  const { data: newRoom, error: re } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", newRoomId)
    .single();
  if (re) throw re;

  const now = new Date().toISOString();
  const isSubscriber = !!session.subscriber_id;

  // Calculate time + price for the segment that just ended
  const segmentStart = session.session_segments?.length
    ? session.session_segments[session.session_segments.length - 1].ended_at  // not right — use last segment's end... actually use current room's segment start
    : session.started_at;

  // Determine start of the current room segment
  const currentSegmentStart: string =
    (session.session_segments as SessionSegment[])?.length > 0
      ? (() => {
          // The current segment started right after the last closed segment
          const last = (session.session_segments as SessionSegment[]).at(-1)!;
          return last.ended_at;
        })()
      : session.started_at;

  const durationMinutes = minutesBetween(currentSegmentStart, now);
  const price = isSubscriber ? 0 : priceForDuration(session.room, durationMinutes);

  const newSegment: SessionSegment = {
    room_id: session.room_id,
    room_name: session.room?.name ?? "Room",
    started_at: currentSegmentStart,
    ended_at: now,
    duration_minutes: durationMinutes,
    price,
  };

  const updatedSegments: SessionSegment[] = [
    ...((session.session_segments as SessionSegment[]) ?? []),
    newSegment,
  ];

  const { data: updated, error: ue } = await supabase
    .from("sessions")
    .update({
      room_id: newRoomId,
      session_segments: updatedSegments,
    })
    .eq("id", sessionId)
    .select("*, room:rooms(*), customer:customers(*), subscriber:subscribers(*, plan:plans(*))")
    .single();
  if (ue) throw ue;
  return updated as Session;
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
