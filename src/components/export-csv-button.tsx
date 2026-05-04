"use client";

import type { CSSProperties } from "react";

type Primitive = string | number | boolean | null | undefined;

const defaultButtonStyle: CSSProperties = {
  border: "1px solid #111827",
  borderRadius: 12,
  background: "#111827",
  color: "white",
  padding: "10px 14px",
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
};

function toCsvValue(v: Primitive) {
  const s = v === null || v === undefined ? "" : String(v);
  const escaped = s.replaceAll('"', '""');
  return `"${escaped}"`;
}

export function ExportCsvButton(props: {
  filename: string;
  rows: Array<Record<string, Primitive>>;
  label?: string;
  style?: CSSProperties;
}) {
  const { filename, rows, label, style } = props;

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
    <button type="button" onClick={onClick} style={{ ...defaultButtonStyle, ...style }}>
      {label ?? "Скачать Excel (официальная ведомость)"}
    </button>
  );
}

