import { prisma } from "@/lib/prisma";

type Actor = { id: string; role: string };

export type SessionPlan =
  | {
      available: true;
      techCardId: string;
      moduleNo: 1 | 2;
      lessonNo: number;
      lessonOrdinal: number;
      moduleLessons: number;
      lessonMax: number;
      remainingAfter: number;
      attendancePerLesson: number;
      latePercent: number;
      moduleClosed: boolean;
      scoresByStudentId: Record<string, number>;
    }
  | {
      available: false;
      code: "NO_ACCESS" | "NO_CARD" | "OUT_OF_PLAN" | "OTHER";
      reason: string;
      disciplineId?: string;
      programId?: string;
      semesterId?: string;
      scoresByStudentId: Record<string, number>;
    };

/**
 * Находит для занятия строку технологической карты.
 * Занятия группы по дисциплине нумеруются по дате; n-е занятие берёт n-ю строку карты
 * (сначала занятия модуля 1, затем модуля 2).
 */
export async function loadSessionPlan(params: { classSessionId: string; actor: Actor }): Promise<SessionPlan & { semesterLocked: boolean }> {
  const { classSessionId, actor } = params;
  const none = (p: Omit<Extract<SessionPlan, { available: false }>, "available" | "scoresByStudentId">) => ({
    available: false as const,
    scoresByStudentId: {},
    semesterLocked: false,
    ...p,
  });

  if (actor.role !== "TEACHER" && actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
    return none({ code: "NO_ACCESS", reason: "Баллы за занятие ставит преподаватель." });
  }

  const session = await prisma.classSession.findFirst({
    where: { id: classSessionId, isActive: true, deletedAt: null },
    select: {
      id: true,
      disciplineId: true,
      groupId: true,
      teacherId: true,
      semesterId: true,
      group: { select: { programId: true } },
      semester: { select: { isLocked: true, module1ClosedAt: true, module2ClosedAt: true } },
    },
  });
  if (!session) return none({ code: "OTHER", reason: "Занятие не найдено." });
  if (actor.role === "TEACHER" && session.teacherId !== actor.id) {
    return none({ code: "NO_ACCESS", reason: "Нет доступа к этому занятию." });
  }
  const semesterLocked = Boolean(session.semester?.isLocked);
  if (!session.semesterId || !session.group.programId) {
    return { ...none({ code: "OTHER", reason: "Занятие вне семестра или у группы не указано направление." }), semesterLocked };
  }

  const scoreRows = await prisma.lessonScore.findMany({ where: { classSessionId }, select: { studentId: true, score: true } });
  const scoresByStudentId: Record<string, number> = {};
  for (const r of scoreRows) scoresByStudentId[r.studentId] = r.score;

  const card = await prisma.techCard.findFirst({
    where: {
      disciplineId: session.disciplineId,
      programId: session.group.programId,
      semesterId: session.semesterId,
      teacherId: session.teacherId,
      isActive: true,
      deletedAt: null,
    },
    include: { modules: { orderBy: { moduleNo: "asc" }, include: { lessons: { orderBy: { lessonNo: "asc" } } } } },
  });
  if (!card || card.modules.length === 0) {
    return {
      available: false,
      code: "NO_CARD",
      reason: "Технологическая карта по этой дисциплине ещё не заполнена.",
      disciplineId: session.disciplineId,
      programId: session.group.programId,
      semesterId: session.semesterId,
      scoresByStudentId,
      semesterLocked,
    };
  }

  const siblings = await prisma.classSession.findMany({
    where: {
      groupId: session.groupId,
      disciplineId: session.disciplineId,
      teacherId: session.teacherId,
      semesterId: session.semesterId,
      isActive: true,
      deletedAt: null,
    },
    orderBy: { startTime: "asc" },
    select: { id: true, status: true, statusV2: true },
  });
  const counted = siblings.filter((s) => ((s.statusV2 ?? s.status ?? "").trim().toLowerCase() !== "cancelled"));
  const idx = counted.findIndex((s) => s.id === session.id);
  if (idx < 0) return { ...none({ code: "OTHER", reason: "Занятие отменено." }), semesterLocked };

  const ordinal = idx + 1;
  const m1 = card.modules.find((m) => m.moduleNo === 1);
  const m2 = card.modules.find((m) => m.moduleNo === 2);
  const c1 = m1?.lessonsCount ?? 0;
  const c2 = m2?.lessonsCount ?? 0;

  let mod = null as typeof m1 | null;
  let slot = 0;
  if (m1 && ordinal <= c1) {
    mod = m1;
    slot = ordinal;
  } else if (m2 && ordinal <= c1 + c2) {
    mod = m2;
    slot = ordinal - c1;
  }
  if (!mod) {
    return {
      available: false,
      code: "OUT_OF_PLAN",
      reason: `Это занятие №${ordinal}, а в технологической карте занятий: ${c1 + c2}. Увеличьте число занятий в карте.`,
      disciplineId: session.disciplineId,
      programId: session.group.programId,
      semesterId: session.semesterId,
      scoresByStudentId,
      semesterLocked,
    };
  }

  const lessonMax = mod.lessons.find((l) => l.lessonNo === slot)?.points ?? 0;
  const remainingAfter = mod.lessons.filter((l) => l.lessonNo > slot).reduce((a, l) => a + l.points, 0);

  return {
    available: true,
    techCardId: card.id,
    moduleNo: mod.moduleNo === 2 ? 2 : 1,
    lessonNo: slot,
    lessonOrdinal: ordinal,
    moduleLessons: mod.lessonsCount,
    lessonMax,
    remainingAfter,
    attendancePerLesson: mod.lessonsCount > 0 ? mod.attendancePoints / mod.lessonsCount : 0,
    latePercent: card.latePercent,
    moduleClosed: Boolean(mod.moduleNo === 2 ? session.semester?.module2ClosedAt : session.semester?.module1ClosedAt),
    scoresByStudentId,
    semesterLocked,
  };
}
