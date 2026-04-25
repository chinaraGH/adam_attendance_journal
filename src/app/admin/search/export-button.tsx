"use client";

type ExportRow = {
  studentId: string;
  studentName: string;
  groupName: string;
  disciplineId: string;
  status: string | null;
  sessionStart: string;
  updatedAt: string;
};

export function ExportButton(props: { rows: ExportRow[] }) {
  const { rows } = props;

  return (
    <button
      type="button"
      onClick={() => {
        console.log("EXPORT_ROWS", rows);
      }}
      style={{
        border: "1px solid #111827",
        background: "white",
        color: "#111827",
        padding: "10px 14px",
        borderRadius: 12,
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      Экспорт в Excel/CSV (skeleton)
    </button>
  );
}

