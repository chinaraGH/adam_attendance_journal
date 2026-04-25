import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getBishkekDayRangeInstants } from "@/lib/time/bishkek-day-range";

export async function GET() {
  let actor: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    actor = await getCurrentUser();
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (actor.role !== "TEACHER") {
    return NextResponse.json({ ok: false, error: "Недостаточно прав." }, { status: 403 });
  }

  const { startInstant, endInstant } = getBishkekDayRangeInstants();

  const classes = await prisma.classSession.findMany({
    where: {
      teacherId: actor.id,
      isActive: true,
      deletedAt: null,
      startTime: { gte: startInstant, lte: endInstant },
      NOT: [{ statusV2: "cancelled" }, { status: "cancelled" }],
    },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      groupId: true,
      disciplineId: true,
      teacherId: true,
      semesterId: true,
      startTime: true,
      endTime: true,
      openedAt: true,
      status: true,
      statusV2: true,
      group: { select: { id: true, name: true, code: true } },
      discipline: { select: { id: true, name: true, code: true } },
    },
  });

  return NextResponse.json({ ok: true, classes });
}

