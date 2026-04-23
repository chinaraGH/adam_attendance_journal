"use client";

import { useMemo, useState, useTransition } from "react";

import { saveAttendances } from "./actions";

type Student = { id: string; name: string };

const STATUS = {
  P: "P",
  O: "O",
  NB: "NB",
  B: "B",
} as const;

function getButtonStyle(params: { kind: "p" | "o" | "nb" | "b"; isActive: boolean }) {
  const { kind, isActive } = params;

  const base: React.CSSProperties = {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 600,
    cursor: "pointer",
    background: "white",
    color: "#111827",
  };

  if (!isActive) return base;

  if (kind === "p") return { ...base, background: "#16a34a", borderColor: "#16a34a", color: "white" }; // green
  if (kind === "o") return { ...base, background: "#f59e0b", borderColor: "#f59e0b", color: "#111827" }; // yellow
  if (kind === "nb") return { ...base, background: "#dc2626", borderColor: "#dc2626", color: "white" }; // red
  return { ...base, background: "#2563eb", borderColor: "#2563eb", color: "white" }; // blue
}

export function AttendanceClient(props: {
  students: Student[];
  initialStatusByStudentId: Record<string, string | null | undefined>;
  classSessionId: string;
  readOnly?: boolean;
}) {
  const { students, initialStatusByStudentId, classSessionId, readOnly } = props;

  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [statusByStudentId, setStatusByStudentId] = useState<Record<string, string | null>>(() => {
    const next: Record<string, string | null> = {};
    for (const s of students) {
      const initial = initialStatusByStudentId[s.id];
      if (typeof initial === "string" && initial.length > 0) {
        next[s.id] = initial;
      } else {
        next[s.id] = null;
      }
    }
    return next;
  });

  const remainingCount = useMemo(() => {
    let remaining = 0;
    for (const s of students) {
      if (!statusByStudentId[s.id]) remaining += 1;
    }
    return remaining;
  }, [statusByStudentId, students]);

  function setStatus(studentId: string, status: string) {
    setSaveMessage("");
    setErrorMessage("");
    if (readOnly) return;
    setStatusByStudentId((prev) => ({ ...prev, [studentId]: status }));
  }

  function onSave() {
    const items = students.map((s) => ({
      studentId: s.id,
      status: statusByStudentId[s.id] ?? "",
    }));

    startTransition(async () => {
      try {
        setSaveMessage("");
        setErrorMessage("");
        const result = await saveAttendances({ classSessionId, items });
        if (result.ok) {
          const msg = "Успешно сохранено в базу";
          setSaveMessage(msg);
          console.log(msg);
        } else {
          setErrorMessage(result.error);
          console.log(result.error);
        }
      } catch {
        const msg = "Ошибка сохранения";
        setErrorMessage(msg);
        console.log(msg);
      }
    });
  }

  return (
    <>
      {errorMessage ? (
        <div
          style={{
            marginBottom: 12,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "#fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: 12,
            padding: "10px 12px",
            fontWeight: 700,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      {saveMessage ? (
        <div style={{ marginBottom: 12, fontWeight: 700, color: "#16a34a" }}>{saveMessage}</div>
      ) : null}

      <ul style={{ display: "grid", gap: 12, padding: 0, listStyle: "none" }}>
        {students.map((student, idx) => {
          const current = statusByStudentId[student.id] ?? null;

          return (
            <li
              key={student.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 12,
                opacity: isPending ? 0.85 : 1,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {idx + 1}. {student.name}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setStatus(student.id, STATUS.P)}
                  disabled={isPending || !!readOnly}
                  style={getButtonStyle({ kind: "p", isActive: current === STATUS.P })}
                >
                  П
                </button>

                <button
                  type="button"
                  onClick={() => setStatus(student.id, STATUS.O)}
                  disabled={isPending || !!readOnly}
                  style={getButtonStyle({ kind: "o", isActive: current === STATUS.O })}
                >
                  О
                </button>

                <button
                  type="button"
                  onClick={() => setStatus(student.id, STATUS.NB)}
                  disabled={isPending || !!readOnly}
                  style={getButtonStyle({ kind: "nb", isActive: current === STATUS.NB })}
                >
                  НБ
                </button>

                <button
                  type="button"
                  onClick={() => setStatus(student.id, STATUS.B)}
                  disabled={isPending || !!readOnly}
                  style={getButtonStyle({ kind: "b", isActive: current === STATUS.B })}
                >
                  Б
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onSave}
          disabled={isPending || remainingCount > 0 || !!readOnly}
          style={{
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "#111827",
            borderRadius: 12,
            padding: "10px 14px",
            fontWeight: 700,
            cursor: isPending || remainingCount > 0 || !!readOnly ? "not-allowed" : "pointer",
            opacity: isPending || remainingCount > 0 || !!readOnly ? 0.6 : 1,
            background: "#111827",
            color: "white",
          }}
        >
          {isPending ? "Сохранение..." : "Сохранить"}
        </button>
        <div style={{ color: "#374151", fontWeight: 600 }}>
          {remainingCount > 0 ? `Осталось отметить: ${remainingCount}` : "Все студенты отмечены"}
        </div>
      </div>
    </>
  );
}

