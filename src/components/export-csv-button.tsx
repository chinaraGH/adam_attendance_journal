"use client";

type Primitive = string | number | boolean | null | undefined;

function toCsvValue(v: Primitive) {
  const s = v === null || v === undefined ? "" : String(v);
  const escaped = s.replaceAll('"', '""');
  return `"${escaped}"`;
}

export function ExportCsvButton(props: {
  filename: string;
  rows: Array<Record<string, Primitive>>;
  label?: string;
}) {
  const { filename, rows, label } = props;

  const onClick = () => {
    const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];
    const lines = [
      headers.map(toCsvValue).join(","),
      ...rows.map((r) => headers.map((h) => toCsvValue(r[h])).join(",")),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-sm font-black text-white"
    >
      {label ?? "Скачать Excel (официальная ведомость)"}
    </button>
  );
}

