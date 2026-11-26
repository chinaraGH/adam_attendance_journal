import { prisma } from "@/lib/prisma";
import { buildGroupPointsReport, type GroupPointsReport, type PointsRow } from "@/lib/points/report";

export type StudentDisciplinePoints = {
  cardId: string;
  semesterName: string;
  semesterStart: Date;
  disciplineName: string;
  teacherName: string;
  row: PointsRow;
  max: GroupPointsReport["max"];
  limits: GroupPointsReport["limits"];
  moduleClosed: [boolean, boolean];
};

/** Баллы одного студента по всем его дисциплинам. Чужие строки отчёта наружу не отдаются. */
export async function loadStudentPoints(studentId: string, groupId: string): Promise<StudentDisciplinePoints[]> {
  const group = await prisma.group.findFirst({ where: { id: groupId }, select: { programId: true } });
  if (!group?.programId) return [];

  const sessions = await prisma.classSession.findMany({
    where: { groupId, isActive: true, deletedAt: null, semesterId: { not: null } },
    select: { disciplineId: true, teacherId: true, semesterId: true },
  });
  const pairs = new Set(sessions.map((s) => `${s.disciplineId}|${s.teacherId}|${s.semesterId}`));
  if (pairs.size === 0) return [];

  const cards = await prisma.techCard.findMany({
    where: { programId: group.programId, isActive: true, deletedAt: null },
    include: { discipline: { select: { name: true } }, teacher: { select: { name: true } }, semester: { select: { name: true, startDate: true } } },
    orderBy: { createdAt: "asc" },
  });
  const mine = cards.filter((c) => pairs.has(`${c.disciplineId}|${c.teacherId}|${c.semesterId}`));

  const out: StudentDisciplinePoints[] = [];
  const CHUNK = 3;
  for (let i = 0; i < mine.length; i += CHUNK) {
    const part = await Promise.all(mine.slice(i, i + CHUNK).map((c) => buildGroupPointsReport({ techCardId: c.id, groupId })));
    part.forEach((rep, k) => {
      const c = mine[i + k];
      const row = rep?.rows.find((r) => r.studentId === studentId);
      if (!rep || !row) return;
      out.push({
        cardId: c.id,
        semesterName: c.semester.name ?? "Семестр",
        semesterStart: c.semester.startDate,
        disciplineName: c.discipline.name,
        teacherName: c.teacher.name,
        row,
        max: rep.max,
        limits: rep.limits,
        moduleClosed: rep.moduleClosed,
      });
    });
  }
  return out.sort((a, b) => b.semesterStart.getTime() - a.semesterStart.getTime() || a.disciplineName.localeCompare(b.disciplineName, "ru"));
}
