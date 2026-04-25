"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { lockSemesterAndConvertPendingToNb } from "@/lib/semester/lock-semester";

async function requireAcademicOffice() {
  const actor = await getCurrentUser();
  if (actor.role !== "ACADEMIC_OFFICE") {
    throw new Error("Недостаточно прав.");
  }
  return actor;
}

export async function getCurrentSemester() {
  await requireAcademicOffice();
  const semester =
    (await prisma.semester.findFirst({
      where: { isLocked: false },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, startDate: true, endDate: true, isLocked: true },
    })) ??
    (await prisma.semester.findFirst({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, startDate: true, endDate: true, isLocked: true },
    }));
  return { ok: true as const, semester };
}

export async function updateSemesterDates(formData: FormData) {
  await requireAcademicOffice();

  const semesterId = formData.get("semesterId");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");

  if (typeof semesterId !== "string" || !semesterId) throw new Error("semesterId is required");
  if (typeof startDate !== "string" || !startDate) throw new Error("startDate is required");
  if (typeof endDate !== "string" || !endDate) throw new Error("endDate is required");

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Некорректные даты.");

  await prisma.semester.update({
    where: { id: semesterId },
    data: { startDate: start, endDate: end },
    select: { id: true },
  });

  await prisma.auditTrail.create({
    data: {
      actorType: "academic_office",
      actorId: "ACADEMIC_OFFICE_TEST",
      action: "semester_update_dates",
      entityType: "Semester",
      entityId: semesterId,
      beforeJson: null,
      afterJson: JSON.stringify({ startDate: start.toISOString(), endDate: end.toISOString() }),
    },
    select: { id: true },
  });
}

export async function lockSemester(formData: FormData) {
  const actor = await requireAcademicOffice();

  const semesterId = formData.get("semesterId");
  if (typeof semesterId !== "string" || !semesterId) throw new Error("semesterId is required");

  await lockSemesterAndConvertPendingToNb({
    semesterId,
    actorType: "academic_office",
    actorId: actor.id,
    nowInstant: new Date(),
    nowBishkekIso: new Date().toISOString(),
    reason: "manual",
  });
}

