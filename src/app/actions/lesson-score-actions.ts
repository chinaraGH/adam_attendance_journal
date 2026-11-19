"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { loadSessionPlan } from "@/lib/points/session-points";

/**
 * Оценки за занятие (текущий контроль). Остаются открытыми для правки,
 * но каждое изменение пишется в журнал аудита (кто, когда, было → стало).
 */
export async function saveLessonScores(input: {
  classSessionId: string;
  items: Array<{ studentId: string; score: number }>;
}) {
  try {
    const actor = await getCurrentUserOrRedirect();
    if (!input || typeof input.classSessionId !== "string" || !Array.isArray(input.items)) {
      return { ok: false as const, error: "Нет данных для сохранения." };
    }
    if (input.items.length === 0) return { ok: true as const, savedCount: 0 };

    const plan = await loadSessionPlan({ classSessionId: input.classSessionId, actor });
    if (plan.semesterLocked) return { ok: false as const, error: "Семестр закрыт. Изменение оценок запрещено." };
    if (!plan.available) return { ok: false as const, error: plan.reason };
    if (plan.moduleClosed) return { ok: false as const, error: `Модуль ${plan.moduleNo} закрыт учебной частью. Оценки больше не меняются.` };

    const session = await prisma.classSession.findFirst({
      where: { id: input.classSessionId },
      select: { id: true, groupId: true },
    });
    if (!session) return { ok: false as const, error: "Занятие не найдено." };

    const students = await prisma.student.findMany({
      where: { groupId: session.groupId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });
    const byId = new Map(students.map((s) => [s.id, s]));

    const clean: Array<{ studentId: string; score: number }> = [];
    for (const it of input.items) {
      const st = byId.get(it?.studentId);
      if (!st) continue;
      if (typeof it.score !== "number" || !Number.isFinite(it.score) || it.score < 0) {
        return { ok: false as const, error: `Некорректная оценка: ${st.name}.` };
      }
      if (it.score > plan.lessonMax + 1e-9) {
        return { ok: false as const, error: `Оценка не может быть больше ${plan.lessonMax}: ${st.name}.` };
      }
      clean.push({ studentId: st.id, score: Math.round(it.score * 100) / 100 });
    }

    await prisma.$transaction(async (tx) => {
      for (const it of clean) {
        const before = plan.scoresByStudentId[it.studentId];
        if (before === it.score) continue;
        const row = await tx.lessonScore.upsert({
          where: { classSessionId_studentId: { classSessionId: session.id, studentId: it.studentId } },
          create: { classSessionId: session.id, studentId: it.studentId, score: it.score, enteredById: actor.id },
          update: { score: it.score, enteredById: actor.id },
          select: { id: true },
        });
        await tx.auditTrail.create({
          data: {
            actorType: actor.role === "TEACHER" ? "teacher" : actor.role.toLowerCase(),
            actorId: actor.id,
            action: before === undefined ? "lesson_score_create" : "lesson_score_update",
            entityType: "LessonScore",
            entityId: row.id,
            beforeJson: before === undefined ? null : JSON.stringify({ score: before }),
            afterJson: JSON.stringify({ score: it.score, studentId: it.studentId, classSessionId: session.id }),
          },
          select: { id: true },
        });
      }
    });

    revalidatePath(`/attendance/${session.id}`);
    return { ok: true as const, savedCount: clean.length };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Ошибка сохранения оценок." };
  }
}
