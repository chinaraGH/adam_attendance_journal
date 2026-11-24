"use client";

import * as XLSX from "xlsx";

type Cell = string | number | null;

type ExportTableButtonProps = {
  /** Имя файла с расширением, например «Итоги_УБ-4-23_модуль1.xlsx» */
  filename: string;
  /** Название листа (до 31 символа, без символов : \ / ? * [ ]) */
  sheetName: string;
  /** Строки таблицы; числа остаются числами, чтобы в Excel их можно было суммировать */
  rows: Cell[][];
  label?: string;
};

export function ExportTableButton({ filename, sheetName, rows, label = "Скачать Excel" }: ExportTableButtonProps) {
  const handleExport = () => {
    if (!rows || rows.length === 0) return;
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const first = rows[0] ?? [];
    ws["!cols"] = first.map((_, i) => ({ wch: i === 0 ? 34 : 14 }));
    const wb = XLSX.utils.book_new();
    const safeName = sheetName.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Лист1";
    XLSX.utils.book_append_sheet(wb, ws, safeName);
    XLSX.writeFile(wb, filename);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      style={{
        border: "1px solid #111827",
        background: "#111827",
        color: "white",
        borderRadius: 10,
        padding: "8px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
