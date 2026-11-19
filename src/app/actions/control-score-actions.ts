"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { buildGroupPointsReport } from "@/lib/points/report";

const CATEGORIES = ["SELF_WORK", "BORDER_CONTROL", "EXTRA"] as const;
type Category = (typeof CATEGORIES)[number];

/** Баллы за самостоятельную работу, рубежный контроль (по модулю) и дополнительные (moduleNo = 0). */
export async function saveControlScores(input: {
  techCardId: string;
  groupId: string;
  category: Category;
  moduleNo: number;
  items: Array<{ studentId: string; score: number }>;
}) {
  try {
    const actor = await getCurrentUserOrRedirect();
    if (actor.role !== "TEACHER" && actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
      return { ok: false as const, error: "Недостаточно прав." };
    }
    if (!input || !CATEGORIES.includes(input.category) || !Array.isArray(input.items)) {
      return { ok: false as const, error: "Нет данных для сохранения." };
    }
    const moduleNo = input.category === "EXTRA" ? 0 : input.moduleNo;
    if (input.category !== "EXTRA" && moduleNo !== 1 && moduleNo !== 2) {
      return { ok: false as const, error: "Укажите модуль 1 или 2." };
    }

    const card = await prisma.techCard.findFirst({
      where: { id: input.techCardId, isActive: true, deletedAt: null },
      include: { semester: true, modules: true },
    });
    if (!card) return { ok: false as const, error: "Технологическая карта не найдена." };
    if (actor.role === "TEACHER" && card.teacherId !== actor.id) return { ok: false as const, error: "Это карта другого преподавателя." };
    if (card.semester.isLocked) return { ok: false as const, error: "Семестр закрыт. Изменение оценок запрещено." };
    if (moduleNo === 1 && card.semester.module1ClosedAt) return { ok: false as const, error: "Модуль 1 закрыт учебной частью." };
    if (moduleNo === 2 && card.semester.module2ClosedAt) return { ok: false as const, error: "Модуль 2 закрыт учебной частью." };

    const students = await prisma.student.findMany({
      where: { groupId: input.groupId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });
    if (students.length === 0) return { ok: false as const, error: "В группе нет студентов." };
    const byId = new Map(students.map((s) => [s.id, s]));

    let max = 0;
    if (input.category === "EXTRA") max = Math.min(card.extraMaxPoints, card.semester.extraMaxPoints);
    else {
      const mod = card.modules.find((m) => m.moduleNo === moduleNo);
      max = (input.category === "SELF_WORK" ? mod?.selfWorkPoints : mod?.borderControlPoints) ?? 0;
    }
    if (max <= 0) {
      return { ok: false as const, error: input.category === "EXTRA" ? "В карте не заданы дополнительные баллы." : "В карте не заданы баллы для этой категории." };
    }

    const clean: Array<{ studentId: string; score: number }> = [];
    for (const it of input.items) {
      const st = byId.get(it?.studentId);
      if (!st) continue;
      if (typeof it.score !== "number" || !Number.isFinite(it.score) || it.score < 0) return { ok: false as const, error: `Некорректная оценка: ${st.name}.` };
      if (it.score > max + 1e-9) return { ok: false as const, error: `Оценка не может быть больше ${max}: ${st.name}.` };
      clean.push({ studentId: st.id, score: Math.round(it.score * 100) / 100 });
    }
    if (input.category !== "EXTRA") {
      const given = new Set(clean.map((c) => c.studentId));
      const missing = students.filter((s) => !given.has(s.id));
      if (missing.length > 0) return { ok: false as const, error: `Не заполнено: ${missing.map((m) => m.name).join(", ")}.` };
    }

    // Дополнительные: итог студента (модули + дополнительные) не больше лимита семестра
    if (input.category === "EXTRA") {
      const report = await buildGroupPointsReport({ techCardId: card.id, groupId: input.groupId });
      for (const it of clean) {
        const row = report?.rows.find((r) => r.studentId === it.studentId);
        if (!row) continue;
        const room = card.semester.totalPoints - (row.moduleTotals[0] + row.moduleTotals[1]);
        if (it.score > room + 1e-9) {
          return { ok: false as const, error: `${byId.get(it.studentId)?.name}: модули дают ${row.moduleTotals[0] + row.moduleTotals[1]}, дополнительных можно не больше ${Math.max(0, Math.round(room * 100) / 100)} (итог не выше ${card.semester.totalPoints}).` };
        }
      }
    }

    const existing = await prisma.controlScore.findMany({
      where: { techCardId: card.id, category: input.category, moduleNo, studentId: { in: clean.map((c) => c.studentId) } },
      select: { studentId: true, score: true },
    });
    const before = new Map(existing.map((e) => [e.studentId, e.score]));

    await prisma.$transaction(async (tx) => {
      for (const it of clean) {
        const prev = before.get(it.studentId);
        if (prev === it.score) continue;
        const row = await tx.controlScore.upsert({
          where: { techCardId_studentId_category_moduleNo: { techCardId: card.id, studentId: it.studentId, category: input.category, moduleNo } },
          create: { techCardId: card.id, studentId: it.studentId, category: input.category, moduleNo, score: it.score, enteredById: actor.id },
          update: { score: it.score, enteredById: actor.id },
          select: { id: true },
        });
        await tx.auditTrail.create({
          data: {
            actorType: actor.role === "TEACHER" ? "teacher" : actor.role.toLowerCase(),
            actorId: actor.id,
            action: prev === undefined ? "control_score_create" : "control_score_update",
            entityType: "ControlScore",
            entityId: row.id,
            beforeJson: prev === undefined ? null : JSON.stringify({ score: prev }),
            afterJson: JSON.stringify({ score: it.score, studentId: it.studentId, category: input.category, moduleNo }),
          },
          select: { id: true },
        });
      }
    });

    revalidatePath("/teacher/control");
    return { ok: true as const, savedCount: clean.length };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Ошибка сохранения." };
  }
}
