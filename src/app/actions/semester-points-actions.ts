"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";

async function guard() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") return null;
  return actor;
}

/** Учебная часть закрывает или открывает модуль: после закрытия оценки модуля не меняются. */
export async function setModuleClosed(input: { semesterId: string; moduleNo: number; closed: boolean }) {
  try {
    const actor = await guard();
    if (!actor) return { ok: false as const, error: "Недостаточно прав." };
    if (input.moduleNo !== 1 && input.moduleNo !== 2) return { ok: false as const, error: "Модуль 1 или 2." };
    const sem = await prisma.semester.findUnique({ where: { id: input.semesterId } });
    if (!sem) return { ok: false as const, error: "Семестр не найден." };
    if (sem.isLocked) return { ok: false as const, error: "Семестр закрыт." };
    const field = input.moduleNo === 1 ? "module1ClosedAt" : "module2ClosedAt";
    const was = Boolean(sem[field]);
    await prisma.$transaction(async (tx) => {
      await tx.semester.update({ where: { id: sem.id }, data: { [field]: input.closed ? new Date() : null } });
      await tx.auditTrail.create({
        data: {
          actorType: actor.role.toLowerCase(),
          actorId: actor.id,
          action: input.closed ? "module_close" : "module_reopen",
          entityType: "Semester",
          entityId: sem.id,
          beforeJson: JSON.stringify({ moduleNo: input.moduleNo, closed: was }),
          afterJson: JSON.stringify({ moduleNo: input.moduleNo, closed: input.closed }),
        },
        select: { id: true },
      });
    });
    revalidatePath("/acadepartment/points");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Ошибка." };
  }
}

/** Лимиты баллов семестра задаёт учебная часть. */
export async function saveSemesterLimits(input: { semesterId: string; totalPoints: number; modulePoints: number; extraMaxPoints: number }) {
  try {
    const actor = await guard();
    if (!actor) return { ok: false as const, error: "Недостаточно прав." };
    const { totalPoints, modulePoints, extraMaxPoints } = input;
    if (![totalPoints, modulePoints, extraMaxPoints].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)) {
      return { ok: false as const, error: "Введите неотрицательные числа." };
    }
    if (totalPoints <= 0 || modulePoints <= 0) return { ok: false as const, error: "Баллы семестра и модуля должны быть больше 0." };
    if (modulePoints * 2 > totalPoints + 1e-9) return { ok: false as const, error: "Два модуля не могут дать больше баллов, чем весь семестр." };
    if (extraMaxPoints > totalPoints) return { ok: false as const, error: "Дополнительные баллы больше лимита семестра." };
    const sem = await prisma.semester.findUnique({ where: { id: input.semesterId } });
    if (!sem) return { ok: false as const, error: "Семестр не найден." };
    if (sem.isLocked) return { ok: false as const, error: "Семестр закрыт." };
    await prisma.$transaction(async (tx) => {
      await tx.semester.update({ where: { id: sem.id }, data: { totalPoints, modulePoints, extraMaxPoints } });
      await tx.auditTrail.create({
        data: {
          actorType: actor.role.toLowerCase(),
          actorId: actor.id,
          action: "semester_limits_update",
          entityType: "Semester",
          entityId: sem.id,
          beforeJson: JSON.stringify({ totalPoints: sem.totalPoints, modulePoints: sem.modulePoints, extraMaxPoints: sem.extraMaxPoints }),
          afterJson: JSON.stringify({ totalPoints, modulePoints, extraMaxPoints }),
        },
        select: { id: true },
      });
    });
    revalidatePath("/acadepartment/points");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Ошибка." };
  }
}
