"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [options, setOptions] = useState<Option[]>(disciplineOptions);
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedDisciplineIds);

  useEffect(() => {
    setFrom(initialFrom);
    setTo(initialTo);
    setOptions(disciplineOptions);
    setSelectedIds(selectedDisciplineIds);
  }, [initialFrom, initialTo, disciplineOptions, selectedDisciplineIds]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const loadOptions = async () => {
      const res = await fetch(`/api/student/discipline-options?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { disciplines?: Option[] };
      if (cancelled) return;
      const nextOptions = Array.isArray(data.disciplines) ? data.disciplines : [];
      setOptions(nextOptions);
      setSelectedIds((prev) => prev.filter((id) => nextOptions.some((opt) => opt.value === id)));
    };

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const selectedLabels = useMemo(
    () => options.filter((opt) => selectedIds.includes(opt.value)).map((opt) => opt.label),
    [options, selectedIds],
  );

  const toggleDiscipline = (disciplineId: string) => {
    setSelectedIds((prev) =>
      prev.includes(disciplineId) ? prev.filter((id) => id !== disciplineId) : [...prev, disciplineId],
    );
  };

  return (
    <form style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
        С
        <input
          type="date"
          name="from"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
        />
      </label>

      <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
        По
        <input
          type="date"
          name="to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
        />
      </label>

      <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
        Дисциплина
        <details style={{ position: "relative" }}>
          <summary
            style={{
              listStyle: "none",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 800,
              cursor: "pointer",
              background: "white",
            }}
          >
            {selectedLabels.length > 0 ? selectedLabels.join(", ") : "Все"}
          </summary>
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              zIndex: 20,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "white",
              padding: 10,
              maxHeight: 220,
              overflowY: "auto",
              display: "grid",
              gap: 8,
              boxShadow: "0 10px 20px rgba(17,24,39,0.08)",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={selectedIds.length === 0}
                onChange={() => setSelectedIds([])}
              />
              Все
            </label>
            {options.map((d) => (
              <label key={d.value} style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(d.value)}
                  onChange={() => toggleDiscipline(d.value)}
                />
                {d.label}
              </label>
            ))}
          </div>
        </details>
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="disciplineId" value={id} />
        ))}
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
