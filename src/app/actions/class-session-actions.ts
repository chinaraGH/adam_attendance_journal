"use server";

import { addMinutes, isAfter } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { prisma } from "@/lib/prisma";
import { BISHKEK_TIME_ZONE, getBishkekNow } from "@/lib/time/bishkek-now";
import { getEffectiveClassSessionStatus } from "@/lib/class-session/effective-status";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";

export async function openJournal(input: { classSessionId: string }) {
  if (!input || typeof input.classSessionId !== "string" || input.classSessionId.length === 0) {
    return { ok: false as const, error: "Некорректный идентификатор занятия." };
  }

  const actor = await getCurrentUserOrRedirect();

  const session = await prisma.classSession.findFirst({
    where: { id: input.classSessionId, isActive: true, deletedAt: null },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      openedAt: true,
      flagLateTeacher: true,
      status: true,
      statusV2: true,
    },
  });

  if (!session) return { ok: false as const, error: "Занятие не найдено или недоступно." };

  const effective = getEffectiveClassSessionStatus({
    startTime: session.startTime,
    endTime: session.endTime,
    openedAt: session.openedAt,
    status: session.status,
    statusV2: session.statusV2,
  });

  if (effective !== "active") {
    return { ok: false as const, error: "Журнал можно открыть только во время активного занятия." };
  }

  if (session.openedAt) {
    return {
      ok: true as const,
      classSession: { id: session.id, openedAt: session.openedAt, flagLateTeacher: session.flagLateTeacher },
    };
  }

  const nowBishkek = getBishkekNow();
  const startBishkek = toZonedTime(session.startTime, BISHKEK_TIME_ZONE);
  const openedAtBishkek = nowBishkek;

  const isLate = isAfter(openedAtBishkek, addMinutes(startBishkek, 16));

  const updated = await prisma.classSession.update({
    where: { id: session.id },
    data: {
      openedAt: new Date(),
      flagLateTeacher: isLate,
    },
    select: { id: true, openedAt: true, flagLateTeacher: true },
  });

  await prisma.auditTrail.create({
    data: {
      actorType: "teacher",
      actorId: actor.id,
      action: "open_journal",
      entityType: "ClassSession",
      entityId: updated.id,
      beforeJson: JSON.stringify({ openedAt: null, flagLateTeacher: session.flagLateTeacher }),
      afterJson: JSON.stringify({ openedAt: updated.openedAt, flagLateTeacher: updated.flagLateTeacher }),
    },
    select: { id: true },
  });

  return { ok: true as const, classSession: updated };
}

