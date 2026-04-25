import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getBishkekNow } from "@/lib/time/bishkek-now";

export async function GET() {
  const actor = await getCurrentUser();
  if (actor.role !== "TEACHER") {
    return NextResponse.json({ ok: false, error: "Недостаточно прав." }, { status: 403 });
  }

  const now = getBishkekNow();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const classes = await prisma.classSession.findMany({
    where: {
      teacherId: actor.id,
      isActive: true,
      deletedAt: null,
      startTime: { gte: start, lt: end },
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

