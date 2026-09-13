"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { upsertSemester } from "./actions";

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        border: "1px solid #111827",
        background: "#111827",
        color: "white",
        padding: "10px 14px",
        borderRadius: 12,
        fontWeight: 900,
        cursor: pending ? "not-allowed" : "pointer",
        marginTop: 6,
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? "Сохранение..." : "Сохранить семестр"}
    </button>
  );
}

export function SemesterForm({ semester }: { semester?: { id: string; name: string | null; startDate: Date; endDate: Date } | null }) {
  const [state, formAction] = useFormState<{ error?: string } | null, FormData>(upsertSemester as any, null);

  const isCreate = !semester;

  return (
    <form action={formAction} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
      <input type="hidden" name="intent" value={isCreate ? "create" : "update"} />
      
      {isCreate ? (
        <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
          ID семестра (уникальный)
          <input
            name="semesterId"
            placeholder="Например: SEM26F"
            style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
          />
        </label>
      ) : (
        <input type="hidden" name="semesterId" value={semester.id} />
      )}

      <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
        Название
        <input
          name="name"
          defaultValue={semester?.name ?? ""}
          placeholder="Например: Весенний семестр 2026"
          style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
        />
      </label>
      <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
        Начало
        <input
          type="date"
          name="startDate"
          defaultValue={semester ? toDateInputValue(new Date(semester.startDate)) : ""}
          style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
        />
      </label>
      <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
        Конец
        <input
          type="date"
          name="endDate"
          defaultValue={semester ? toDateInputValue(new Date(semester.endDate)) : ""}
          style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
        />
      </label>
      
      {state?.error && (
        <div style={{ color: "#b91c1c", fontWeight: 800, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12 }}>
          {state.error}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
