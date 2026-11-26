"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { upsertSemester } from "./actions";
import { btnPrimary, errorBox, field } from "@/lib/ui/office";

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ ...btnPrimary, marginTop: 4, opacity: pending ? 0.7 : 1, cursor: pending ? "wait" : "pointer" }}>
      {pending ? "Сохранение…" : "Сохранить семестр"}
    </button>
  );
}

export function SemesterForm({ semester }: { semester?: { id: string; name: string | null; startDate: Date; endDate: Date } | null }) {
  const [state, formAction] = useFormState<{ error?: string } | null, FormData>(upsertSemester as any, null);

  const isCreate = !semester;

  return (
    <form action={formAction} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
      <input type="hidden" name="intent" value={isCreate ? "create" : "update"} />
      
      {isCreate ? null : <input type="hidden" name="semesterId" value={semester.id} />}

      <label style={{ display: "grid", gap: 6, fontWeight: 800, fontSize: 14 }}>
        Название
        <input
          name="name"
          required
          defaultValue={semester?.name ?? ""}
          placeholder="Например: Осень 2026"
          style={field}
        />
      </label>
      <label style={{ display: "grid", gap: 6, fontWeight: 800, fontSize: 14 }}>
        Начало
        <input
          type="date"
          name="startDate"
          required
          defaultValue={semester ? toDateInputValue(new Date(semester.startDate)) : ""}
          style={field}
        />
      </label>
      <label style={{ display: "grid", gap: 6, fontWeight: 800, fontSize: 14 }}>
        Конец
        <input
          type="date"
          name="endDate"
          required
          defaultValue={semester ? toDateInputValue(new Date(semester.endDate)) : ""}
          style={field}
        />
      </label>
      
      {state?.error && (
        <div style={errorBox}>{state.error}</div>
      )}

      <SubmitButton />
    </form>
  );
}
