"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setA } from "@/app/curator/dashboard/actions";

export function SetAdministrativeAbsenceButton(props: {
  attendanceId: string;
  disabled: boolean;
  label?: string;
}) {
  const { attendanceId, disabled, label = "Выставить А" } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isDisabled = disabled || isPending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <button
        type="button"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const result = await setA({ attendanceId });
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
        }}
        disabled={isDisabled}
        style={{
          borderRadius: 10,
          padding: "8px 12px",
          border: "1px solid #111827",
          background: isDisabled ? "#f3f4f6" : "#111827",
          color: isDisabled ? "#6b7280" : "white",
          fontWeight: 800,
          cursor: isDisabled ? "not-allowed" : "pointer",
          fontSize: 13,
        }}
      >
        {isPending ? "Сохранение…" : label}
      </button>
      {error ? <span style={{ color: "#991b1b", fontWeight: 700, fontSize: 12 }}>{error}</span> : null}
    </div>
  );
}
