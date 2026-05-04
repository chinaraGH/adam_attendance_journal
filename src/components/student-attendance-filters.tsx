"use client";

type Option = {
  value: string;
  label: string;
};

type StudentAttendanceFiltersProps = {
  initialFrom: string;
  initialTo: string;
  disciplineOptions: Option[];
  selectedDisciplineIds: string[];
};

export function StudentAttendanceFilters({
  initialFrom,
  initialTo,
  disciplineOptions,
  selectedDisciplineIds,
}: StudentAttendanceFiltersProps) {
  return (
    <form style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
        С
        <input
          type="date"
          name="from"
          defaultValue={initialFrom}
          style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
        />
      </label>

      <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
        По
        <input
          type="date"
          name="to"
          defaultValue={initialTo}
          style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
        />
      </label>

      <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
        Дисциплина
        <select
          name="disciplineId"
          defaultValue={selectedDisciplineIds}
          multiple
          size={Math.min(4, Math.max(2, disciplineOptions.length + 1))}
          style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
        >
          <option value="">Все</option>
          {disciplineOptions.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "flex", alignItems: "end" }}>
        <button
          type="submit"
          style={{
            width: "100%",
            border: "1px solid #111827",
            background: "#111827",
            color: "white",
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Применить
        </button>
      </div>
    </form>
  );
}
