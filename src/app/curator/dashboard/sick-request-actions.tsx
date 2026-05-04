"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { decideSickRequest } from "./actions";

export function SickRequestActions(props: { attendanceId: string; semesterLocked: boolean }) {
  const { attendanceId, semesterLocked } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled = semesterLocked || isPending;

  function run(decision: "confirm" | "reject") {
    setError(null);
    startTransition(async () => {
      try {
        const result = await decideSickRequest({ attendanceId, decision });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Ошибка сохранения";
        setError(msg);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => run("confirm")}
          disabled={disabled}
          style={{
            borderRadius: 12,
            padding: "10px 12px",
            border: "1px solid #16a34a",
            background: disabled ? "#f3f4f6" : "#16a34a",
            color: disabled ? "#6b7280" : "white",
            fontWeight: 900,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          Подтвердить Б
        </button>
        <button
          type="button"
          onClick={() => run("reject")}
          disabled={disabled}
          style={{
            borderRadius: 12,
            padding: "10px 12px",
            border: "1px solid #dc2626",
            background: disabled ? "#f3f4f6" : "#dc2626",
            color: disabled ? "#6b7280" : "white",
            fontWeight: 900,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          Отклонить Б
        </button>
        {isPending ? <span style={{ color: "#6b7280", fontWeight: 700, fontSize: 14 }}>Сохранение…</span> : null}
      </div>
      {error ? <div style={{ color: "#991b1b", fontWeight: 700, fontSize: 14 }}>{error}</div> : null}
    </div>
  );
}
