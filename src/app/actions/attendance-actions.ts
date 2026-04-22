"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { resolveAttendanceStatusWithBishkekLateRule } from "@/lib/attendance/bishkek-policy";

const getGroupStudentsInput = z.object({
  groupId: z.string().min(1),
});

const markAttendanceInput = z.object({
  classSessionId: z.string().min(1),
  studentId: z.string().min(1),
  status: z.string().min(1),
  updatedBy: z.string().min(1).optional(),
  /** For tests or backdated marks; defaults to server time. */
  markedAt: z.coerce.date().optional(),
  sessionStartMeansBishkekWallAsUtc: z.boolean().optional(),
});

export type GroupStudentsResult =
  | {
      ok: true;
      students: Array<{
        id: string;
        name: string;
        gaudiId: string;
        groupId: string;
        isActive: boolean;
      }>;
    }
  | { ok: false; error: string };

export type MarkAttendanceResult =
  | {
      ok: true;
      attendance: {
        id: string;
        classSessionId: string;
        studentId: string;
        status: string | null;
        updatedBy: string | null;
        updatedAt: Date;
      };
      appliedStatus: string;
    }
  | { ok: false; error: string };

export async function getGroupStudents(raw: unknown): Promise<GroupStudentsResult> {
  const parsed = getGroupStudentsInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Некорректные данные запроса." };
  }

  const { groupId } = parsed.data;

  try {
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!group) {
      return { ok: false, error: "Группа не найдена или недоступна." };
    }

    const students = await prisma.student.findMany({
      where: {
        groupId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        gaudiId: true,
        groupId: true,
        isActive: true,
      },
    });

    return { ok: true, students };
  } catch {
    return { ok: false, error: "Не удалось загрузить список студентов. Повторите попытку." };
  }
}

export async function markAttendance(raw: unknown): Promise<MarkAttendanceResult> {
  const parsed = markAttendanceInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Некорректные данные для сохранения отметки." };
  }

  const {
    classSessionId,
    studentId,
    status,
    updatedBy,
    markedAt,
    sessionStartMeansBishkekWallAsUtc,
  } = parsed.data;

  const markTime = markedAt ?? new Date();

  try {
    const session = await prisma.classSession.findFirst({
      where: {
        id: classSessionId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        groupId: true,
        startTime: true,
      },
    });

    if (!session) {
      return { ok: false, error: "Занятие не найдено или недоступно." };
    }

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        groupId: session.groupId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!student) {
      return {
        ok: false,
        error: "Студент не найден в группе этого занятия или недоступен.",
      };
    }

    const appliedStatus = resolveAttendanceStatusWithBishkekLateRule({
      sessionStart: session.startTime,
      markTime,
      requestedStatus: status,
      sessionStartMeansBishkekWallAsUtc,
    });

    const attendance = await prisma.attendance.upsert({
      where: {
        classSessionId_studentId: {
          classSessionId,
          studentId,
        },
      },
      create: {
        classSessionId,
        studentId,
        status: appliedStatus,
        updatedBy: updatedBy ?? null,
        isActive: true,
        deletedAt: null,
      },
      update: {
        status: appliedStatus,
        updatedBy: updatedBy ?? null,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        classSessionId: true,
        studentId: true,
        status: true,
        updatedBy: true,
        updatedAt: true,
      },
    });

    return { ok: true, attendance, appliedStatus };
  } catch {
    return { ok: false, error: "Не удалось сохранить отметку. Повторите попытку." };
  }
}
