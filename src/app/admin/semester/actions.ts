"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { lockSemesterAndConvertPendingToNb } from "@/lib/semester/lock-semester";
import { reconcileClassSessionsBySemesterBoundaries } from "@/lib/semester/reconcile-class-sessions";

/** Календарная дата из поля type=date (YYYY-MM-DD) → UTC 00:00 этой даты, без сдвига при отображении через timeZone: UTC. */
function parseYmdToUtcDate(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) throw new Error("Некорректная дата.");
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
}

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

export async function upsertSemester(prevState: any, formData: FormData) {
  const actor = await requireAcademicOffice();

  const intent = formData.get("intent") as string | null;
  const semesterId = formData.get("semesterId") as string | null;
  const name = formData.get("name") as string | null;
  const startDate = formData.get("startDate") as string | null;
  const endDate = formData.get("endDate") as string | null;

  if (intent !== "create" && intent !== "update") throw new Error("Invalid intent");
  if (!semesterId) throw new Error(intent === "create" ? "Укажите ID для нового семестра" : "semesterId is required");
  if (!name) throw new Error("name is required");
  if (!startDate) throw new Error("startDate is required");
  if (!endDate) throw new Error("endDate is required");

  const start = parseYmdToUtcDate(startDate);
  const end = parseYmdToUtcDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { error: "Некорректные даты." };

  const intersecting = await prisma.semester.findFirst({
    where: {
      id: intent === "update" ? { not: semesterId } : undefined,
      OR: [
        { startDate: { lte: end }, endDate: { gte: start } }
      ]
    }
  });

  if (intersecting) {
    return { error: `Даты пересекаются с семестром "${intersecting.name}"` };
  }

  if (intent === "update") {
    const old = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (old && (old.startDate.getTime() !== start.getTime() || old.endDate.getTime() !== end.getTime())) {
      const hasAtt = await prisma.attendance.findFirst({
        where: {
          classSession: { semesterId: semesterId, isActive: true, deletedAt: null },
          isActive: true, deletedAt: null,
        },
        select: { id: true }
      });
      if (hasAtt) {
        return { error: "Нельзя изменить даты: в семестре уже есть данные о посещаемости." };
      }
    }
  }

  if (intent === "create") {
    const exists = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (exists) {
      return { error: "Семестр с таким ID уже существует." };
    }
  }

  const row = intent === "update"
    ? await prisma.semester.update({
        where: { id: semesterId },
        data: { name, startDate: start, endDate: end },
        select: { id: true },
      })
    : await prisma.semester.create({
        data: { id: semesterId, name, startDate: start, endDate: end, isLocked: false, lockedAt: null },
        select: { id: true },
      });

  await prisma.auditTrail.create({
    data: {
      actorType: "academic_office",
      actorId: actor.id,
      action: semesterId ? "semester_update" : "semester_create",
      entityType: "Semester",
      entityId: row.id,
      beforeJson: null,
      afterJson: JSON.stringify({ name, startDate: start.toISOString(), endDate: end.toISOString() }),
    },
    select: { id: true },
  });
  await reconcileClassSessionsBySemesterBoundaries({
    actorType: "academic_office",
    actorId: actor.id,
    correlationId: randomUUID(),
  });

  revalidatePath("/admin/semester");
  return { ok: true };
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

  revalidatePath("/admin/semester");
}

