import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { BISHKEK_TIME_ZONE } from "@/lib/time/bishkek-now";

export function getBishkekDayRangeInstants(nowInstant: Date = new Date()) {
  const nowBishkek = toZonedTime(nowInstant, BISHKEK_TIME_ZONE);

  const startBishkek = new Date(nowBishkek);
  startBishkek.setHours(0, 0, 0, 0);

  const endBishkek = new Date(nowBishkek);
  endBishkek.setHours(23, 59, 59, 999);

  const startInstant = fromZonedTime(startBishkek, BISHKEK_TIME_ZONE);
  const endInstant = fromZonedTime(endBishkek, BISHKEK_TIME_ZONE);

  return { nowBishkek, startInstant, endInstant };
}

