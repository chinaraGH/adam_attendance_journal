import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import type { AttendanceStatusV2 } from "@/lib/attendance/status-machine";
import { normalizeAttendanceStatusV2 } from "@/lib/attendance/status-machine";

const LOW_ATTENDANCE_THRESHOLD = 70;

type StatusAgg = { P: number; O: number; NB: number; B: number; A: number; S: number; OTHER: number };

function emptyAgg(): StatusAgg {
  return { P: 0, O: 0, NB: 0, B: 0, A: 0, S: 0, OTHER: 0 };
}

function addToAgg(agg: StatusAgg, statusV2: string | null, n: number) {
  const c = normalizeAttendanceStatusV2(statusV2);
  if (!c) {
    agg.OTHER += n;
    return;
  }
  const canon = c as AttendanceStatusV2;
  if (canon === "P") agg.P += n;
  else if (canon === "O") agg.O += n;
  else if (canon === "NB") agg.NB += n;
  else if (canon === "B_PENDING" || canon === "B_CONFIRMED") agg.B += n;
  else if (canon === "A") agg.A += n;
  else if (canon === "S") agg.S += n;
  else agg.OTHER += n;
}

export const dynamic = "force-dynamic";

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

  const sessionStatusAgg = await prisma.attendance.groupBy({
    by: ["classSessionId", "statusV2"],
    where: {
      isActive: true,
      deletedAt: null,
      statusV2: { not: null },
      classSession: { groupId: { in: groupIds }, isActive: true, deletedAt: null },
    },
    _count: { _all: true },
  });

  const marksByGroup = new Map<string, StatusAgg>();
  for (const gid of groupIds) {
    marksByGroup.set(gid, emptyAgg());
  }
  for (const row of sessionStatusAgg) {
    const gid = sessionToGroup.get(row.classSessionId);
    if (!gid) continue;
    const agg = marksByGroup.get(gid)!;
    addToAgg(agg, row.statusV2, row._count._all);
  }

  const scored = groups.map((g) => {
    const denom = denomByGroup.get(g.id) ?? 0;
    const numer = numerByGroup.get(g.id) ?? 0;
    const pct = denom > 0 ? Math.round((numer / denom) * 1000) / 10 : 0;
    const m = marksByGroup.get(g.id) ?? emptyAgg();
    return {
      groupId: g.id,
      name: g.name,
      code: g.code,
      attendancePct: pct,
      totalMarks: denom,
      marksP: m.P,
      marksO: m.O,
      marksNb: m.NB,
      marksB: m.B,
      marksA: m.A,
      marksS: m.S,
      marksOther: m.OTHER,
    };
  });

  const problemGroups = scored.filter((g) => g.totalMarks > 0 && g.attendancePct < LOW_ATTENDANCE_THRESHOLD);
  const topGroups = scored
    .filter((g) => g.totalMarks > 0)
    .sort((a, b) => b.attendancePct - a.attendancePct)
    .slice(0, 5);
  const worstGroups = scored
    .filter((g) => g.totalMarks > 0)
    .sort((a, b) => a.attendancePct - b.attendancePct)
    .slice(0, 5);

  return NextResponse.json({ ok: true, threshold: LOW_ATTENDANCE_THRESHOLD, problemGroups, topGroups, worstGroups });
}

