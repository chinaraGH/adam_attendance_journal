import { prisma } from "@/lib/prisma";

type ReconcileActorType = "system" | "academic_office";

type ReconcileParams = {
  actorType: ReconcileActorType;
  actorId: string | null;
  correlationId?: string;
};

type SemesterRange = {
  id: string;
  startDate: Date;
  endDate: Date;
};

function resolveSemesterIdForDate(semesters: SemesterRange[], startTime: Date): string | null {
  for (const semester of semesters) {
    if (semester.startDate <= startTime && semester.endDate >= startTime) {
      return semester.id;
    }
  }
  return null;
}

const CHUNK = 500;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Пересчитывает семестр у всех занятий по границам семестров.
 * Работает пакетами (несколько запросов вместо трёх на каждое занятие), поэтому укладывается в секунды
 * даже при тысячах занятий, и безопасно запускается повторно.
 */
export async function reconcileClassSessionsBySemesterBoundaries(params: ReconcileParams) {
  const semesters = await prisma.semester.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, startDate: true, endDate: true },
  });

  const sessions = await prisma.classSession.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, startTime: true, semesterId: true, outOfSemester: true },
  });

  const toSemester = new Map<string, string[]>();
  const toOut: string[] = [];
  const auditRows: {
    actorType: string;
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    beforeJson: string;
    afterJson: string;
  }[] = [];

  for (const session of sessions) {
    const nextSemesterId = resolveSemesterIdForDate(semesters, session.startTime);
    const nextOutOfSemester = !nextSemesterId;
    const changed = session.semesterId !== nextSemesterId || Boolean(session.outOfSemester) !== nextOutOfSemester;
    if (!changed) continue;

    if (nextSemesterId) {
      const list = toSemester.get(nextSemesterId) ?? [];
      list.push(session.id);
      toSemester.set(nextSemesterId, list);
    } else {
      toOut.push(session.id);
    }

    auditRows.push({
      actorType: params.actorType,
      actorId: params.actorId,
      action: "class_session_semester_resolution_reconciled",
      entityType: "ClassSession",
      entityId: session.id,
      beforeJson: JSON.stringify({ semesterId: session.semesterId, outOfSemester: session.outOfSemester }),
      afterJson: JSON.stringify({
        semesterId: nextSemesterId,
        outOfSemester: nextOutOfSemester,
        semesterResolutionStatus: nextSemesterId ? "IN_SEMESTER" : "OUT_OF_SEMESTER",
        correlationId: params.correlationId ?? null,
      }),
    });
  }

  let movedToSemesterCount = 0;
  for (const [semesterId, ids] of Array.from(toSemester.entries())) {
    for (const part of chunks(ids)) {
      await prisma.classSession.updateMany({
        where: { id: { in: part } },
        data: { semesterId, outOfSemester: false, semesterResolutionStatus: "IN_SEMESTER" },
      });
      // Отметки занятия переходят в тот же семестр, что и само занятие.
      await prisma.attendance.updateMany({
        where: { classSessionId: { in: part }, NOT: { semesterId } },
        data: { semesterId },
      });
      movedToSemesterCount += part.length;
    }
  }

  let movedOutOfSemesterCount = 0;
  for (const part of chunks(toOut)) {
    await prisma.classSession.updateMany({
      where: { id: { in: part } },
      data: { semesterId: null, outOfSemester: true, semesterResolutionStatus: "OUT_OF_SEMESTER" },
    });
    movedOutOfSemesterCount += part.length;
  }

  for (const part of chunks(auditRows)) {
    await prisma.auditTrail.createMany({ data: part });
  }

  return { updatedCount: auditRows.length, movedToSemesterCount, movedOutOfSemesterCount };
}
