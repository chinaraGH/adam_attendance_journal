import { differenceInMilliseconds } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/** IANA zone for Adam University (UTC+6, no DST). */
export const BISHKEK_TIME_ZONE = "Asia/Bishkek";

const LATE_THRESHOLD_MS = 15 * 60 * 1000;

/**
 * Late rule per TZ: if server time in Bishkek is > 15 minutes after class start,
 * "PRESENT" is automatically replaced with "LATE".
 *
 * We compare using Bishkek zoned time (UTC+6) to match business rules, but the threshold
 * is time-zone invariant as long as `sessionStart` is the correct instant.
 */
export function resolveAttendanceStatusWithBishkekLateRule(params: {
  sessionStart: Date;
  markTime: Date;
  requestedStatus: string;
}): string {
  const { sessionStart, markTime, requestedStatus } = params;

  if (requestedStatus !== "PRESENT") {
    return requestedStatus;
  }

  const sessionStartBishkek = toZonedTime(sessionStart, BISHKEK_TIME_ZONE);
  const markTimeBishkek = toZonedTime(markTime, BISHKEK_TIME_ZONE);
  const elapsedMs = differenceInMilliseconds(markTimeBishkek, sessionStartBishkek);
  if (elapsedMs > LATE_THRESHOLD_MS) {
    return "LATE";
  }

  return "PRESENT";
}
