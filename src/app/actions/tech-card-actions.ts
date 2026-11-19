"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { round2, validateTechCard, type ModuleDraft } from "@/lib/points/calc";

export async function saveTechCard(input: {
  techCardId: string;
  latePercent: number;
  extraMaxPoints: number;
  modules: Array<ModuleDraft & { moduleNo: number }>;
}) {
  try {
    const actor = await getCurrentUserOrRedirect();
    if (actor.role !== "TEACHER" && actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
      return { ok: false as const, error: "Недостаточно прав." };
    }
    if (!input || typeof input.techCardId !== "string" || !Array.isArray(input.modules)) {
      return { ok: false as const, error: "Нет данных для сохранения." };
    }

    const card = await prisma.techCard.findFirst({
      where: { id: input.techCardId, isActive: true, deletedAt: null },
      include: { semester: true, modules: { include: { lessons: { orderBy: { lessonNo: "asc" } } } } },
    });
    if (!card) return { ok: false as const, error: "Технологическая карта не найдена." };
    if (actor.role === "TEACHER" && card.teacherId !== actor.id) {
      return { ok: false as const, error: "Это карта другого преподавателя." };
    }
    if (card.semester.isLocked) return { ok: false as const, error: "Семестр закрыт. Изменение карты запрещено." };

    const modules = [...input.modules].sort((a, b) => a.moduleNo - b.moduleNo);
    if (modules.map((m) => m.moduleNo).join(",") !== "1,2") {
      return { ok: false as const, error: "В карте должно быть два модуля." };
    }
    for (const m of modules) {
      const closed = m.moduleNo === 1 ? card.semester.module1ClosedAt : card.semester.module2ClosedAt;
      if (!closed) continue;
      const old = card.modules.find((x) => x.moduleNo === m.moduleNo);
      const same =
        old &&
        old.lessonsCount === m.lessonsCount &&
        Math.abs(old.attendancePoints - m.attendancePoints) < 1e-9 &&
        Math.abs(old.selfWorkPoints - m.selfWorkPoints) < 1e-9 &&
        Math.abs(old.currentControlPoints - m.currentControlPoints) < 1e-9 &&
        Math.abs(old.borderControlPoints - m.borderControlPoints) < 1e-9 &&
        old.lessons.map((l) => l.points).join(",") === m.lessons.map((p) => round2(p)).join(",");
      if (!same) return { ok: false as const, error: `Модуль ${m.moduleNo} закрыт учебной частью. Его баллы в карте менять нельзя.` };
    }
    const error = validateTechCard(
      { latePercent: input.latePercent, extraMaxPoints: input.extraMaxPoints, modules },
      { modulePoints: card.semester.modulePoints, totalPoints: card.semester.totalPoints, extraMaxPoints: card.semester.extraMaxPoints },
    );
    if (error) return { ok: false as const, error };

    const before = {
      latePercent: card.latePercent,
      extraMaxPoints: card.extraMaxPoints,
      modules: card.modules.map((m) => ({
        moduleNo: m.moduleNo,
        lessonsCount: m.lessonsCount,
        attendance: m.attendancePoints,
        selfWork: m.selfWorkPoints,
        current: m.currentControlPoints,
        border: m.borderControlPoints,
      })),
    };

    await prisma.$transaction(async (tx) => {
      await tx.techCard.update({
        where: { id: card.id },
        data: { latePercent: round2(input.latePercent), extraMaxPoints: round2(input.extraMaxPoints) },
      });
      for (const m of modules) {
        const row = await tx.techCardModule.upsert({
          where: { techCardId_moduleNo: { techCardId: card.id, moduleNo: m.moduleNo } },
          create: { techCardId: card.id, moduleNo: m.moduleNo },
          update: {},
          select: { id: true },
        });
        await tx.techCardModule.update({
          where: { id: row.id },
          data: {
            lessonsCount: m.lessonsCount,
            attendancePoints: round2(m.attendancePoints),
            selfWorkPoints: round2(m.selfWorkPoints),
            currentControlPoints: round2(m.currentControlPoints),
            borderControlPoints: round2(m.borderControlPoints),
          },
        });
        await tx.techCardLesson.deleteMany({ where: { moduleId: row.id } });
        if (m.lessons.length > 0) {
          await tx.techCardLesson.createMany({
            data: m.lessons.map((points, i) => ({ moduleId: row.id, lessonNo: i + 1, points: round2(points) })),
          });
        }
      }
      await tx.auditTrail.create({
        data: {
          actorType: actor.role === "TEACHER" ? "teacher" : actor.role.toLowerCase(),
          actorId: actor.id,
          action: "tech_card_update",
          entityType: "TechCard",
          entityId: card.id,
          beforeJson: JSON.stringify(before),
          afterJson: JSON.stringify({
            latePercent: input.latePercent,
            extraMaxPoints: input.extraMaxPoints,
            modules: modules.map((m) => ({
              moduleNo: m.moduleNo,
              lessonsCount: m.lessonsCount,
              attendance: m.attendancePoints,
              selfWork: m.selfWorkPoints,
              current: m.currentControlPoints,
              border: m.borderControlPoints,
            })),
          }),
        },
        select: { id: true },
      });
    });

    revalidatePath("/teacher/tech-card");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Ошибка сохранения карты." };
  }
}
