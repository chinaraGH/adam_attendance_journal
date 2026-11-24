"use client";

import { buildXlsx, XLSX_MIME, type XSheet } from "@/lib/xlsx/styled-xlsx";

type ExportTableButtonProps = {
  /** Имя файла с расширением, например «Итоги_УБ-4-23_модуль1.xlsx» */
  filename: string;
  /** Оформленный лист: заголовки, цвета, объединения. Числа остаются числами. */
  sheet: XSheet;
  label?: string;
};

export function ExportTableButton({ filename, sheet, label = "Скачать Excel" }: ExportTableButtonProps) {
  const handleExport = () => {
    if (!sheet || sheet.cells.length === 0) return;
    const bytes = buildXlsx(sheet);
    const blob = new Blob([bytes as BlobPart], { type: XLSX_MIME });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
