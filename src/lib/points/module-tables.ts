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
import type { StyleKey, XCell, XSheet } from "../xlsx/styled-xlsx";

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
  return Math.round((part / whole) * 10000) / 100;
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

// ---------- Листы для выгрузки в Excel ----------
// Оформление рассчитано на печать на чёрно-белом принтере: без заливок и цветов.

export type SheetMeta = { groupName: string; disciplineName: string; teacherName: string; semesterName: string };

/** Число с двумя знаками после запятой в тексте заголовка: 5 → «5,00». */
const fmt2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");
const cell = (v: string | number | null, s: StyleKey): XCell => ({ v, s });
/** Заголовок колонки: название, на второй строке максимум в скобках. */
const withMax = (label: string, max: number) => `${label}\n(${fmt2(max)})`;

/** Две верхние строки: заголовок и подзаголовок по центру на всю ширину таблицы. */
function titleBlock(width: number, title: string, subtitle: string) {
  const cells: XCell[][] = [[cell(title, "title")], [cell(subtitle, "subtitle")]];
  const merges: [number, number, number, number][] = [
    [0, 0, 0, width - 1],
    [1, 0, 1, width - 1],
  ];
  return { cells, merges };
}

const subtitleOf = (m: SheetMeta) => `${m.disciplineName} · ${m.teacherName} · ${m.semesterName}`;

export function attendanceSheet(t: ModuleTables, meta: SheetMeta): XSheet {
  const L = t.lessons.length;
  const width = 1 + L + 4;
  const { cells, merges } = titleBlock(width, `Посещаемость модуля ${t.moduleNo}, группа ${meta.groupName}`, subtitleOf(meta));

  cells.push([
    cell("Студент", "head"),
    ...t.lessons.map((l) => cell(`${l.no}\n${l.date}`, "head")),
    cell("Был", "head"),
    cell("Пропущено", "head"),
    cell("Освобождён", "head"),
    cell("% пропусков", "head"),
  ]);

  t.attendance.forEach((r, i) => {
    cells.push([
      cell(`${i + 1}. ${r.name}`, "name"),
      ...r.cells.map((c) => cell(statusShort(c), "status")),
      cell(r.present, "int"),
      cell(r.missed, "int"),
      cell(r.excused, "int"),
      r.missedPercent === null ? cell("—", "dash") : cell(r.missedPercent, "pct"),
    ]);
  });

  const legendRow = cells.length + 1; // пустая строка между таблицей и пояснением
  cells.push([]);
  cells.push([cell(`${STATUS_LEGEND}. Процент пропусков: пропущено ÷ (был + пропущено); освобождённые занятия не учитываются.`, "legend")]);
  merges.push([legendRow, 0, legendRow, width - 1]);

  return {
    name: `Посещаемость, модуль ${t.moduleNo}`,
    cells,
    merges,
    colWidths: [34, ...t.lessons.map(() => 8), 10, 13, 14, 16],
    freeze: { rows: 3, cols: 1 },
    rowHeights: { 0: 26, 1: 20, 2: 34, [legendRow]: 44 },
  };
}

export function pointsSheet(t: ModuleTables, meta: SheetMeta): XSheet {
  const L = t.lessons.length;
  const width = 1 + L * 2 + 5;
  const { cells, merges } = titleBlock(width, `Баллы по занятиям модуля ${t.moduleNo}, группа ${meta.groupName}`, subtitleOf(meta));

  // две строки заголовка: номер занятия с датой, под ним «Пос.» и «Тек.» с максимумами в скобках
  const top: XCell[] = [cell("Студент", "head")];
  const sub: XCell[] = [cell(null, "head")];
  merges.push([2, 0, 3, 0]);
  t.lessons.forEach((l, k) => {
    const c = 1 + k * 2;
    top.push(cell(`Занятие ${l.no}\n${l.date}`, "head"), cell(null, "head"));
    sub.push(cell(withMax("Пос.", l.attendanceMax), "head"), cell(withMax("Тек.", l.scoreMax), "head"));
    merges.push([2, c, 2, c + 1]);
  });
  const totals = [
    withMax("Посещ.", t.max.attendance),
    withMax("Текущий", t.max.current),
    withMax("СРС", t.max.selfWork),
    withMax("РК", t.max.border),
    withMax("Итого", t.max.total),
  ];
  totals.forEach((label, k) => {
    const c = 1 + L * 2 + k;
    top.push(cell(label, "head"));
    sub.push(cell(null, "head"));
    merges.push([2, c, 3, c]);
  });
  cells.push(top, sub);

  t.points.forEach((r, i) => {
    cells.push([
      cell(`${i + 1}. ${r.name}`, "name"),
      ...r.cells.flatMap((c) => [
        c.attendance === null ? cell("—", "dash") : cell(c.attendance, "num"),
        c.current === null ? cell("—", "dash") : cell(c.current, "num"),
      ]),
      cell(r.attendanceSum, "num"),
      cell(r.currentSum, "num"),
      cell(r.selfWork, "num"),
      cell(r.border, "num"),
      cell(r.total, "total"),
    ]);
  });

  return {
    name: `Баллы, модуль ${t.moduleNo}`,
    cells,
    merges,
    colWidths: [34, ...t.lessons.flatMap(() => [10, 10]), 13, 13, 12, 12, 12],
    freeze: { rows: 4, cols: 1 },
    rowHeights: { 0: 26, 1: 20, 2: 32, 3: 32 },
  };
}

export function summarySheet(t: ModuleTables, meta: SheetMeta): XSheet {
  const width = 6;
  const { cells, merges } = titleBlock(width, `Итог модуля ${t.moduleNo}, группа ${meta.groupName}`, subtitleOf(meta));
  cells.push([
    cell("Студент", "head"),
    cell(withMax("Посещаемость", t.max.attendance), "head"),
    cell(withMax("Текущий контроль", t.max.current), "head"),
    cell(withMax("СРС", t.max.selfWork), "head"),
    cell(withMax("Рубежный контроль", t.max.border), "head"),
    cell(withMax("Итого за модуль", t.max.total), "head"),
  ]);
  t.summary.forEach((r, i) => {
    cells.push([
      cell(`${i + 1}. ${r.name}`, "name"),
      cell(r.attendance, "num"),
      cell(r.current, "num"),
      cell(r.selfWork, "num"),
      cell(r.border, "num"),
      cell(r.total, "total"),
    ]);
  });
  if (t.summary.length > 0) {
    const avg = (pick: (r: SummaryRow) => number) => round2(t.summary.reduce((a, r) => a + pick(r), 0) / t.summary.length);
    cells.push([
      cell("Среднее по группе", "avgName"),
      cell(avg((r) => r.attendance), "avg"),
      cell(avg((r) => r.current), "avg"),
      cell(avg((r) => r.selfWork), "avg"),
      cell(avg((r) => r.border), "avg"),
      cell(avg((r) => r.total), "avg"),
    ]);
  }
  return {
    name: `Итог, модуль ${t.moduleNo}`,
    cells,
    merges,
    colWidths: [34, 17, 19, 12, 19, 18],
    freeze: { rows: 3, cols: 1 },
    rowHeights: { 0: 26, 1: 20, 2: 34 },
  };
}
