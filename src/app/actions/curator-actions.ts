"use server";

import { isAfter } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { BISHKEK_TIME_ZONE, getBishkekNow } from "@/lib/time/bishkek-now";
import { decideAttendanceStatusChange, getCanonicalAttendanceStatusV2 } from "@/lib/attendance/status-machine";

export async function processSickRequest(input: {
  attendanceId: string;
  decision: "confirm" | "reject";
}) {
  const actor = await getCurrentUser();
  if (actor.role !== "CURATOR") {
    return { ok: false as const, error: "Недостаточно прав." };
  }

  if (!input || typeof input.attendanceId !== "string" || input.attendanceId.length === 0) {
    return { ok: false as const, error: "Некорректный идентификатор посещаемости." };
  }

  const row = await prisma.attendance.findFirst({
    where: { id: input.attendanceId, isActive: true, deletedAt: null },
    select: {
      id: true,
      status: true,
      statusV2: true,
      studentId: true,
      classSession: {
        select: {
          id: true,
          endTime: true,
          groupId: true,
          semester: { select: { isLocked: true } },
        },
      },
    },
  });

  if (!row) return { ok: false as const, error: "Запись не найдена." };

  const current = getCanonicalAttendanceStatusV2({ statusV2: row.statusV2, status: row.status });
  if (current !== "B_PENDING") {
    return { ok: false as const, error: "Можно обработать только запросы со статусом B_PENDING." };
  }

  // Curator can process only for own groups.
  const hasAccess = await prisma.userGroupCurator.findFirst({
    where: {
      userId: actor.id,
      groupId: row.classSession.groupId,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!hasAccess) return { ok: false as const, error: "Нет доступа к группе." };

  if (row.classSession.semester?.isLocked) {
    throw new Error("Семестр закрыт. Изменение посещаемости запрещено.");
  }

  // Only after scheduled end time.
  const now = getBishkekNow();
  const endBishkek = toZonedTime(row.classSession.endTime, BISHKEK_TIME_ZONE);
  if (!isAfter(now, endBishkek)) {
    return { ok: false as const, error: "Обработка Б возможна только после окончания занятия." };
  }

  const nextStatus = input.decision === "confirm" ? "B_CONFIRMED" : "NB";
  const decision = decideAttendanceStatusChange({
    actorRole: actor.role,
    isSemesterLocked: Boolean(row.classSession.semester?.isLocked),
    currentStatus: current,
    requestedStatus: nextStatus,
  });
  if (!decision.ok) return { ok: false as const, error: decision.error };

  const updated = await prisma.attendance.update({
    where: { id: row.id },
    data: {
      statusV2: decision.next,
      status: decision.next,
      updatedBy: actor.id,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, statusV2: true },
  });

  await prisma.auditTrail.create({
    data: {
      actorType: "curator",
      actorId: actor.id,
      action: input.decision === "confirm" ? "sick_confirm" : "sick_reject",
      entityType: "Attendance",
      entityId: updated.id,
      beforeJson: JSON.stringify({ statusV2: current }),
      afterJson: JSON.stringify({ statusV2: decision.next }),
    },
    select: { id: true },
  });

  return { ok: true as const, attendance: updated };
}

export async function setAdministrativeAbsence(input: { attendanceId: string }) {
  const actor = await getCurrentUser();
  if (actor.role !== "CURATOR") {
    return { ok: false as const, error: "Недостаточно прав." };
  }

  if (!input || typeof input.attendanceId !== "string" || input.attendanceId.length === 0) {
    return { ok: false as const, error: "Некорректный идентификатор посещаемости." };
  }

  const row = await prisma.attendance.findFirst({
    where: { id: input.attendanceId, isActive: true, deletedAt: null },
    select: {
      id: true,
      status: true,
      statusV2: true,
      classSession: { select: { id: true, endTime: true, groupId: true, semester: { select: { isLocked: true } } } },
    },
  });
  if (!row) return { ok: false as const, error: "Запись не найдена." };

  const hasAccess = await prisma.userGroupCurator.findFirst({
    where: { userId: actor.id, groupId: row.classSession.groupId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!hasAccess) return { ok: false as const, error: "Нет доступа к группе." };

  if (row.classSession.semester?.isLocked) {
    throw new Error("Семестр закрыт. Изменение посещаемости запрещено.");
  }

  // Per TZ: curator can change NB -> A only after end_time. We'll require after end_time for setting A at all.
  const now = getBishkekNow();
  const endBishkek = toZonedTime(row.classSession.endTime, BISHKEK_TIME_ZONE);
  if (!isAfter(now, endBishkek)) {
    return { ok: false as const, error: "Статус А можно выставлять только после окончания занятия." };
  }

  const before = getCanonicalAttendanceStatusV2({ statusV2: row.statusV2, status: row.status });
  if (before === "B_CONFIRMED") {
    return { ok: false as const, error: "B_CONFIRMED изменить невозможно." };
  }

  const decision = decideAttendanceStatusChange({
    actorRole: actor.role,
    isSemesterLocked: Boolean(row.classSession.semester?.isLocked),
    currentStatus: before,
    requestedStatus: "A",
  });
  if (!decision.ok) return { ok: false as const, error: decision.error };

  const updated = await prisma.attendance.update({
    where: { id: row.id },
    data: { statusV2: decision.next, status: decision.next, updatedBy: actor.id },
    select: { id: true, statusV2: true },
  });

  await prisma.auditTrail.create({
    data: {
      actorType: "curator",
      actorId: actor.id,
      action: "set_administrative_absence",
      entityType: "Attendance",
      entityId: updated.id,
      beforeJson: JSON.stringify({ statusV2: before }),
      afterJson: JSON.stringify({ statusV2: "A" }),
    },
    select: { id: true },
  });

  return { ok: true as const, attendance: updated };
}

