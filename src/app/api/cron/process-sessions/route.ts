import { NextResponse } from "next/server";
import { addMinutes } from "date-fns";

import { prisma } from "@/lib/prisma";
import { getBishkekNow } from "@/lib/time/bishkek-now";
import { lockSemesterAndConvertPendingToNb } from "@/lib/semester/lock-semester";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("x-cron-secret");
  if (header && header === secret) return true;

  const auth = request.headers.get("authorization");
  if (auth && auth === `Bearer ${secret}`) return true;

  return false;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const nowBishkek = getBishkekNow();
  const nowInstant = new Date();
  const inFiveMinutesInstant = addMinutes(nowInstant, 5);

  // 0) Expire old B_PENDING (>14 days after end_time) → NB.
  const fourteenDaysAgo = new Date(nowInstant);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const expired = await prisma.attendance.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      statusV2: "B_PENDING",
      classSession: { endTime: { lt: fourteenDaysAgo } },
    },
    take: 1000,
    select: { id: true, studentId: true, classSessionId: true, semesterId: true },
  });

  let bPendingExpired = 0;
  if (expired.length > 0) {
    const ids = expired.map((x) => x.id);
    const updated = await prisma.attendance.updateMany({
      where: { id: { in: ids } },
      data: { statusV2: "NB", status: "NB", updatedBy: "system:expired" },
    });
    bPendingExpired = updated.count;

    await prisma.auditTrail.createMany({
      data: expired.map((x) => ({
        actorType: "system",
        actorId: null,
        action: "sick_expired",
        entityType: "Attendance",
        entityId: x.id,
        beforeJson: JSON.stringify({ studentId: x.studentId, classSessionId: x.classSessionId, statusV2: "B_PENDING" }),
        afterJson: JSON.stringify({ studentId: x.studentId, classSessionId: x.classSessionId, statusV2: "NB", note: "System: Expired" }),
      })),
    });
  }

  // 0) Auto-lock semesters that passed endDate.
  const semestersToLock = await prisma.semester.findMany({
    where: { isLocked: false, endDate: { lt: nowInstant } },
    select: { id: true, endDate: true },
  });

  let semestersLocked = 0;
  let bPendingAutoRejected = 0;

  for (const sem of semestersToLock) {
    const r = await lockSemesterAndConvertPendingToNb({
      semesterId: sem.id,
      actorType: "system",
      actorId: null,
      nowInstant,
      nowBishkekIso: nowBishkek.toISOString(),
      reason: "auto",
    });
    if (r.ok && !r.alreadyLocked) {
      semestersLocked += 1;
      bPendingAutoRejected += r.convertedCount;
    }
  }

  // 1) Auto-close: ended sessions that were never opened.
  const autoCloseCandidates = await prisma.classSession.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      openedAt: null,
      endTime: { lt: nowInstant },
      NOT: [{ statusV2: "cancelled" }, { status: "cancelled" }],
    },
    select: { id: true, groupId: true, statusV2: true, status: true },
  });

  let sessionsAutoClosed = 0;
  let attendanceNullToS = 0;
  const auditIds: string[] = [];

  for (const s of autoCloseCandidates) {
    const before = (s.statusV2 ?? s.status ?? null) as string | null;
    if (before !== "auto_closed") {
      await prisma.classSession.update({
        where: { id: s.id },
        data: { statusV2: "auto_closed", status: "auto_closed" },
        select: { id: true },
      });
      sessionsAutoClosed += 1;

      const audit = await prisma.auditTrail.create({
        data: {
          actorType: "system",
          actorId: null,
          action: "session_auto_close",
          entityType: "ClassSession",
          entityId: s.id,
          beforeJson: JSON.stringify({ statusV2: before }),
          afterJson: JSON.stringify({ statusV2: "auto_closed", atBishkek: nowBishkek.toISOString() }),
        },
        select: { id: true },
      });
      auditIds.push(audit.id);
    }

    const updated = await prisma.attendance.updateMany({
      where: {
        classSessionId: s.id,
        isActive: true,
        deletedAt: null,
        AND: [{ statusV2: null }, { status: null }],
      },
      data: {
        statusV2: "S",
        status: "S",
        updatedBy: "system:auto-closed",
      },
    });

    if (updated.count > 0) {
      attendanceNullToS += updated.count;
      const audit = await prisma.auditTrail.create({
        data: {
          actorType: "system",
          actorId: null,
          action: "auto_null_to_S",
          entityType: "ClassSession",
          entityId: s.id,
          beforeJson: JSON.stringify({ convertedNullCount: 0 }),
          afterJson: JSON.stringify({ convertedNullCount: updated.count, atBishkek: nowBishkek.toISOString() }),
        },
        select: { id: true },
      });
      auditIds.push(audit.id);
    }
  }

  // 2) Pre-create attendance rows: sessions starting in next 5 minutes.
  const upcomingSessions = await prisma.classSession.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      startTime: { gte: nowInstant, lte: inFiveMinutesInstant },
      NOT: [{ statusV2: "cancelled" }, { status: "cancelled" }],
    },
    select: { id: true, groupId: true, semesterId: true },
  });

  let attendancePreCreated = 0;

  for (const session of upcomingSessions) {
    const students = await prisma.student.findMany({
      where: { groupId: session.groupId, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (students.length === 0) continue;

    const existing = await prisma.attendance.findMany({
      where: { classSessionId: session.id, isActive: true, deletedAt: null },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map((x) => x.studentId));
    const toCreate = students.filter((st) => !existingIds.has(st.id));

    const created =
      toCreate.length === 0
        ? { count: 0 }
        : await prisma.attendance.createMany({
            data: toCreate.map((st) => ({
              classSessionId: session.id,
              studentId: st.id,
              semesterId: session.semesterId,
              status: null,
              statusV2: null,
              updatedBy: "system:precreate",
              isActive: true,
              deletedAt: null,
            })),
          });

    if (created.count > 0) {
      attendancePreCreated += created.count;
      const audit = await prisma.auditTrail.create({
        data: {
          actorType: "system",
          actorId: null,
          action: "precreate_attendance",
          entityType: "ClassSession",
          entityId: session.id,
          beforeJson: null,
          afterJson: JSON.stringify({ createdCount: created.count, atBishkek: nowBishkek.toISOString() }),
        },
        select: { id: true },
      });
      auditIds.push(audit.id);
    }
  }

  return NextResponse.json({
    ok: true,
    nowBishkek: nowBishkek.toISOString(),
    bPendingExpired,
    semestersLocked,
    bPendingAutoRejected,
    sessionsAutoClosed,
    attendanceNullToS,
    attendancePreCreated,
    auditCount: auditIds.length,
  });
}

