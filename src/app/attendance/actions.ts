"use server";

import { prisma } from "@/lib/prisma";

function normalizeRequestedStatus(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().toUpperCase();
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
    console.log("Данные получены сервером:", input.items);

    const session = await prisma.classSession.findFirst({
      where: { id: input.classSessionId, isActive: true, deletedAt: null },
      select: { id: true, groupId: true },
    });

    if (!session) return { ok: false as const, error: "Занятие не найдено." };

    const students = await prisma.student.findMany({
      where: {
        id: { in: input.items.map((x) => x.studentId) },
        groupId: session.groupId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    const allowedStudentIds = new Set(students.map((s) => s.id));

    const items = input.items
      .filter((x) => typeof x.studentId === "string" && x.studentId.length > 0)
      .map((x) => ({
        studentId: x.studentId,
        requestedStatus: normalizeRequestedStatus(x.status),
      }))
      .filter((x) => x.requestedStatus.length > 0)
      .filter((x) => allowedStudentIds.has(x.studentId));

    if (items.length === 0) {
      return { ok: false as const, error: "Нет валидных студентов для сохранения." };
    }

    await prisma.$transaction(
      items.map((item) => {
        return prisma.attendance.upsert({
          where: {
            classSessionId_studentId: {
              classSessionId: session.id,
              studentId: item.studentId,
            },
          },
          create: {
            classSessionId: session.id,
            studentId: item.studentId,
            status: item.requestedStatus,
            updatedBy: "teacher:test",
            isActive: true,
            deletedAt: null,
          },
          update: {
            status: item.requestedStatus,
            updatedBy: "teacher:test",
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });
      }),
    );

    return { ok: true as const, savedCount: items.length };
  } catch (e) {
    const message =
      typeof e === "object" && e && "message" in e && typeof (e as any).message === "string"
        ? (e as any).message
        : String(e);
    return { ok: false as const, error: message };
  }
}

