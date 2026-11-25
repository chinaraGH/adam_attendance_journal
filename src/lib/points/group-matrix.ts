/**
 * Ведомость посещаемости группы для учебной части: студенты × занятия.
 * Чистый расчёт без базы данных. Экран показывает отметки как есть, Excel дополнительно считает П, О, НБ, Б, А и % пропусков.
 */
import type { StyleKey, XCell, XSheet } from "../xlsx/styled-xlsx";
import { STATUS_LEGEND, type CanonStatus } from "./module-tables";

export type GroupMatrixColumn = { id: string; date: string; discipline: string };
export type GroupMatrixCell = { text: string; status: CanonStatus | null };
export type GroupMatrixRow = { studentId: string; name: string; cells: GroupMatrixCell[] };
export type GroupMatrix = { columns: GroupMatrixColumn[]; rows: GroupMatrixRow[] };

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

/** Строка расшифровки: «ИНФ — Информатика · АНГ — Английский язык». */
export function disciplinesLegend(items: { short: string; name: string }[]): string {
  const seen = new Map<string, string>();
  for (const it of items) if (!seen.has(it.short)) seen.set(it.short, it.name);
  return Array.from(seen, ([short, name]) => `${short} — ${name}`).join(" · ");
}

export function groupMatrixSheet(
  m: GroupMatrix,
  meta: { groupName: string; semesterName: string; disciplinesLegend: string },
): XSheet {
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
    const counts = { P: 0, O: 0, NB: 0, B: 0, A: 0 };
    let bPending = 0;
    for (const c of r.cells) {
      if (c.status === "P") counts.P++;
      else if (c.status === "O") counts.O++;
      else if (c.status === "NB") counts.NB++;
      else if (c.status === "B_PENDING") {
        counts.B++;
        bPending++;
      } else if (c.status === "B_CONFIRMED") counts.B++;
      else if (c.status === "A") counts.A++;
    }
    const whole = counts.P + counts.O + counts.NB + bPending;
    const missed = whole > 0 ? Math.round(((counts.NB + bPending) / whole) * 10000) / 100 : null;
    cells.push([
      cell(`${i + 1}. ${r.name}`, "name"),
      ...r.cells.map((c) => cell(shortOf(c.status), "status")),
      cell(counts.P, "int"),
      cell(counts.O, "int"),
      cell(counts.NB, "int"),
      cell(counts.B, "int"),
      cell(counts.A, "int"),
      missed === null ? cell("—", "dash") : cell(missed, "pct"),
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
  const rowHeights: Record<number, number> = { 0: 26, 1: 20, 2: 34, [legendRow]: 44 };
  if (meta.disciplinesLegend) {
    cells.push([cell(`Дисциплины: ${meta.disciplinesLegend}`, "legend")]);
    merges.push([legendRow + 1, 0, legendRow + 1, width - 1]);
    rowHeights[legendRow + 1] = 30;
  }

  return {
    name: "Ведомость",
    cells,
    merges,
    colWidths: [34, ...m.columns.map(() => 11), 6, 6, 6, 6, 6, 14],
    freeze: { rows: 3, cols: 1 },
    rowHeights,
  };
}
