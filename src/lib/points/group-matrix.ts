/**
 * Ведомость посещаемости группы для учебной части: студенты × занятия.
 * Содержание такое же, как было раньше (дата + дисциплина в шапке, отметка в ячейке), меняется только оформление.
 */
import type { StyleKey, XCell, XSheet } from "../xlsx/styled-xlsx";

export type GroupMatrixColumn = { id: string; header: string };
export type GroupMatrixCell = { text: string; status: string | null };
export type GroupMatrixRow = { studentId: string; name: string; cells: GroupMatrixCell[] };
export type GroupMatrix = { columns: GroupMatrixColumn[]; rows: GroupMatrixRow[] };

const cell = (v: string | number | null, s: StyleKey): XCell => ({ v, s });

export function groupMatrixSheet(m: GroupMatrix, title: string): XSheet {
  const width = 1 + m.columns.length;
  const cells: XCell[][] = [[cell(title, "title")]];
  const merges: [number, number, number, number][] = [[0, 0, 0, width - 1]];

  cells.push([cell("Студент", "head"), ...m.columns.map((c) => cell(c.header, "head"))]);
  for (const r of m.rows) {
    cells.push([cell(r.name, "name"), ...r.cells.map((c) => cell(c.text, "status"))]);
  }

  return {
    name: "Ведомость",
    cells,
    merges,
    colWidths: [35, ...m.columns.map(() => 18)],
    freeze: { rows: 2, cols: 1 },
    rowHeights: { 0: 26, 1: 34 },
  };
}
