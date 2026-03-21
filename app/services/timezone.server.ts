// Laos timezone offset (UTC+7)
const LAO_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Parse a date string from datetime-local input as Laos time (UTC+7).
 * datetime-local sends naive datetime like "2026-03-21T00:00" without timezone.
 * new Date() would parse this as server time (UTC), but the user means Laos time.
 * This function subtracts 7 hours so the resulting UTC date matches the intended Laos moment.
 */
export function parseLaoDate(dateStr: string): Date {
  const d = new Date(dateStr);
  if (dateStr.includes("T")) {
    // datetime-local value: treat as Laos time → convert to UTC
    return new Date(d.getTime() - LAO_OFFSET_MS);
  }
  // date-only value: keep as-is (date boundaries are already midnight UTC)
  return d;
}

export { LAO_OFFSET_MS };
