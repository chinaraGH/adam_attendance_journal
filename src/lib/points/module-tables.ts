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

// ---------- Оформленные листы для выгрузки в Excel ----------

export type SheetMeta = { groupName: string; disciplineName: string; teacherName: string; semesterName: string };

const fmt = (n: number) => String(round2(n)).replace(".", ",");
const cell = (v: string | number | null, s: StyleKey): XCell => ({ v, s });

function statusStyle(c: CanonStatus | null): StyleKey {
  switch (c) {
    case "P":
      return "statusP";
    case "O":
      return "statusO";
    case "NB":
      return "statusNB";
    case "B_PENDING":
      return "statusBP";
    case "B_CONFIRMED":
      return "statusBC";
    case "A":
      return "statusA";
    case "S":
      return "statusS";
    default:
      return "statusNone";
  }
}

/** Две верхние строки: заголовок и подзаголовок на всю ширину таблицы. */
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
  const { cells, merges } = titleBlock(width, `Посещаемость по занятиям · ${meta.groupName} · Модуль ${t.moduleNo}`, subtitleOf(meta));

  cells.push([
    cell("Студент", "headLeft"),
    ...t.lessons.map((l) => cell(`${l.no}\n${l.date}`, "head")),
    cell("Был", "head"),
    cell("Пропущено", "head"),
    cell("Освобождён", "head"),
    cell("% пропусков", "head"),
  ]);

  t.attendance.forEach((r, i) => {
    const b = i % 2 === 1;
    cells.push([
      cell(`${i + 1}. ${r.name}`, b ? "nameBand" : "name"),
      ...r.cells.map((c) => cell(statusShort(c), statusStyle(c))),
      cell(r.present, b ? "numBand" : "num"),
      cell(r.missed, r.missed > 0 ? (b ? "alertBand" : "alert") : b ? "numBand" : "num"),
      cell(r.excused, b ? "numBand" : "num"),
      r.missedPercent === null ? cell("—", b ? "dashBand" : "dash") : cell(r.missedPercent, b ? "pctBand" : "pct"),
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
    colWidths: [34, ...t.lessons.map(() => 7), 9, 12, 13, 14],
    freeze: { rows: 3, cols: 1 },
    rowHeights: { 0: 26, 1: 20, 2: 36, [legendRow]: 44 },
  };
}

export function pointsSheet(t: ModuleTables, meta: SheetMeta): XSheet {
  const L = t.lessons.length;
  const width = 1 + L * 2 + 5;
  const { cells, merges } = titleBlock(width, `Баллы по занятиям · ${meta.groupName} · Модуль ${t.moduleNo}`, subtitleOf(meta));

  // две строки заголовка: номер занятия с датой, под ним «Пос.» и «Тек.» с максимумами
  const top: XCell[] = [cell("Студент", "headLeft")];
  const sub: XCell[] = [cell(null, "headLeft")];
  merges.push([2, 0, 3, 0]);
  t.lessons.forEach((l, k) => {
    const c = 1 + k * 2;
    top.push(cell(`Занятие ${l.no}\n${l.date}`, "head"), cell(null, "head"));
    sub.push(cell(`Пос.\n${fmt(l.attendanceMax)}`, "headSub"), cell(`Тек.\n${fmt(l.scoreMax)}`, "headSub"));
    merges.push([2, c, 2, c + 1]);
  });
  const totals = [
    "Посещ.\nсумма",
    "Текущий\nсумма",
    `СРС\nмакс. ${fmt(t.max.selfWork)}`,
    `РК\nмакс. ${fmt(t.max.border)}`,
    `Итого\nмакс. ${fmt(t.max.total)}`,
  ];
  totals.forEach((label, k) => {
    const c = 1 + L * 2 + k;
    top.push(cell(label, "head"));
    sub.push(cell(null, "head"));
    merges.push([2, c, 3, c]);
  });
  cells.push(top, sub);

  t.points.forEach((r, i) => {
    const b = i % 2 === 1;
    const num: StyleKey = b ? "numBand" : "num";
    const dash: StyleKey = b ? "dashBand" : "dash";
    cells.push([
      cell(`${i + 1}. ${r.name}`, b ? "nameBand" : "name"),
      ...r.cells.flatMap((c) => [
        c.attendance === null ? cell("—", dash) : cell(c.attendance, num),
        c.current === null ? cell("—", dash) : cell(c.current, num),
      ]),
      cell(r.attendanceSum, num),
      cell(r.currentSum, num),
      cell(r.selfWork, num),
      cell(r.border, num),
      cell(r.total, b ? "totalBand" : "total"),
    ]);
  });

  return {
    name: `Баллы, модуль ${t.moduleNo}`,
    cells,
    merges,
    colWidths: [34, ...t.lessons.flatMap(() => [8, 8]), 13, 13, 11, 11, 11],
    freeze: { rows: 4, cols: 1 },
    rowHeights: { 0: 26, 1: 20, 2: 32, 3: 32 },
  };
}

export function summarySheet(t: ModuleTables, meta: SheetMeta): XSheet {
  const width = 6;
  const { cells, merges } = titleBlock(width, `Итог модуля · ${meta.groupName} · Модуль ${t.moduleNo}`, subtitleOf(meta));
  cells.push([
    cell("Студент", "headLeft"),
    cell(`Посещаемость\nмакс. ${fmt(t.max.attendance)}`, "head"),
    cell(`Текущий контроль\nмакс. ${fmt(t.max.current)}`, "head"),
    cell(`СРС\nмакс. ${fmt(t.max.selfWork)}`, "head"),
    cell(`Рубежный контроль\nмакс. ${fmt(t.max.border)}`, "head"),
    cell(`Итого за модуль\nмакс. ${fmt(t.max.total)}`, "head"),
  ]);
  t.summary.forEach((r, i) => {
    const b = i % 2 === 1;
    const num: StyleKey = b ? "numBand" : "num";
    cells.push([
      cell(`${i + 1}. ${r.name}`, b ? "nameBand" : "name"),
      cell(r.attendance, num),
      cell(r.current, num),
      cell(r.selfWork, num),
      cell(r.border, num),
      cell(r.total, b ? "totalBand" : "total"),
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
    colWidths: [34, 16, 18, 12, 18, 18],
    freeze: { rows: 3, cols: 1 },
    rowHeights: { 0: 26, 1: 20, 2: 36 },
  };
}
