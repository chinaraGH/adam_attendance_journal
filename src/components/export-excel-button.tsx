"use client";

import * as XLSX from "xlsx";

type ExportExcelButtonProps = {
  filename: string;
  data: any[];
};

export function ExportExcelButton({ filename, data }: ExportExcelButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) return;
    
    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // Convert our json array to a worksheet
    const ws = XLSX.utils.json_to_sheet(data);

    // Set some basic column widths
    const colWidths = Object.keys(data[0] || {}).map((key) => {
      // First column is usually Student name, make it wider
      if (key === "Студент") return { wch: 35 };
      // Dates are approx 10 chars
      return { wch: 15 };
    });
    ws["!cols"] = colWidths;

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, "Ведомость");

    // Generate the file and trigger download
    XLSX.writeFile(wb, filename);
  };

  return (
    <button
      onClick={handleExport}
      className="rounded-lg bg-[#111827] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
    >
      Скачать Excel (официальная ведомость)
    </button>
  );
}
