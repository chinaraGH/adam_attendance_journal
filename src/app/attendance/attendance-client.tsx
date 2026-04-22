"use client";

import { useMemo, useState, useTransition } from "react";

import { saveAttendances } from "./actions";

type Student = { id: string; name: string };

const STATUS = {
  PRESENT: "PRESENT",
  UNEXCUSED_ABSENCE: "UNEXCUSED_ABSENCE",
  LATE: "LATE",
} as const;

function getButtonStyle(params: { kind: "present" | "absent" | "late"; isActive: boolean }) {
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

  if (kind === "present") return { ...base, background: "#16a34a", borderColor: "#16a34a", color: "white" };
  if (kind === "absent") return { ...base, background: "#dc2626", borderColor: "#dc2626", color: "white" };
  return { ...base, background: "#f59e0b", borderColor: "#f59e0b", color: "#111827" };
}

export function AttendanceClient(props: {
  students: Student[];
  initialStatusByStudentId: Record<string, string | null | undefined>;
  classSessionId: string;
}) {
  const { students, initialStatusByStudentId, classSessionId } = props;

  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [statusByStudentId, setStatusByStudentId] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const s of students) {
      const initial = initialStatusByStudentId[s.id];
      if (typeof initial === "string" && initial.length > 0) {
        next[s.id] = initial;
      }
    }
    return next;
  });

  const selectedCount = useMemo(() => Object.keys(statusByStudentId).length, [statusByStudentId]);

  function setStatus(studentId: string, status: string) {
    setSaveMessage("");
    setErrorMessage("");
    setStatusByStudentId((prev) => ({ ...prev, [studentId]: status }));
  }

  function onSave() {
    const items = Object.entries(statusByStudentId).map(([studentId, status]) => ({
      studentId,
      status,
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
                  onClick={() => setStatus(student.id, STATUS.PRESENT)}
                  disabled={isPending}
                  style={getButtonStyle({ kind: "present", isActive: current === STATUS.PRESENT })}
                >
                  Присутствует
                </button>

                <button
                  type="button"
                  onClick={() => setStatus(student.id, STATUS.UNEXCUSED_ABSENCE)}
                  disabled={isPending}
                  style={getButtonStyle({ kind: "absent", isActive: current === STATUS.UNEXCUSED_ABSENCE })}
                >
                  Отсутствует
                </button>

                <button
                  type="button"
                  onClick={() => setStatus(student.id, STATUS.LATE)}
                  disabled={isPending}
                  style={getButtonStyle({ kind: "late", isActive: current === STATUS.LATE })}
                >
                  Опоздал
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
          disabled={isPending || selectedCount === 0}
          style={{
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "#111827",
            borderRadius: 12,
            padding: "10px 14px",
            fontWeight: 700,
            cursor: isPending || selectedCount === 0 ? "not-allowed" : "pointer",
            opacity: isPending || selectedCount === 0 ? 0.6 : 1,
            background: "#111827",
            color: "white",
          }}
        >
          {isPending ? "Сохранение..." : "Сохранить"}
        </button>
        <div style={{ color: "#374151", fontWeight: 600 }}>Выбрано: {selectedCount}</div>
      </div>
    </>
  );
}

