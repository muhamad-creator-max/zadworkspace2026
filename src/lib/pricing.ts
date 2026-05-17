import type { Room } from "./types";

/**
 * Apply 15-minute buffer for customer sessions only.
 * Within the first 15 minutes of a new hour → round down.
 * Beyond 15 minutes into a new hour → round up.
 * Examples: 75 min → 1h, 76 min → 2h, 120 min → 2h, 135 min → 2h, 136 min → 3h
 */
export function applyCustomerBuffer(minutes: number): number {
  if (minutes <= 15) return 0; // free trial — under 15 min no charge
  const fullHours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return Math.max(1, fullHours);
  return Math.max(1, remainder <= 15 ? fullHours : fullHours + 1);
}

/**
 * Compute session price from a room's hourly_prices schedule.
 * - For customers: applies 15-min buffer (≤15 min grace rounds down, >15 min rounds up).
 * - For subscribers: not used (session price = 0).
 * - Hours past schedule use overflow rate from last two tiers.
 */
export function priceForDuration(room: Room, minutes: number): number {
  const prices = [...(room.hourly_prices ?? [])].sort((a, b) => a.hour - b.hour);
  if (!prices.length) return 0;
  const hours = applyCustomerBuffer(minutes);
  if (hours === 0) return 0; // under 15 min — free
  if (hours <= prices.length) {
    return Number(prices.find((p) => p.hour === hours)?.price ?? prices[prices.length - 1].price);
  }
  const last = prices[prices.length - 1];
  const prev = prices[prices.length - 2] ?? { price: 0 };
  const overflow = Number(last.price) - Number(prev.price);
  return Number(last.price) + overflow * (hours - prices.length);
}
