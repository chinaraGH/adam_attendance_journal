import { toZonedTime } from "date-fns-tz";

import { BISHKEK_TIME_ZONE, getBishkekNow } from "@/lib/time/bishkek-now";
import { getEffectiveClassSessionStatus } from "@/lib/class-session/effective-status";

/** Сколько минут после окончания занятия преподаватель ещё может исправить посещаемость. */
export const ATTENDANCE_GRACE_MINUTES = 10;

export function isAttendanceEditable(session: {
  startTime: Date;
  endTime: Date;
  openedAt: Date | null;
  status: string;
  statusV2: string | null;
  now?: Date;
}): boolean {
  const effective = getEffectiveClassSessionStatus(session);
  if (effective === "cancelled") return false;
  if (effective === "scheduled" || effective === "active") return true;

  const now = session.now ?? getBishkekNow();
  const end = toZonedTime(session.endTime, BISHKEK_TIME_ZONE);
  return now.getTime() <= end.getTime() + ATTENDANCE_GRACE_MINUTES * 60 * 1000;
}
