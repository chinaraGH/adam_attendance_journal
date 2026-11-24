/**
 * Таблицы итогов группы по модулям (без базы данных, только расчёт).
 *
 * Для каждого модуля строятся три таблицы:
 *  1) посещаемость по занятиям: отметка каждого студента за каждое занятие, сколько пропущено, % пропусков;
 *  2) баллы по занятиям: за каждое занятие баллы за посещение и за текущий контроль, затем СРС, РК и итог модуля;
 *  3) общий итог модуля: посещаемость, текущий контроль, СРС, РК, итог.
 *
 * Суммы по студенту берутся из уже посчитанных строк отчёта (см. report.ts), чтобы цифры совпадали с итогом семестра.
 */
import { attendancePointsForLesson, round2 } from "./calc";

export type CanonStatus = "P" | "O" | "NB" | "B_PENDING" | "B_CONFIRMED" | "A" | "S";

export type ModuleLessonInput = {
  sessionId: string;
  /** Номер занятия внутри модуля (1, 2, …). */
  lessonNo: number;
  startTime: Date;
  /** Сколько баллов за это занятие задано в карте (текущий контроль). */
  scoreMax: number;
};

export type ModuleStudentTotals = {
  attendance: number;
  current: number;
  selfWork: number;
  border: number;
  total: number;
};

export type ModuleInput = {
  moduleNo: 1 | 2;
  closed: boolean;
  /** Сколько занятий задано в карте для модуля. */
  lessonsPlanned: number;
  /** Занятия расписания, попавшие в модуль (по порядку). */
  lessons: ModuleLessonInput[];
  attendancePerLesson: number;
  latePercent: number;
  max: { attendance: number; current: number; selfWork: number; border: number; total: number };
};

export type StudentInput = { id: string; name: string };

export type ModuleDataInput = {
  module: ModuleInput;
  students: StudentInput[];
  /** Отметка посещаемости: ключ `${sessionId}|${studentId}`. */
  statusOf: (sessionId: string, studentId: string) => CanonStatus | null;
  /** Оценка за занятие: ключ `${sessionId}|${studentId}`, null, если оценка не ставилась. */
  scoreOf: (sessionId: string, studentId: string) => number | null;
  /** Суммы студента за модуль из отчёта. */
  totalsOf: (studentId: string) => ModuleStudentTotals;
};

export type LessonColumn = {
  no: number;
  /** дд.мм по Бишкеку */
  date: string;
  scoreMax: number;
  attendanceMax: number;
};

export type AttendanceRow = {
  studentId: string;
  name: string;
  cells: (CanonStatus | null)[];
  /** П + О */
  present: number;
  /** НБ + Б без подтверждения */
  missed: number;
  /** А + подтверждённая Б */
  excused: number;
  /** Пропуски от занятий, по которым студент не освобождён: missed / (present + missed), %. */
  missedPercent: number | null;
};

export type PointsLessonRow = {
  studentId: string;
  name: string;
  cells: { attendance: number | null; current: number | null }[];
  attendanceSum: number;
  currentSum: number;
  selfWork: number;
  border: number;
  total: number;
};

export type SummaryRow = {
  studentId: string;
  name: string;
  attendance: number;
  current: number;
  selfWork: number;
  border: number;
  total: number;
};

export type ModuleTables = {
  moduleNo: 1 | 2;
  closed: boolean;
  lessonsPlanned: number;
  lessons: LessonColumn[];
  max: ModuleInput["max"];
  attendance: AttendanceRow[];
  points: PointsLessonRow[];
  summary: SummaryRow[];
  /** Пропуски по группе за модуль, %. */
  groupMissedPercent: number | null;
  averageTotal: number;
};

export type Cell = string | number | null;

const BISHKEK_OFFSET_MS = 6 * 60 * 60 * 1000;

/** дд.мм по времени Бишкека (UTC+6). */
export function bishkekDayMonth(d: Date): string {
  const t = new Date(d.getTime() + BISHKEK_OFFSET_MS);
  const dd = String(t.getUTCDate()).padStart(2, "0");
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

/** Короткая подпись отметки. */
export function statusShort(s: CanonStatus | null): string {
  switch (s) {
    case "P":
      return "П";
    case "O":
      return "О";
    case "NB":
      return "НБ";
    case "B_PENDING":
      return "Б*";
    case "B_CONFIRMED":
      return "Б";
    case "A":
      return "А";
    case "S":
      return "С";
    default:
      return "—";
  }
}

export const STATUS_LEGEND =
  "П — присутствовал · О — опоздал · НБ — не был · Б* — болезнь без подтверждения (считается пропуском) · Б — болезнь подтверждена · А — освобождён куратором · С — не отмечено к концу занятия · — занятие ещё не отмечено";

function percent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export function buildModuleTables(input: ModuleDataInput): ModuleTables {
  const { module: m, students, statusOf, scoreOf, totalsOf } = input;
  const attMaxPerLesson = round2(m.attendancePerLesson);
  const lessons: LessonColumn[] = m.lessons.map((l) => ({
    no: l.lessonNo,
    date: bishkekDayMonth(l.startTime),
    scoreMax: round2(l.scoreMax),
    attendanceMax: attMaxPerLesson,
  }));

  let groupPresent = 0;
  let groupMissed = 0;

  const attendance: AttendanceRow[] = students.map((st) => {
    let present = 0;
    let missed = 0;
    let excused = 0;
    const cells = m.lessons.map((l) => {
      const s = statusOf(l.sessionId, st.id);
      if (s === "P" || s === "O") present += 1;
      else if (s === "NB" || s === "B_PENDING") missed += 1;
      else if (s === "A" || s === "B_CONFIRMED") excused += 1;
      return s;
    });
    groupPresent += present;
    groupMissed += missed;
    return { studentId: st.id, name: st.name, cells, present, missed, excused, missedPercent: percent(missed, present + missed) };
  });

  const points: PointsLessonRow[] = students.map((st) => {
    const t = totalsOf(st.id);
    const cells = m.lessons.map((l) => {
      const s = statusOf(l.sessionId, st.id);
      const score = scoreOf(l.sessionId, st.id);
      return {
        attendance: s === null ? null : attendancePointsForLesson(s, m.attendancePerLesson, m.latePercent),
        current: score === null ? null : round2(score),
      };
    });
    return {
      studentId: st.id,
      name: st.name,
      cells,
      attendanceSum: t.attendance,
      currentSum: t.current,
      selfWork: t.selfWork,
      border: t.border,
      total: t.total,
    };
  });

  const summary: SummaryRow[] = students.map((st) => {
    const t = totalsOf(st.id);
    return { studentId: st.id, name: st.name, attendance: t.attendance, current: t.current, selfWork: t.selfWork, border: t.border, total: t.total };
  });

  return {
    moduleNo: m.moduleNo,
    closed: m.closed,
    lessonsPlanned: m.lessonsPlanned,
    lessons,
    max: m.max,
    attendance,
    points,
    summary,
    groupMissedPercent: percent(groupMissed, groupPresent + groupMissed),
    averageTotal: summary.length ? round2(summary.reduce((a, r) => a + r.total, 0) / summary.length) : 0,
  };
}

// ---------- Строки для выгрузки в Excel (числа остаются числами) ----------

export function attendanceSheet(t: ModuleTables): Cell[][] {
  const head: Cell[] = ["Студент", ...t.lessons.map((l) => `Занятие ${l.no} (${l.date})`), "Присутствовал", "Пропущено", "Освобождён", "% пропусков"];
  const body: Cell[][] = t.attendance.map((r) => [
    r.name,
    ...r.cells.map((c) => statusShort(c)),
    r.present,
    r.missed,
    r.excused,
    r.missedPercent,
  ]);
  const legend: Cell[][] = [[], [STATUS_LEGEND]];
  return [head, ...body, ...legend];
}

export function pointsSheet(t: ModuleTables): Cell[][] {
  const head: Cell[] = ["Студент"];
  const maxRow: Cell[] = ["Максимум"];
  for (const l of t.lessons) {
    head.push(`Занятие ${l.no} (${l.date}): посещаемость`, `Занятие ${l.no} (${l.date}): текущий контроль`);
    maxRow.push(l.attendanceMax, l.scoreMax);
  }
  head.push("Посещаемость, сумма", "Текущий контроль, сумма", "СРС", "Рубежный контроль", `Итого за модуль ${t.moduleNo}`);
  maxRow.push(t.max.attendance, t.max.current, t.max.selfWork, t.max.border, t.max.total);
  const body: Cell[][] = t.points.map((r) => [
    r.name,
    ...r.cells.flatMap((c) => [c.attendance, c.current] as Cell[]),
    r.attendanceSum,
    r.currentSum,
    r.selfWork,
    r.border,
    r.total,
  ]);
  return [head, maxRow, ...body];
}

export function summarySheet(t: ModuleTables): Cell[][] {
  const head: Cell[] = ["Студент", "Посещаемость", "Текущий контроль", "СРС", "Рубежный контроль", `Итого за модуль ${t.moduleNo}`];
  const maxRow: Cell[] = ["Максимум", t.max.attendance, t.max.current, t.max.selfWork, t.max.border, t.max.total];
  const body: Cell[][] = t.summary.map((r) => [r.name, r.attendance, r.current, r.selfWork, r.border, r.total]);
  return [head, maxRow, ...body];
}
