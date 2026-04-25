import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const LOW_ATTENDANCE_THRESHOLD = 70;

export async function GET() {
  const groups = await prisma.group.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  if (groups.length === 0) {
    return NextResponse.json({
      ok: true,
      threshold: LOW_ATTENDANCE_THRESHOLD,
      problemGroups: [],
      topGroups: [],
    });
  }

  const groupIds = groups.map((g) => g.id);

  const totalBySession = await prisma.attendance.groupBy({
    by: ["classSessionId"],
    where: {
      isActive: true,
      deletedAt: null,
      statusV2: { not: null },
      classSession: { groupId: { in: groupIds }, isActive: true, deletedAt: null },
    },
    _count: { _all: true },
  });

  // Aggregate totals per group via session->group lookup (single query to fetch mapping).
  const sessions = await prisma.classSession.findMany({
    where: { groupId: { in: groupIds }, isActive: true, deletedAt: null },
    select: { id: true, groupId: true },
  });
  const sessionToGroup = new Map(sessions.map((s) => [s.id, s.groupId]));

  const denomByGroup = new Map<string, number>();
  for (const r of totalBySession) {
    const gid = sessionToGroup.get(r.classSessionId);
    if (!gid) continue;
    denomByGroup.set(gid, (denomByGroup.get(gid) ?? 0) + r._count._all);
  }

  const attended = await prisma.attendance.groupBy({
    by: ["classSessionId"],
    where: {
      isActive: true,
      deletedAt: null,
      statusV2: { in: ["P", "O"] },
      classSession: { groupId: { in: groupIds }, isActive: true, deletedAt: null },
    },
    _count: { _all: true },
  });

  const numerByGroup = new Map<string, number>();
  for (const r of attended) {
    const gid = sessionToGroup.get(r.classSessionId);
    if (!gid) continue;
    numerByGroup.set(gid, (numerByGroup.get(gid) ?? 0) + r._count._all);
  }

  const scored = groups.map((g) => {
      const denom = denomByGroup.get(g.id) ?? 0;
      const numer = numerByGroup.get(g.id) ?? 0;
      const pct = denom > 0 ? Math.round((numer / denom) * 1000) / 10 : 0;
      return { groupId: g.id, name: g.name, code: g.code, attendancePct: pct, totalMarks: denom };
    });

  const problemGroups = scored.filter((g) => g.totalMarks > 0 && g.attendancePct < LOW_ATTENDANCE_THRESHOLD);
  const topGroups = scored
    .filter((g) => g.totalMarks > 0)
    .sort((a, b) => b.attendancePct - a.attendancePct)
    .slice(0, 5);

  return NextResponse.json({ ok: true, threshold: LOW_ATTENDANCE_THRESHOLD, problemGroups, topGroups });
}

