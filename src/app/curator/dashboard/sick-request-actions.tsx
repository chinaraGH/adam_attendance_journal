"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { decideSickRequest } from "./actions";

function btnStyle(params: { kind: "b" | "nb"; isActive: boolean; disabled: boolean }): CSSProperties {
  const { kind, isActive, disabled } = params;
  const base: CSSProperties = {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    minWidth: 40,
  };
  if (disabled) return { ...base, background: "#f3f4f6", color: "#6b7280" };
  if (!isActive) return { ...base, background: "white", color: "#111827" };
  if (kind === "b") return { ...base, background: "#16a34a", borderColor: "#16a34a", color: "white" };
  return { ...base, background: "#dc2626", borderColor: "#dc2626", color: "white" };
}

export function SickRequestActions(props: {
  attendanceId: string;
  semesterLocked: boolean;
  rowKind: "pending" | "confirmed" | "rejected_nb";
}) {
  const { attendanceId, semesterLocked, rowKind } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled = semesterLocked || isPending;

  const bActive = rowKind === "confirmed";
  const nbActive = rowKind === "rejected_nb";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => run("confirm")}
          disabled={disabled}
          style={btnStyle({ kind: "b", isActive: bActive, disabled })}
          title="Подтвердить справку Б"
        >
          Б
        </button>
        <button
          type="button"
          onClick={() => run("reject")}
          disabled={disabled}
          style={btnStyle({ kind: "nb", isActive: nbActive, disabled })}
          title="Отклонить (НБ)"
        >
          НБ
        </button>
        {isPending ? <span style={{ color: "#6b7280", fontWeight: 700, fontSize: 13 }}>Сохранение…</span> : null}
      </div>
      {error ? <div style={{ color: "#991b1b", fontWeight: 700, fontSize: 13 }}>{error}</div> : null}
    </div>
  );
}
