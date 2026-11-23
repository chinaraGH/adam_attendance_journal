import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/points/calc";
import { buildGroupPointsReport, groupsForTechCard } from "@/lib/points/report";

/** Студент считается «в зоне риска», если посещаемость ниже этого процента. */
export const ATTENDANCE_RISK_PERCENT = 70;

export type Counts = { p: number; o: number; nb: number; bPending: number; bConfirmed: number; a: number };
const emptyCounts = (): Counts => ({ p: 0, o: 0, nb: 0, bPending: 0, bConfirmed: 0, a: 0 });

export type AnalyticsRow = {
  cardId: string;
  groupId: string;
  groupName: string;
  /** Курс группы (по году набора из названия и началу семестра); null — определить не удалось */
  course: number | null;
  disciplineId: string;
  disciplineName: string;
  teacherId: string;
  teacherName: string;
  programId: string;
  programName: string;
  studentId: string;
  studentName: string;
  counts: Counts;
  total: number;
  totalMax: number;
};

export type Aggregate = {
  students: number;
  groups: number;
  disciplines: number;
  teachers: number;
  counts: Counts;
  /** всего отметок посещаемости */
  marks: number;
  /** присутствовали (П + О) */
  attended: number;
  /** пропустили (НБ + Б без подтверждения) */
  missed: number;
  /** освобождены (А + подтверждённая Б) */
  excused: number;
  /** посещаемость, %: присутствовали от (присутствовали + пропустили); null — отметок ещё нет */
  attendanceRate: number | null;
  averageTotal: number;
  minTotal: number;
  maxTotalScore: number;
  totalMax: number;
  atRisk: number;
  /** распределение итоговых баллов (в процентах от максимума) */
  bands: { high: number; good: number; mid: number; low: number };
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Курс по году набора из названия группы («ИСТ-5-25» → набор 2025) и началу семестра. */
export function courseOf(groupName: string, semesterStart: Date): number | null {
  const m = /-(\d{2})\s*$/.exec(groupName.trim());
  if (!m) return null;
  const enrollmentYear = 2000 + Number(m[1]);
  const start = new Date(semesterStart);
  const academicYearStart = start.getUTCMonth() >= 7 ? start.getUTCFullYear() : start.getUTCFullYear() - 1;
  const course = academicYearStart - enrollmentYear + 1;
  return course >= 1 && course <= 6 ? course : null;
}

export function sumCounts(rows: Array<{ counts: Counts }>): Counts {
  const c = emptyCounts();
  for (const r of rows) {
    c.p += r.counts.p;
    c.o += r.counts.o;
    c.nb += r.counts.nb;
    c.bPending += r.counts.bPending;
    c.bConfirmed += r.counts.bConfirmed;
    c.a += r.counts.a;
  }
  return c;
}

export function aggregate(rows: AnalyticsRow[]): Aggregate {
  const counts = sumCounts(rows);
  const attended = counts.p + counts.o;
  const missed = counts.nb + counts.bPending;
  const excused = counts.a + counts.bConfirmed;
  const perStudent = new Map<string, { a: number; m: number }>();
  for (const r of rows) {
    const x = perStudent.get(r.studentId) ?? { a: 0, m: 0 };
    x.a += r.counts.p + r.counts.o;
    x.m += r.counts.nb + r.counts.bPending;
    perStudent.set(r.studentId, x);
  }
  let atRisk = 0;
  for (const x of perStudent.values()) {
    if (x.a + x.m > 0 && (x.a / (x.a + x.m)) * 100 < ATTENDANCE_RISK_PERCENT) atRisk += 1;
  }
  const bands = { high: 0, good: 0, mid: 0, low: 0 };
  for (const r of rows) {
    const share = r.totalMax > 0 ? (r.total / r.totalMax) * 100 : 0;
    if (share >= 90) bands.high += 1;
    else if (share >= 70) bands.good += 1;
    else if (share >= 50) bands.mid += 1;
    else bands.low += 1;
  }
  const totals = rows.map((r) => r.total);
  return {
    students: perStudent.size,
    groups: new Set(rows.map((r) => r.groupId)).size,
    disciplines: new Set(rows.map((r) => r.disciplineId)).size,
    teachers: new Set(rows.map((r) => r.teacherId)).size,
    counts,
    marks: attended + missed + excused,
    attended,
    missed,
    excused,
    attendanceRate: attended + missed > 0 ? round1((attended / (attended + missed)) * 100) : null,
    averageTotal: rows.length ? round2(totals.reduce((a, v) => a + v, 0) / rows.length) : 0,
    minTotal: totals.length ? Math.min(...totals) : 0,
    maxTotalScore: totals.length ? Math.max(...totals) : 0,
    totalMax: rows[0]?.totalMax ?? 100,
    atRisk,
    bands,
  };
}

/** Считает строки «студент × дисциплина» по всем технологическим картам направлений. programIds = null — все направления. */
export async function loadAnalyticsRows(programIds: string[] | null): Promise<AnalyticsRow[]> {
  const cards = await prisma.techCard.findMany({
    where: { isActive: true, deletedAt: null, semester: { isLocked: false }, ...(programIds === null ? {} : { programId: { in: programIds } }) },
    include: {
      discipline: { select: { name: true } },
      teacher: { select: { name: true } },
      program: { select: { name: true } },
      semester: { select: { startDate: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const jobs: Array<{ card: (typeof cards)[number]; groupId: string }> = [];
  for (const c of cards) for (const g of await groupsForTechCard(c)) jobs.push({ card: c, groupId: g.id });

  const rows: AnalyticsRow[] = [];
  const CHUNK = 4;
  for (let i = 0; i < jobs.length; i += CHUNK) {
    const part = await Promise.all(jobs.slice(i, i + CHUNK).map((j) => buildGroupPointsReport({ techCardId: j.card.id, groupId: j.groupId })));
    part.forEach((rep, k) => {
      if (!rep) return;
      const c = jobs[i + k].card;
      const course = courseOf(rep.groupName, c.semester.startDate);
      for (const r of rep.rows) {
        rows.push({
          cardId: c.id,
          groupId: rep.groupId,
          groupName: rep.groupName,
          course,
          disciplineId: c.disciplineId,
          disciplineName: c.discipline.name,
          teacherId: c.teacherId,
          teacherName: c.teacher.name,
          programId: c.programId,
          programName: c.program.name,
          studentId: r.studentId,
          studentName: r.name,
          counts: r.counts,
          total: r.total,
          totalMax: rep.limits.totalPoints,
        });
      }
    });
  }
  return rows;
}
