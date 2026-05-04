"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toggleExemptionsAdministrativeAbsence } from "./exemption-actions";

export function ToggleExemptionsAButton(props: {
  classSessionId: string;
  studentId: string;
  disabled: boolean;
  isActive: boolean;
}) {
  const { classSessionId, studentId, disabled, isActive } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isDisabled = disabled || isPending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await toggleExemptionsAdministrativeAbsence({ classSessionId, studentId });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
        disabled={isDisabled}
        title={isActive ? "Снять А" : "Установить А"}
        style={{
          borderRadius: 10,
          padding: "8px 14px",
          border: `1px solid ${isActive ? "#16a34a" : "#d1d5db"}`,
          background: isActive ? "#16a34a" : isDisabled ? "#f3f4f6" : "white",
          color: isActive ? "white" : isDisabled ? "#6b7280" : "#111827",
          fontWeight: 800,
          cursor: isDisabled ? "not-allowed" : "pointer",
          minWidth: 52,
        }}
      >
        {isPending ? "…" : "А"}
      </button>
      {error ? <span style={{ color: "#991b1b", fontWeight: 700, fontSize: 12 }}>{error}</span> : null}
    </div>
  );
}
