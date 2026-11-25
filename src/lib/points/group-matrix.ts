/**
 * Ведомость посещаемости группы для учебной части: студенты × занятия.
 * Чистый расчёт без базы данных; тот же вид итогов, что и у преподавателя (П, О, НБ, Б, А и % пропусков).
 */
import type { StyleKey, XCell, XSheet } from "../xlsx/styled-xlsx";
import { STATUS_LEGEND, type CanonStatus } from "./module-tables";

export type GroupMatrixSession = {
  id: string;
  startTime: Date;
  /** Короткое название дисциплины для заголовка колонки. */
  disciplineShort: string;
};

export type GroupMatrixColumn = { id: string; date: string; discipline: string };

export type GroupMatrixRow = {
  studentId: string;
  name: string;
  cells: (CanonStatus | null)[];
  counts: { P: number; O: number; NB: number; B: number; A: number };
  /** (НБ + Б без подтверждения) / (П + О + НБ + Б без подтверждения), в процентах с двумя знаками. */
  missedPercent: number | null;
};

export type GroupMatrix = { columns: GroupMatrixColumn[]; rows: GroupMatrixRow[] };

const BISHKEK_OFFSET_MS = 6 * 60 * 60 * 1000;

/** дд.мм.гггг по времени Бишкека (не зависит от часового пояса сервера). */
export function bishkekFullDate(d: Date): string {
  const t = new Date(d.getTime() + BISHKEK_OFFSET_MS);
  const dd = String(t.getUTCDate()).padStart(2, "0");
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${t.getUTCFullYear()}`;
}

export function buildGroupMatrix(input: {
  sessions: GroupMatrixSession[];
  students: { id: string; name: string }[];
  statusOf: (sessionId: string, studentId: string) => CanonStatus | null;
}): GroupMatrix {
  const columns = input.sessions.map((s) => ({ id: s.id, date: bishkekFullDate(s.startTime), discipline: s.disciplineShort }));
  const rows = input.students.map((st) => {
    const cells = input.sessions.map((s) => input.statusOf(s.id, st.id));
    const counts = { P: 0, O: 0, NB: 0, B: 0, A: 0 };
    let bPending = 0;
    for (const c of cells) {
      if (c === "P") counts.P++;
      else if (c === "O") counts.O++;
      else if (c === "NB") counts.NB++;
      else if (c === "B_PENDING") {
        counts.B++;
        bPending++;
      } else if (c === "B_CONFIRMED") counts.B++;
      else if (c === "A") counts.A++;
    }
    const whole = counts.P + counts.O + counts.NB + bPending;
    const missedPercent = whole > 0 ? Math.round(((counts.NB + bPending) / whole) * 10000) / 100 : null;
    return { studentId: st.id, name: st.name, cells, counts, missedPercent };
  });
  return { columns, rows };
}

const cell = (v: string | number | null, s: StyleKey): XCell => ({ v, s });

function shortOf(s: CanonStatus | null): string {
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

export function groupMatrixSheet(m: GroupMatrix, meta: { groupName: string; semesterName: string }): XSheet {
  const L = m.columns.length;
  const width = 1 + L + 6;
  const cells: XCell[][] = [
    [cell(`Ведомость посещаемости, группа ${meta.groupName}`, "title")],
    [cell(meta.semesterName, "subtitle")],
  ];
  const merges: [number, number, number, number][] = [
    [0, 0, 0, width - 1],
    [1, 0, 1, width - 1],
  ];

  cells.push([
    cell("Студент", "head"),
    ...m.columns.map((c) => cell(`${c.date}\n${c.discipline}`, "head")),
    cell("П", "head"),
    cell("О", "head"),
    cell("НБ", "head"),
    cell("Б", "head"),
    cell("А", "head"),
    cell("% пропусков", "head"),
  ]);

  m.rows.forEach((r, i) => {
    cells.push([
      cell(`${i + 1}. ${r.name}`, "name"),
      ...r.cells.map((c) => cell(shortOf(c), "status")),
      cell(r.counts.P, "int"),
      cell(r.counts.O, "int"),
      cell(r.counts.NB, "int"),
      cell(r.counts.B, "int"),
      cell(r.counts.A, "int"),
      r.missedPercent === null ? cell("—", "dash") : cell(r.missedPercent, "pct"),
    ]);
  });

  const legendRow = cells.length + 1;
  cells.push([]);
  cells.push([
    cell(
      `${STATUS_LEGEND}. Колонки П, О, НБ, Б, А: сколько раз у студента стоит эта отметка (Б — подтверждённая и без подтверждения вместе). % пропусков = (НБ + Б без подтверждения) ÷ (П + О + НБ + Б без подтверждения).`,
      "legend",
    ),
  ]);
  merges.push([legendRow, 0, legendRow, width - 1]);

  return {
    name: "Ведомость",
    cells,
    merges,
    colWidths: [34, ...m.columns.map(() => 11), 6, 6, 6, 6, 6, 14],
    freeze: { rows: 3, cols: 1 },
    rowHeights: { 0: 26, 1: 20, 2: 34, [legendRow]: 44 },
  };
}
