"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { lockSemesterAndConvertPendingToNb } from "@/lib/semester/lock-semester";

async function requireAcademicOffice() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ACADEMIC_OFFICE" && actor.role !== "ADMIN") {
    throw new Error("Недостаточно прав.");
  }
  return actor;
}

export async function getAllSemesters() {
  await requireAcademicOffice();
  const semesters = await prisma.semester.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true, isLocked: true },
    take: 50,
  });
  return { ok: true as const, semesters };
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

export async function upsertSemester(formData: FormData) {
  await requireAcademicOffice();

  const semesterId = formData.get("semesterId");
  const name = formData.get("name");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");

  if (semesterId !== null && typeof semesterId !== "string") throw new Error("semesterId is invalid");
  if (typeof name !== "string" || !name) throw new Error("name is required");
  if (typeof startDate !== "string" || !startDate) throw new Error("startDate is required");
  if (typeof endDate !== "string" || !endDate) throw new Error("endDate is required");

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Некорректные даты.");

  const row = semesterId
    ? await prisma.semester.update({
        where: { id: semesterId },
        data: { name, startDate: start, endDate: end },
        select: { id: true },
      })
    : await prisma.semester.create({
        data: { name, startDate: start, endDate: end, isLocked: false, lockedAt: null },
        select: { id: true },
      });

  await prisma.auditTrail.create({
    data: {
      actorType: "academic_office",
      actorId: (await getCurrentUserOrRedirect()).id,
      action: semesterId ? "semester_update" : "semester_create",
      entityType: "Semester",
      entityId: row.id,
      beforeJson: null,
      afterJson: JSON.stringify({ name, startDate: start.toISOString(), endDate: end.toISOString() }),
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

