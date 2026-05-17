"use client";
import { createClient } from "@/lib/supabase/client";
import type { Item, ItemCategory } from "@/lib/types";
import { currentActor, logDeletion } from "@/lib/deleteLog";

const sb = () => createClient();

export const CATEGORIES: ItemCategory[] = ["Snack", "Drink", "Product", "Service"];

export async function listItems(): Promise<Item[]> {
  const { data, error } = await sb()
    .from("items")
    .select("*")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Item[];
}

export type ItemInput = {
  name: string;
  price: number;
  category: ItemCategory;
  stock: number;
};

export async function createItem(input: ItemInput) {
  const { data, error } = await sb().from("items").insert(input).select().single();
  if (error) throw error;
  // Record initial stock as a movement
  if (input.stock > 0) {
    await sb().from("stock_movements").insert({
      item_id: data.id,
      quantity: input.stock,
      reason: "initial",
    });
  }
  return data as Item;
}

export async function updateItem(id: string, input: Partial<ItemInput>) {
  const { data, error } = await sb()
    .from("items")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Item;
}

export async function softDeleteItem(id: string) {
  const { data: item } = await sb().from("items").select("*").eq("id", id).single();
  const deleted_by = await currentActor();
  const { error } = await sb()
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await logDeletion({
    entity_type: "inventory_item",
    entity_id: id,
    entity_label: item?.name ?? null,
    entity_amount: item?.price != null ? Number(item.price) : null,
    snapshot: item,
    deleted_by,
  });
}

export async function restockItem(item: Item, quantity: number) {
  if (quantity <= 0) throw new Error("Quantity must be positive");
  const supabase = sb();
  const { error: e1 } = await supabase
    .from("items")
    .update({ stock: item.stock + quantity })
    .eq("id", item.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("stock_movements").insert({
    item_id: item.id,
    quantity,
    reason: "restock",
  });
  if (e2) throw e2;
}
