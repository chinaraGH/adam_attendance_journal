import { prisma } from "@/lib/prisma";

export async function lockSemesterAndConvertPendingToNb(input: {
  semesterId: string;
  actorType: "system" | "academic_office";
  actorId: string | null;
  nowInstant: Date;
  nowBishkekIso: string;
  reason: "auto" | "manual";
}) {
  const { semesterId, actorType, actorId, nowInstant, nowBishkekIso, reason } = input;

  return prisma.$transaction(async (tx) => {
    const sem = await tx.semester.findFirst({
      where: { id: semesterId },
      select: { id: true, isLocked: true, endDate: true },
    });
    if (!sem) return { ok: false as const, error: "Semester not found" };
    if (sem.isLocked) return { ok: true as const, alreadyLocked: true as const, convertedCount: 0 };

    await tx.semester.update({
      where: { id: semesterId },
      data: { isLocked: true, lockedAt: nowInstant },
      select: { id: true },
    });

    const converted = await tx.attendance.updateMany({
      where: {
        semesterId,
        isActive: true,
        deletedAt: null,
        OR: [{ statusV2: "B_PENDING" }, { status: "B_PENDING" }],
      },
      data: { statusV2: "NB", status: "NB", updatedBy: `system:semester-lock:${reason}` },
    });

    await tx.auditTrail.create({
      data: {
        actorType,
        actorId,
        action: reason === "auto" ? "semester_auto_lock" : "semester_lock",
        entityType: "Semester",
        entityId: semesterId,
        beforeJson: JSON.stringify({ isLocked: false, endDate: sem.endDate.toISOString() }),
        afterJson: JSON.stringify({
          isLocked: true,
          lockedAtBishkek: nowBishkekIso,
          bPendingToNbCount: converted.count,
        }),
      },
      select: { id: true },
    });

    return { ok: true as const, alreadyLocked: false as const, convertedCount: converted.count };
  });
}

