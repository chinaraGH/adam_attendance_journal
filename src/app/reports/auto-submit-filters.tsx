"use client";

import { useMemo, useState } from "react";

export function AutoSubmitSelect(props: {
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={props.name}
      defaultValue={props.defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
    >
      {props.children}
    </select>
  );
}

export function AutoSubmitDateInput(props: { name: string; defaultValue: string }) {
  return (
    <input
      type="date"
      name={props.name}
      defaultValue={props.defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
    />
  );
}

type MultiOption = { value: string; label: string };

export function AutoSubmitDisciplineMultiSelect(props: {
  name: string;
  options: MultiOption[];
  selectedValues: string[];
}) {
  const [selected, setSelected] = useState<string[]>(props.selectedValues);
  const selectedLabels = useMemo(
    () => props.options.filter((opt) => selected.includes(opt.value)).map((opt) => opt.label),
    [props.options, selected],
  );

  const toggle = (value: string, form: HTMLFormElement | null) => {
    setSelected((prev) => {
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      setTimeout(() => form?.requestSubmit(), 0);
      return next;
    });
  };

  const clearAll = (form: HTMLFormElement | null) => {
    setSelected([]);
    setTimeout(() => form?.requestSubmit(), 0);
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
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
            maxHeight: 240,
            overflowY: "auto",
            display: "grid",
            gap: 8,
            boxShadow: "0 10px 20px rgba(17,24,39,0.08)",
          }}
        >
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={selected.length === 0}
              onChange={(e) => clearAll(e.currentTarget.form)}
            />
            Все
          </label>
          {props.options.map((opt) => (
            <label key={opt.value} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={(e) => toggle(opt.value, e.currentTarget.form)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </details>
      {selected.map((value) => (
        <input key={value} type="hidden" name={props.name} value={value} />
      ))}
    </div>
  );
}

