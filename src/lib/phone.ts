/**
 * Phone number normalization used by the Customer Services integration
 * (/api/internal/check-active-session). Staff type phones as free text, so
 * both the stored value and the incoming value are normalized before comparing.
 *
 * Canonical forms:
 *   - Egyptian mobiles  → local 11-digit form, e.g. "01012345678"
 *   - Other countries   → E.164, e.g. "+966501234567" (must be typed with + or 00)
 *
 * The Zad Customer Services app ships an identical copy of this logic
 * (src/lib/phone.ts there) so both sides compare the same canonical value.
 * Keep the two files in sync.
 */

export type PhoneParseResult =
  | { ok: true; phone: string; kind: "eg-mobile" | "international" }
  | { ok: false; reason: "empty" | "invalid" };

const EGYPT_MOBILE = /^01[0125]\d{8}$/;
const ALLOWED_CHARACTERS = /^\+?[\d\s\-().]+$/;

/** Converts Arabic-Indic (٠-٩) and Persian (۰-۹) digits to ASCII. */
function toAsciiDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

export function parsePhone(input: unknown): PhoneParseResult {
  if (typeof input !== "string") return { ok: false, reason: "empty" };

  // Strip invisible direction marks that phones insert when copying numbers.
  const value = toAsciiDigits(input)
    .replace(/[‎‏‪-‮⁦-⁩]/g, "")
    .trim();
  if (!value) return { ok: false, reason: "empty" };
  if (!ALLOWED_CHARACTERS.test(value)) return { ok: false, reason: "invalid" };

  let digits = value.replace(/\D/g, "");
  let international = value.startsWith("+");
  if (!international && digits.startsWith("00")) {
    digits = digits.slice(2);
    international = true;
  }

  let national: string | null = null;
  if (international) {
    if (digits.startsWith("20")) national = digits.slice(2);
  } else if (digits.length === 12 && digits.startsWith("20")) {
    national = digits.slice(2); // 201012345678
  } else {
    national = digits; // 01012345678 or 1012345678
  }

  if (national !== null) {
    if (national.length === 10 && national.startsWith("1")) national = `0${national}`;
    return EGYPT_MOBILE.test(national)
      ? { ok: true, phone: national, kind: "eg-mobile" }
      : { ok: false, reason: "invalid" };
  }

  // Non-Egyptian number written with an explicit country code.
  if (digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0")) {
    return { ok: true, phone: `+${digits}`, kind: "international" };
  }
  return { ok: false, reason: "invalid" };
}

export function normalizePhone(input: unknown): string | null {
  const result = parsePhone(input);
  return result.ok ? result.phone : null;
}

/** "01012345678" → "010 1234 5678". International numbers are shown as stored. */
export function formatPhone(phone: string): string {
  if (EGYPT_MOBILE.test(phone)) {
    return `${phone.slice(0, 3)} ${phone.slice(3, 7)} ${phone.slice(7)}`;
  }
  return phone;
}
