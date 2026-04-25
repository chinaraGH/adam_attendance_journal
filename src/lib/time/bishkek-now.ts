import { toZonedTime } from "date-fns-tz";

export const BISHKEK_TIME_ZONE = "Asia/Bishkek";

/**
 * Per TZ: server time is the single source of truth, and the system
 * operates in UTC+6 (Bishkek). We standardize comparisons using the
 * Bishkek wall-clock representation.
 */
export function getBishkekNow(): Date {
  return toZonedTime(new Date(), BISHKEK_TIME_ZONE);
}

