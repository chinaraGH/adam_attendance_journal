import { prisma } from "@/lib/prisma";
import { getCanonicalAttendanceStatusV2 } from "@/lib/attendance/status-machine";
import { attendancePointsForLesson, round2, studentTotal } from "@/lib/points/calc";

export type PointsRow = {
  studentId: string;
  name: string;
  /** по модулям: [модуль 1, модуль 2] */
  attendance: [number, number];
  current: [number, number];
  selfWork: [number, number];
  border: [number, number];
  moduleTotals: [number, number];
  extra: number;
  total: number;
  /** Присутствовал (П, О), пропустил (НБ, неподтверждённая Б), освобождён (А, подтверждённая Б) */
  attended: number;
  missed: number;
  excused: number;
  /** Отметки по видам: П, О, НБ, Б без подтверждения, Б подтверждённая, А */
  counts: { p: number; o: number; nb: number; bPending: number; bConfirmed: number; a: number };
};

export type GroupPointsReport = {
  techCardId: string;
  groupId: string;
  groupName: string;
  disciplineId: string;
  disciplineName: string;
  teacherId: string;
  programId: string;
  semesterName: string;
  limits: { modulePoints: number; totalPoints: number; extraMaxPoints: number };
  max: { attendance: [number, number]; current: [number, number]; selfWork: [number, number]; border: [number, number]; extra: number };
  moduleClosed: [boolean, boolean];
  /** Посещаемость группы, %: присутствовали (П, О) от всех отмеченных, кроме освобождённых (А, подтверждённая Б). */
  attendanceRate: number | null;
  averageTotal: number;
  rows: PointsRow[];
};

/** Считает баллы всей группы по технологической карте. Ничего не сохраняет. */
export async function buildGroupPointsReport(params: { techCardId: string; groupId: string }): Promise<GroupPointsReport | null> {
  const card = await prisma.techCard.findFirst({
    where: { id: params.techCardId, isActive: true, deletedAt: null },
    include: {
      semester: true,
      discipline: { select: { name: true } },
      modules: { orderBy: { moduleNo: "asc" } },
    },
  });
  if (!card) return null;
  const group = await prisma.group.findFirst({ where: { id: params.groupId }, select: { id: true, name: true } });
  if (!group) return null;

  const students = await prisma.student.findMany({
    where: { groupId: group.id, isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const sessions = await prisma.classSession.findMany({
    where: { groupId: group.id, disciplineId: card.disciplineId, teacherId: card.teacherId, semesterId: card.semesterId, isActive: true, deletedAt: null },
    orderBy: { startTime: "asc" },
    select: { id: true, status: true, statusV2: true },
  });
  const counted = sessions.filter((s) => (s.statusV2 ?? s.status ?? "").trim().toLowerCase() !== "cancelled");

  const m1 = card.modules.find((m) => m.moduleNo === 1);
  const m2 = card.modules.find((m) => m.moduleNo === 2);
  const c1 = m1?.lessonsCount ?? 0;
  const c2 = m2?.lessonsCount ?? 0;
  const moduleOfSession = new Map<string, 0 | 1>();
  counted.forEach((s, i) => {
    const ordinal = i + 1;
    if (ordinal <= c1) moduleOfSession.set(s.id, 0);
    else if (ordinal <= c1 + c2) moduleOfSession.set(s.id, 1);
  });

  const sessionIds = counted.map((s) => s.id);
  const [attRows, lessonRows, controlRows] = await Promise.all([
    prisma.attendance.findMany({
      where: { classSessionId: { in: sessionIds }, isActive: true, deletedAt: null },
      select: { classSessionId: true, studentId: true, status: true, statusV2: true },
    }),
    prisma.lessonScore.findMany({ where: { classSessionId: { in: sessionIds } }, select: { classSessionId: true, studentId: true, score: true } }),
    prisma.controlScore.findMany({ where: { techCardId: card.id }, select: { studentId: true, category: true, moduleNo: true, score: true } }),
  ]);

  const perLesson: [number, number] = [
    c1 > 0 ? (m1?.attendancePoints ?? 0) / c1 : 0,
    c2 > 0 ? (m2?.attendancePoints ?? 0) / c2 : 0,
  ];
  const maxMod = (pick: (m: NonNullable<typeof m1>) => number): [number, number] => [m1 ? pick(m1) : 0, m2 ? pick(m2) : 0];
  const max = {
    attendance: maxMod((m) => m.attendancePoints),
    current: maxMod((m) => m.currentControlPoints),
    selfWork: maxMod((m) => m.selfWorkPoints),
    border: maxMod((m) => m.borderControlPoints),
    extra: Math.min(card.extraMaxPoints, card.semester.extraMaxPoints),
  };
  const limits = { modulePoints: card.semester.modulePoints, totalPoints: card.semester.totalPoints, extraMaxPoints: card.semester.extraMaxPoints };

  const rows: PointsRow[] = students.map((st) => {
    const attendance: [number, number] = [0, 0];
    const current: [number, number] = [0, 0];
    const counts = { p: 0, o: 0, nb: 0, bPending: 0, bConfirmed: 0, a: 0 };
    for (const a of attRows) {
      if (a.studentId !== st.id) continue;
      const canon = getCanonicalAttendanceStatusV2(a);
      if (canon === "P") counts.p += 1;
      else if (canon === "O") counts.o += 1;
      else if (canon === "NB") counts.nb += 1;
      else if (canon === "B_PENDING") counts.bPending += 1;
      else if (canon === "B_CONFIRMED") counts.bConfirmed += 1;
      else if (canon === "A") counts.a += 1;
      const mi = moduleOfSession.get(a.classSessionId);
      if (mi === undefined) continue;
      attendance[mi] += attendancePointsForLesson(getCanonicalAttendanceStatusV2(a), perLesson[mi], card.latePercent);
    }
    for (const l of lessonRows) {
      if (l.studentId !== st.id) continue;
      const mi = moduleOfSession.get(l.classSessionId);
      if (mi === undefined) continue;
      current[mi] += l.score;
    }
    const ctl = (category: string, moduleNo: number) =>
      controlRows.find((c) => c.studentId === st.id && c.category === category && c.moduleNo === moduleNo)?.score ?? 0;
    const selfWork: [number, number] = [Math.min(ctl("SELF_WORK", 1), max.selfWork[0]), Math.min(ctl("SELF_WORK", 2), max.selfWork[1])];
    const border: [number, number] = [Math.min(ctl("BORDER_CONTROL", 1), max.border[0]), Math.min(ctl("BORDER_CONTROL", 2), max.border[1])];
    const att: [number, number] = [Math.min(round2(attendance[0]), max.attendance[0]), Math.min(round2(attendance[1]), max.attendance[1])];
    const cur: [number, number] = [Math.min(round2(current[0]), max.current[0]), Math.min(round2(current[1]), max.current[1])];
    const moduleTotals: [number, number] = [
      Math.min(round2(att[0] + cur[0] + selfWork[0] + border[0]), limits.modulePoints),
      Math.min(round2(att[1] + cur[1] + selfWork[1] + border[1]), limits.modulePoints),
    ];
    const extra = Math.min(ctl("EXTRA", 0), max.extra);
    return {
      studentId: st.id,
      name: st.name,
      attendance: att,
      current: cur,
      selfWork,
      border,
      moduleTotals,
      extra,
      total: studentTotal({ moduleTotals, extra, limits }),
      attended: counts.p + counts.o,
      missed: counts.nb + counts.bPending,
      excused: counts.a + counts.bConfirmed,
      counts,
    };
  });

  // Посещаемость группы
  let present = 0;
  let marked = 0;
  for (const a of attRows) {
    const s = getCanonicalAttendanceStatusV2(a);
    if (s === "A" || s === "B_CONFIRMED" || s === "S" || !s) continue;
    marked += 1;
    if (s === "P" || s === "O") present += 1;
  }

  return {
    techCardId: card.id,
    groupId: group.id,
    groupName: group.name,
    disciplineId: card.disciplineId,
    disciplineName: card.discipline.name,
    teacherId: card.teacherId,
    programId: card.programId,
    semesterName: card.semester.name ?? "семестр",
    limits,
    max,
    moduleClosed: [Boolean(card.semester.module1ClosedAt), Boolean(card.semester.module2ClosedAt)],
    attendanceRate: marked > 0 ? Math.round((present / marked) * 1000) / 10 : null,
    averageTotal: rows.length ? round2(rows.reduce((a, r) => a + r.total, 0) / rows.length) : 0,
    rows,
  };
}

/** Группы, которым преподаватель ведёт дисциплину по карте (по расписанию). */
export async function groupsForTechCard(card: { disciplineId: string; teacherId: string; semesterId: string; programId: string }) {
  const sessions = await prisma.classSession.findMany({
    where: {
      disciplineId: card.disciplineId,
      teacherId: card.teacherId,
      semesterId: card.semesterId,
      isActive: true,
      deletedAt: null,
      group: { programId: card.programId },
    },
    select: { group: { select: { id: true, name: true } } },
  });
  const map = new Map<string, string>();
  for (const s of sessions) map.set(s.group.id, s.group.name);
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "ru"));
}
