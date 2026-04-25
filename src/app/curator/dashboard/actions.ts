"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { processSickRequest, setAdministrativeAbsence } from "@/app/actions/curator-actions";

export async function getPendingSickAttendances() {
  const actor = await getCurrentUser();
  if (actor.role !== "CURATOR") {
    return { ok: false as const, error: "Недостаточно прав." };
  }

  const groupLinks = await prisma.userGroupCurator.findMany({
    where: { userId: actor.id, isActive: true, deletedAt: null },
    select: { groupId: true },
  });
  const groupIds = groupLinks.map((x) => x.groupId);
  if (groupIds.length === 0) {
    return { ok: true as const, items: [] as any[] };
  }

  const items = await prisma.attendance.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      statusV2: "B_PENDING",
      classSession: { groupId: { in: groupIds } },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      statusV2: true,
      updatedAt: true,
      student: { select: { id: true, name: true, gaudiId: true, group: { select: { id: true, name: true } } } },
      classSession: { select: { id: true, disciplineId: true, startTime: true, endTime: true, semester: { select: { isLocked: true } } } },
    },
  });

  return { ok: true as const, items };
}

export async function getCuratorGroupSummary() {
  const actor = await getCurrentUser();
  if (actor.role !== "CURATOR") {
    return { ok: false as const, error: "Недостаточно прав." };
  }

  const groupLinks = await prisma.userGroupCurator.findMany({
    where: { userId: actor.id, isActive: true, deletedAt: null },
    select: { groupId: true },
  });
  const groupIds = groupLinks.map((x) => x.groupId);
  if (groupIds.length === 0) {
    return { ok: true as const, rows: [] as any[] };
  }

  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds }, isActive: true, deletedAt: null },
    select: { id: true, name: true, _count: { select: { students: true } } },
    orderBy: { name: "asc" },
  });

  const groupIdToStudentsCount = new Map(groups.map((g) => [g.id, g._count.students]));

  const sessions = await prisma.classSession.findMany({
    where: { groupId: { in: groupIds }, isActive: true, deletedAt: null },
    select: { id: true, groupId: true, status: true, statusV2: true },
  });

  const sessionIds = sessions.map((s) => s.id);

  const attendedCount =
    sessionIds.length === 0
      ? 0
      : await prisma.attendance.count({
          where: {
            classSessionId: { in: sessionIds },
            isActive: true,
            deletedAt: null,
            statusV2: { in: ["P", "O"] },
          },
        });

  const nbCount =
    sessionIds.length === 0
      ? 0
      : await prisma.attendance.count({
          where: {
            classSessionId: { in: sessionIds },
            isActive: true,
            deletedAt: null,
            statusV2: "NB",
          },
        });

  const sickCount =
    sessionIds.length === 0
      ? 0
      : await prisma.attendance.count({
          where: {
            classSessionId: { in: sessionIds },
            isActive: true,
            deletedAt: null,
            statusV2: { in: ["B_PENDING", "B_CONFIRMED"] },
          },
        });

  // Per-group breakdown
  const attendanceAgg =
    sessionIds.length === 0
      ? []
      : await prisma.attendance.groupBy({
          by: ["classSessionId", "statusV2"],
          where: { classSessionId: { in: sessionIds }, isActive: true, deletedAt: null, statusV2: { not: null } },
          _count: { _all: true },
        });

  const sessionIdToGroupId = new Map(sessions.map((s) => [s.id, s.groupId]));
  const perGroup = new Map<
    string,
    { totalSessions: number; totalMarks: number; attended: number; nb: number; sick: number }
  >();

  for (const g of groups) {
    perGroup.set(g.id, { totalSessions: 0, totalMarks: 0, attended: 0, nb: 0, sick: 0 });
  }
  for (const s of sessions) {
    const rec = perGroup.get(s.groupId);
    if (rec) rec.totalSessions += 1;
  }
  for (const a of attendanceAgg) {
    const gid = sessionIdToGroupId.get(a.classSessionId);
    if (!gid) continue;
    const rec = perGroup.get(gid);
    if (!rec) continue;
    const c = a._count._all;
    rec.totalMarks += c;
    const st = (a.statusV2 ?? "").toUpperCase();
    if (st === "P" || st === "O") rec.attended += c;
    if (st === "NB") rec.nb += c;
    if (st === "B_PENDING" || st === "B_CONFIRMED") rec.sick += c;
  }

  const rows = groups.map((g) => {
    const rec = perGroup.get(g.id) ?? { totalSessions: 0, totalMarks: 0, attended: 0, nb: 0, sick: 0 };
    const denom = rec.totalMarks;
    const pct = denom > 0 ? Math.round((rec.attended / denom) * 1000) / 10 : 0;
    return {
      groupId: g.id,
      groupName: g.name,
      totalStudents: groupIdToStudentsCount.get(g.id) ?? 0,
      totalSessions: rec.totalSessions,
      attendancePct: pct,
      nbCount: rec.nb,
      sickCount: rec.sick,
    };
  });

  return {
    ok: true as const,
    rows,
    totals: {
      attendedCount,
      nbCount,
      sickCount,
    },
  };
}

export async function decideSickRequest(input: { attendanceId: string; decision: "confirm" | "reject" }) {
  return processSickRequest(input);
}

export async function setA(input: { attendanceId: string }) {
  return setAdministrativeAbsence(input);
}

export async function decideSickRequestForm(formData: FormData) {
  const attendanceId = formData.get("attendanceId");
  const decision = formData.get("decision");
  if (typeof attendanceId !== "string" || !attendanceId) {
    return;
  }
  if (decision !== "confirm" && decision !== "reject") {
    return;
  }
  await decideSickRequest({ attendanceId, decision });
}

export async function setAForm(formData: FormData) {
  const attendanceId = formData.get("attendanceId");
  if (typeof attendanceId !== "string" || !attendanceId) {
    return;
  }
  await setA({ attendanceId });
}

