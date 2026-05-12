"use client";
import { createClient } from "@/lib/supabase/client";
import type { Room } from "@/lib/types";

const sb = () => createClient();

export async function listRooms(): Promise<Room[]> {
  const { data, error } = await sb()
    .from("rooms")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Room[];
}

export type RoomInput = {
  name: string;
  description: string | null;
  capacity: number;
  hourly_prices: { hour: number; price: number }[];
  label_color: string;
};

export async function createRoom(input: RoomInput) {
  const { data, error } = await sb().from("rooms").insert(input).select().single();
  if (error) throw error;
  return data as Room;
}

export async function updateRoom(id: string, input: RoomInput) {
  const { data, error } = await sb()
    .from("rooms")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Room;
}

export async function softDeleteRoom(id: string) {
  const { error } = await sb()
    .from("rooms")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
