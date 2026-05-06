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

export async function reconcileClassSessionsBySemesterBoundaries(params: ReconcileParams) {
  const semesters = await prisma.semester.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, startDate: true, endDate: true },
  });

  const sessions = await prisma.classSession.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, startTime: true, semesterId: true, outOfSemester: true },
  });

  let updatedCount = 0;
  let movedToSemesterCount = 0;
  let movedOutOfSemesterCount = 0;

  for (const session of sessions) {
    const nextSemesterId = resolveSemesterIdForDate(semesters, session.startTime);
    const nextOutOfSemester = !nextSemesterId;
    const nextSemesterResolutionStatus = nextSemesterId ? "IN_SEMESTER" : "OUT_OF_SEMESTER";
    const changed = session.semesterId !== nextSemesterId || Boolean(session.outOfSemester) !== nextOutOfSemester;
    if (!changed) continue;

    await prisma.classSession.update({
      where: { id: session.id },
      data: {
        semesterId: nextSemesterId,
        outOfSemester: nextOutOfSemester,
        semesterResolutionStatus: nextSemesterResolutionStatus,
      },
      select: { id: true },
    });

    await prisma.auditTrail.create({
      data: {
        actorType: params.actorType,
        actorId: params.actorId,
        action: "class_session_semester_resolution_reconciled",
        entityType: "ClassSession",
        entityId: session.id,
        beforeJson: JSON.stringify({ semesterId: session.semesterId, outOfSemester: session.outOfSemester }),
        afterJson: JSON.stringify({
          semesterId: nextSemesterId,
          outOfSemester: nextOutOfSemester,
          semesterResolutionStatus: nextSemesterResolutionStatus,
          correlationId: params.correlationId ?? null,
        }),
      },
      select: { id: true },
    });

    updatedCount += 1;
    if (nextOutOfSemester) {
      movedOutOfSemesterCount += 1;
    } else {
      movedToSemesterCount += 1;
    }
  }

  return { updatedCount, movedToSemesterCount, movedOutOfSemesterCount };
}
