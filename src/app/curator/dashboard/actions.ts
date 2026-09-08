"use server";

import { formatInTimeZone } from "date-fns-tz";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { BISHKEK_TIME_ZONE } from "@/lib/time/bishkek-now";
import { processSickRequest, setAdministrativeAbsence } from "@/app/actions/curator-actions";

export type CuratorSickSemesterRow = {
  attendanceId: string;
  rowKind: "pending" | "confirmed" | "rejected_nb";
  statusV2: string | null;
  status: string | null;
  updatedAt: Date;
  exemptionsDateYmd: string;
  student: {
    id: string;
    name: string;
    group: { id: string; name: string };
  };
  classSession: {
    id: string;
    disciplineId: string;
    startTime: Date;
    endTime: Date;
    discipline: { name: string | null } | null;
    semester: { isLocked: boolean } | null;
  };
};

/** Блокирующие статусы за семестр: B_PENDING, B_CONFIRMED и отклонённые Б (NB после sick_reject в audit). Без изменения бизнес-правил записи. */
export async function getCuratorSickSemesterOverview(): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      semesterName: string | null;
      semesterEndDate: Date | null;
      semesterLocked: boolean;
      rows: CuratorSickSemesterRow[];
    }
> {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "CURATOR") {
    return { ok: false, error: "Недостаточно прав." };
  }

  const groupLinks = await prisma.userGroupCurator.findMany({
    where: { userId: actor.id, isActive: true, deletedAt: null },
    select: { groupId: true },
  });
  const groupIds = groupLinks.map((x) => x.groupId);
  if (groupIds.length === 0) {
    return {
      ok: true,
      semesterName: null,
      semesterEndDate: null,
      semesterLocked: false,
      rows: [],
    };
  }

  const semester =
    (await prisma.semester.findFirst({
      where: { isLocked: false },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, endDate: true, isLocked: true },
    })) ??
    (await prisma.semester.findFirst({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, endDate: true, isLocked: true },
    }));

  if (!semester) {
    return {
      ok: true,
      semesterName: null,
      semesterEndDate: null,
      semesterLocked: false,
      rows: [],
    };
  }

  const sessions = await prisma.classSession.findMany({
    where: {
      groupId: { in: groupIds },
      semesterId: semester.id,
      isActive: true,
      deletedAt: null,
      NOT: [{ statusV2: "cancelled" }, { status: "cancelled" }],
    },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length === 0) {
    return {
      ok: true,
      semesterName: semester.name,
      semesterEndDate: semester.endDate,
      semesterLocked: semester.isLocked,
      rows: [],
    };
  }

  const attendanceSelect = {
    id: true,
    statusV2: true,
    status: true,
    updatedAt: true,
    student: { select: { id: true, name: true, group: { select: { id: true, name: true } } } },
    classSession: {
      select: {
        id: true,
        disciplineId: true,
        startTime: true,
        endTime: true,
        discipline: { select: { name: true } },
        semester: { select: { isLocked: true } },
      },
    },
  } as const;

  const direct = await prisma.attendance.findMany({
    where: {
      classSessionId: { in: sessionIds },
      isActive: true,
      deletedAt: null,
      statusV2: { in: ["B_PENDING", "B_CONFIRMED"] },
    },
    orderBy: { updatedAt: "desc" },
    select: attendanceSelect,
  });

  const scopeAttendanceIds = (
    await prisma.attendance.findMany({
      where: { classSessionId: { in: sessionIds }, isActive: true, deletedAt: null },
      select: { id: true },
    })
  ).map((x) => x.id);

  const rejectAudits =
    scopeAttendanceIds.length === 0
      ? []
      : await prisma.auditTrail.findMany({
          where: {
            action: "sick_reject",
            entityType: "Attendance",
            entityId: { in: scopeAttendanceIds },
          },
          select: { entityId: true },
        });

  const rejectedIds = [...new Set(rejectAudits.map((a) => a.entityId))];

  const rejectedRows =
    rejectedIds.length === 0
      ? []
      : await prisma.attendance.findMany({
          where: {
            id: { in: rejectedIds },
            classSessionId: { in: sessionIds },
            isActive: true,
            deletedAt: null,
          },
          orderBy: { updatedAt: "desc" },
          select: attendanceSelect,
        });

  const byId = new Map<string, CuratorSickSemesterRow>();

  for (const a of direct) {
    const ymd = formatInTimeZone(a.classSession.startTime, BISHKEK_TIME_ZONE, "yyyy-MM-dd");
    byId.set(a.id, {
      attendanceId: a.id,
      rowKind: a.statusV2 === "B_PENDING" ? "pending" : "confirmed",
      statusV2: a.statusV2,
      status: a.status,
      updatedAt: a.updatedAt,
      exemptionsDateYmd: ymd,
      student: a.student,
      classSession: a.classSession,
    });
  }

  for (const a of rejectedRows) {
    if (byId.has(a.id)) continue;
    const ymd = formatInTimeZone(a.classSession.startTime, BISHKEK_TIME_ZONE, "yyyy-MM-dd");
    byId.set(a.id, {
      attendanceId: a.id,
      rowKind: "rejected_nb",
      statusV2: a.statusV2,
      status: a.status,
      updatedAt: a.updatedAt,
      exemptionsDateYmd: ymd,
      student: a.student,
      classSession: a.classSession,
    });
  }

  const rows = [...byId.values()].sort((x, y) => y.updatedAt.getTime() - x.updatedAt.getTime());

  return {
    ok: true,
    semesterName: semester.name,
    semesterEndDate: semester.endDate,
    semesterLocked: semester.isLocked,
    rows,
  };
}

export async function getPendingSickAttendances() {
  const actor = await getCurrentUserOrRedirect();
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
      classSession: {
        select: {
          id: true,
          disciplineId: true,
          startTime: true,
          endTime: true,
          discipline: { select: { name: true } },
          semester: { select: { isLocked: true } },
        },
      },
    },
  });

  return { ok: true as const, items };
}

export async function getCuratorGroupSummary() {
  const actor = await getCurrentUserOrRedirect();
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
    select: { id: true, groupId: true, startTime: true, status: true, statusV2: true },
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
      trend: "flat" as "up" | "down" | "flat",
    };
  });

  // Trend: last 7 days vs previous 7 days (by session.startTime).
  const now = new Date();
  const startLast = new Date(now);
  startLast.setDate(startLast.getDate() - 7);
  const startPrev = new Date(now);
  startPrev.setDate(startPrev.getDate() - 14);

  const lastWeekSessionIds = sessions.filter((s) => s.startTime >= startLast && s.startTime <= now).map((s) => s.id);
  const prevWeekSessionIds = sessions.filter((s) => s.startTime >= startPrev && s.startTime < startLast).map((s) => s.id);

  const aggWeek = async (ids: string[]) => {
    if (ids.length === 0) return new Map<string, { denom: number; numer: number }>();
    const total = await prisma.attendance.groupBy({
      by: ["classSessionId"],
      where: { classSessionId: { in: ids }, isActive: true, deletedAt: null, statusV2: { not: null } },
      _count: { _all: true },
    });
    const attended = await prisma.attendance.groupBy({
      by: ["classSessionId"],
      where: { classSessionId: { in: ids }, isActive: true, deletedAt: null, statusV2: { in: ["P", "O"] } },
      _count: { _all: true },
    });
    const denomByGroup = new Map<string, number>();
    for (const r of total) {
      const gid = sessionIdToGroupId.get(r.classSessionId);
      if (!gid) continue;
      denomByGroup.set(gid, (denomByGroup.get(gid) ?? 0) + r._count._all);
    }
    const numerByGroup = new Map<string, number>();
    for (const r of attended) {
      const gid = sessionIdToGroupId.get(r.classSessionId);
      if (!gid) continue;
      numerByGroup.set(gid, (numerByGroup.get(gid) ?? 0) + r._count._all);
    }
    const out = new Map<string, { denom: number; numer: number }>();
    for (const gid of groupIds) {
      out.set(gid, { denom: denomByGroup.get(gid) ?? 0, numer: numerByGroup.get(gid) ?? 0 });
    }
    return out;
  };

  const lastWeek = await aggWeek(lastWeekSessionIds);
  const prevWeek = await aggWeek(prevWeekSessionIds);

  const rowsWithTrend = rows.map((r) => {
    const lw = lastWeek.get(r.groupId) ?? { denom: 0, numer: 0 };
    const pw = prevWeek.get(r.groupId) ?? { denom: 0, numer: 0 };
    const lwPct = lw.denom > 0 ? lw.numer / lw.denom : null;
    const pwPct = pw.denom > 0 ? pw.numer / pw.denom : null;
    const trend =
      lwPct === null || pwPct === null ? "flat" : lwPct > pwPct ? "up" : lwPct < pwPct ? "down" : "flat";
    return { ...r, trend };
  });

  return {
    ok: true as const,
    rows: rowsWithTrend,
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

export async function getCuratorProblematicStudents() {
  const actor = await getCurrentUserOrRedirect();
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

  const semester =
    (await prisma.semester.findFirst({
      where: { isLocked: false },
      orderBy: { startDate: "desc" },
      select: { id: true, startDate: true, endDate: true },
    })) ??
    (await prisma.semester.findFirst({
      orderBy: { startDate: "desc" },
      select: { id: true, startDate: true, endDate: true },
    }));

  const problemAgg = await prisma.attendance.groupBy({
    by: ["studentId"],
    where: {
      isActive: true,
      deletedAt: null,
      statusV2: "NB",
      classSession: { 
        groupId: { in: groupIds },
        ...(semester ? { startTime: { gte: semester.startDate, lte: semester.endDate } } : {})
      }
    },
    _count: { _all: true },
    orderBy: { _count: { studentId: "desc" } },
    take: 15,
  });

  if (problemAgg.length === 0) {
    return { ok: true as const, items: [] as any[] };
  }

  const pIds = problemAgg.map(a => a.studentId);
  const students = await prisma.student.findMany({
    where: { id: { in: pIds } },
    select: { id: true, name: true, group: { select: { name: true } } }
  });
  const sMap = new Map(students.map(s => [s.id, s]));

  const items = problemAgg.map(a => {
    const s = sMap.get(a.studentId);
    return {
      studentId: a.studentId,
      studentName: s?.name ?? "—",
      groupName: s?.group?.name ?? "—",
      nbCount: a._count._all,
    };
  });

  return { ok: true as const, items };
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

