/**
 * Единый набор стилей для экранов Учебной части (в стиле экранов преподавателя):
 * белые скруглённые карточки, одинаковая высота полей и кнопок (44 px), спокойные цвета.
 */
import type { CSSProperties } from "react";

export const CONTROL_HEIGHT = 44;
export const CONTROL_HEIGHT_SMALL = 36;

export const page: CSSProperties = { padding: 16, maxWidth: 1200, margin: "0 auto" };
export const pageNarrow: CSSProperties = { padding: 16, maxWidth: 720, margin: "0 auto" };

export const h1: CSSProperties = { fontSize: 22, fontWeight: 800, margin: 0, color: "#111827" };
export const subtitle: CSSProperties = { color: "#6b7280", fontSize: 13, marginTop: 2 };
export const h2: CSSProperties = { fontSize: 17, fontWeight: 800, margin: 0, color: "#111827" };
export const hint: CSSProperties = { color: "#6b7280", fontSize: 13, marginTop: 4 };

export const card: CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 14, background: "white", padding: 16, marginTop: 16 };
export const subCard: CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 };

const controlBase: CSSProperties = {
  boxSizing: "border-box",
  height: CONTROL_HEIGHT,
  borderRadius: 12,
  fontFamily: "inherit",
  fontSize: 14,
  lineHeight: "20px",
};

/** Поле ввода и выпадающий список: одинаковой высоты. */
export const field: CSSProperties = {
  ...controlBase,
  width: "100%",
  border: "1px solid #d1d5db",
  padding: "0 12px",
  fontWeight: 700,
  color: "#111827",
  background: "white",
};

export const btnPrimary: CSSProperties = {
  ...controlBase,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 16px",
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

export const btnOutline: CSSProperties = {
  ...btnPrimary,
  background: "white",
  color: "#111827",
};

export const btnDanger: CSSProperties = {
  ...btnPrimary,
  border: "1px solid #991b1b",
  background: "#991b1b",
};

/** Кнопка в строке таблицы. */
export const btnSmall: CSSProperties = {
  ...btnPrimary,
  height: CONTROL_HEIGHT_SMALL,
  padding: "0 12px",
  fontSize: 13,
  borderRadius: 10,
};

export const btnSmallOutline: CSSProperties = { ...btnSmall, background: "white", color: "#111827" };
export const btnSmallDanger: CSSProperties = { ...btnSmall, border: "1px solid #991b1b", background: "white", color: "#991b1b" };

/** Переключатель-фильтр. */
export function chip(active: boolean): CSSProperties {
  return {
    ...btnSmallOutline,
    border: `1px solid ${active ? "#111827" : "#d1d5db"}`,
    background: active ? "#f3f4f6" : "white",
    color: active ? "#111827" : "#4b5563",
  };
}

export const th: CSSProperties = { padding: "8px 8px", textAlign: "left", fontSize: 12, color: "#374151", fontWeight: 800, whiteSpace: "nowrap", borderBottom: "1px solid #e5e7eb" };
export const td: CSSProperties = { padding: "8px 8px", textAlign: "left", fontSize: 14, borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" };

export const tableWrap: CSSProperties = { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12, background: "white" };

export const listItem: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  borderRadius: 12,
  border: "1px solid #f3f4f6",
  padding: "10px 12px",
  minHeight: 48,
  boxSizing: "border-box",
};

export const notice: CSSProperties = { border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", borderRadius: 10, padding: "8px 10px", fontSize: 13 };
export const errorBox: CSSProperties = { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 10, padding: "8px 10px", fontSize: 13, fontWeight: 700 };

/** Дата и время по Бишкеку, не зависит от часового пояса сервера. */
export function fmtDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("ru-RU", { timeZone: "Asia/Bishkek", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("ru-RU", { timeZone: "Asia/Bishkek", day: "2-digit", month: "2-digit", year: "numeric" });
}
export function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("ru-RU", { timeZone: "Asia/Bishkek", hour: "2-digit", minute: "2-digit" });
}
