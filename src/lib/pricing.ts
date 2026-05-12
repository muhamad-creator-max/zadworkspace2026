import type { Room } from "./types";

/**
 * Compute session price from a room's hourly_prices schedule.
 * - Rounds UP to the nearest hour for billing fairness.
 * - Hours past 12 use the hour-12 price + per-hour overflow rate (12h - 11h).
 */
export function priceForDuration(room: Room, minutes: number): number {
  const prices = [...(room.hourly_prices ?? [])].sort((a, b) => a.hour - b.hour);
  if (!prices.length) return 0;
  const hours = Math.max(1, Math.ceil(minutes / 60));
  if (hours <= prices.length) {
    return Number(prices.find((p) => p.hour === hours)?.price ?? prices[prices.length - 1].price);
  }
  const last = prices[prices.length - 1];
  const prev = prices[prices.length - 2] ?? { price: 0 };
  const overflow = Number(last.price) - Number(prev.price);
  return Number(last.price) + overflow * (hours - prices.length);
}
