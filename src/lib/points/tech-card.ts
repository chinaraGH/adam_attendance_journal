import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/points/calc";

type Actor = { id: string; role: string };

export const techCardInclude = {
  semester: { select: { id: true, name: true, isLocked: true, totalPoints: true, modulePoints: true, extraMaxPoints: true } },
  discipline: { select: { id: true, name: true } },
  program: { select: { id: true, name: true } },
  modules: { orderBy: { moduleNo: "asc" as const }, include: { lessons: { orderBy: { lessonNo: "asc" as const } } } },
} as const;

/** Находит карту или создаёт её с разумными значениями по умолчанию (только для преподавателя, у которого есть занятия). */
export async function ensureTechCard(params: { actor: Actor; disciplineId: string; programId: string; semesterId: string }) {
  const { actor, disciplineId, programId, semesterId } = params;
  if (actor.role !== "TEACHER") return null;

  const existing = await prisma.techCard.findFirst({
    where: { disciplineId, programId, semesterId, teacherId: actor.id, isActive: true, deletedAt: null },
    include: techCardInclude,
  });
  if (existing) return existing;

  const sessions = await prisma.classSession.findMany({
    where: { teacherId: actor.id, disciplineId, semesterId, isActive: true, deletedAt: null, group: { programId } },
    select: { groupId: true },
  });
  if (sessions.length === 0) return null;

  const perGroup = new Map<string, number>();
  for (const s of sessions) perGroup.set(s.groupId, (perGroup.get(s.groupId) ?? 0) + 1);
  const maxPerGroup = Math.max(...perGroup.values());
  const lessonsCount = Math.max(1, Math.min(30, Math.ceil(maxPerGroup / 2)));

  const semester = await prisma.semester.findUnique({ where: { id: semesterId }, select: { modulePoints: true, isLocked: true } });
  // В закрытом семестре новые карты не создаются.
  if (!semester || semester.isLocked) return null;
  const modulePoints = semester?.modulePoints ?? 50;
  const selfWork = round2(modulePoints * 0.2);
  const border = round2(modulePoints * 0.4);
  const current = round2(modulePoints - selfWork - border);
  const base = Math.floor((current / lessonsCount) * 100) / 100;
  const lessons = Array.from({ length: lessonsCount }, (_, i) => ({
    lessonNo: i + 1,
    points: i === lessonsCount - 1 ? round2(current - base * (lessonsCount - 1)) : base,
  }));

  return prisma.techCard.create({
    data: {
      disciplineId,
      programId,
      semesterId,
      teacherId: actor.id,
      latePercent: 50,
      extraMaxPoints: 0,
      modules: {
        create: [1, 2].map((moduleNo) => ({
          moduleNo,
          lessonsCount,
          attendancePoints: 0,
          selfWorkPoints: selfWork,
          currentControlPoints: current,
          borderControlPoints: border,
          lessons: { create: lessons },
        })),
      },
    },
    include: techCardInclude,
  });
}
