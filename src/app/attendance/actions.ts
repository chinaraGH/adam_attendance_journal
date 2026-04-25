"use server";

import { prisma } from "@/lib/prisma";
import { getEffectiveClassSessionStatus } from "@/lib/class-session/effective-status";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  decideAttendanceStatusChange,
  getCanonicalAttendanceStatusV2,
  normalizeAttendanceStatusV2,
} from "@/lib/attendance/status-machine";

function normalizeRequestedStatus(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().toUpperCase();
}

function normalizeTeacherAttendanceStatusV2(input: unknown): string {
  const s = normalizeRequestedStatus(input);
  if (!s) return "";
  if (s === "B") return "B_PENDING";
  const mapped = normalizeAttendanceStatusV2(s);
  return mapped ? mapped : "";
}

export async function saveAttendance(formData: FormData) {
  const studentId = formData.get("studentId");
  const requestedStatus = normalizeRequestedStatus(formData.get("status"));

  if (typeof studentId !== "string" || !studentId) {
    return { ok: false as const, error: "Не удалось определить студента." };
  }

  if (!requestedStatus) {
    return { ok: false as const, error: "Не указан статус посещаемости." };
  }

  // Single-item action no longer used by the UI.
  return { ok: false as const, error: "Не поддерживается." };
}

export async function saveAttendances(input: {
  classSessionId: string;
  items: Array<{ studentId: string; status: string }>;
}) {
  if (
    !input ||
    typeof input.classSessionId !== "string" ||
    input.classSessionId.length === 0 ||
    !Array.isArray(input.items) ||
    input.items.length === 0
  ) {
    return { ok: false as const, error: "Нет данных для сохранения." };
  }

  try {
    const actor = await getCurrentUser();

    const session = await prisma.classSession.findFirst({
      where: { id: input.classSessionId, isActive: true, deletedAt: null },
      select: {
        id: true,
        groupId: true,
        semesterId: true,
        startTime: true,
        endTime: true,
        openedAt: true,
        status: true,
        statusV2: true,
        semester: { select: { isLocked: true } },
      },
    });

    if (!session) return { ok: false as const, error: "Занятие не найдено." };

    if (session.semester?.isLocked) {
      throw new Error("Семестр закрыт. Изменение посещаемости запрещено.");
    }

    const effectiveStatus = getEffectiveClassSessionStatus({
      startTime: session.startTime,
      endTime: session.endTime,
      openedAt: session.openedAt,
      status: session.status,
      statusV2: session.statusV2,
    });

    if (effectiveStatus !== "active") {
      return { ok: false as const, error: "Сохранение доступно только во время активного занятия." };
    }

    // Must mark every active student in the group: NULL is forbidden on save.
    const groupStudents = await prisma.student.findMany({
      where: { groupId: session.groupId, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (groupStudents.length === 0) {
      return { ok: false as const, error: "В группе нет активных студентов." };
    }

    const statusByStudentId = new Map<string, string>();
    for (const item of input.items) {
      if (!item || typeof item.studentId !== "string") continue;
      const normalized = normalizeTeacherAttendanceStatusV2(item.status);
      if (!normalized) continue;
      statusByStudentId.set(item.studentId, normalized);
    }

    const missing = groupStudents.filter((s) => !statusByStudentId.has(s.id));
    if (missing.length > 0) {
      return { ok: false as const, error: "Нельзя сохранить журнал: есть неотмеченные студенты." };
    }

    const students = await prisma.student.findMany({
      where: {
        id: { in: groupStudents.map((s) => s.id) },
        groupId: session.groupId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    const allowedStudentIds = new Set(students.map((s) => s.id));

    const items = groupStudents
      .map((s) => ({
        studentId: s.id,
        statusV2: statusByStudentId.get(s.id) ?? "",
      }))
      .filter((x) => x.statusV2.length > 0)
      .filter((x) => allowedStudentIds.has(x.studentId));

    if (items.length === 0) {
      return { ok: false as const, error: "Нет валидных студентов для сохранения." };
    }

    const existing = await prisma.attendance.findMany({
      where: {
        classSessionId: session.id,
        studentId: { in: items.map((x) => x.studentId) },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, studentId: true, status: true, statusV2: true },
    });
    const existingByStudentId = new Map(existing.map((r) => [r.studentId, r]));

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const before = existingByStudentId.get(item.studentId) ?? null;
        const beforeStatusV2 = before ? getCanonicalAttendanceStatusV2(before) : null;

        const decision = decideAttendanceStatusChange({
          actorRole: actor.role,
          isSemesterLocked: Boolean(session.semester?.isLocked),
          currentStatus: beforeStatusV2,
          requestedStatus: normalizeAttendanceStatusV2(item.statusV2)!,
        });

        if (!decision.ok) {
          throw new Error(decision.error);
        }

        // Save both for now: `statusV2` is canonical going forward, `status` kept for compatibility.
        const row = await tx.attendance.upsert({
          where: {
            classSessionId_studentId: {
              classSessionId: session.id,
              studentId: item.studentId,
            },
          },
          create: {
            classSessionId: session.id,
            studentId: item.studentId,
            semesterId: session.semesterId,
            status: decision.next,
            statusV2: decision.next,
            updatedBy: actor.id,
            isActive: true,
            deletedAt: null,
          },
          update: {
            status: decision.next,
            statusV2: decision.next,
            updatedBy: actor.id,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true, status: true, statusV2: true },
        });

        if (beforeStatusV2 !== decision.next) {
          await tx.auditTrail.create({
            data: {
              actorType: actor.role === "TEACHER" ? "teacher" : actor.role.toLowerCase(),
              actorId: actor.id,
              action: "attendance_update",
              entityType: "Attendance",
              entityId: row.id,
              beforeJson: JSON.stringify({ statusV2: beforeStatusV2 }),
              afterJson: JSON.stringify({ statusV2: decision.next }),
            },
            select: { id: true },
          });
        }
      }
    });

    return { ok: true as const, savedCount: items.length };
  } catch (e) {
    const message =
      typeof e === "object" && e && "message" in e && typeof (e as any).message === "string"
        ? (e as any).message
        : String(e);
    return { ok: false as const, error: message };
  }
}

