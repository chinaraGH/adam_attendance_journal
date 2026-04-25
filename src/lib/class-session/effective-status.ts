import { toZonedTime } from "date-fns-tz";

import { BISHKEK_TIME_ZONE, getBishkekNow } from "@/lib/time/bishkek-now";

export type ClassSessionStatusV2 = "scheduled" | "active" | "finished" | "auto_closed" | "cancelled";

export function getEffectiveClassSessionStatus(params: {
  startTime: Date;
  endTime: Date;
  openedAt: Date | null;
  status: string;
  statusV2: string | null;
  now?: Date;
}): ClassSessionStatusV2 {
  const nowBishkek = params.now ?? getBishkekNow();

  const stored =
    (params.statusV2 && params.statusV2.trim().toLowerCase()) ||
    (params.status && params.status.trim().toLowerCase());

  if (stored === "cancelled") return "cancelled";

  const startBishkek = toZonedTime(params.startTime, BISHKEK_TIME_ZONE);
  const endBishkek = toZonedTime(params.endTime, BISHKEK_TIME_ZONE);

  if (nowBishkek >= startBishkek && nowBishkek <= endBishkek) {
    return "active";
  }

  if (nowBishkek > endBishkek) {
    return params.openedAt ? "finished" : "auto_closed";
  }

  return "scheduled";
}

