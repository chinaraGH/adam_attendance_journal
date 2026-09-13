"use client";

export function DateInputWithApply(props: { defaultValue: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type="date"
        name="date"
        defaultValue={props.defaultValue}
        style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 700 }}
      />
      <button
        type="submit"
        style={{
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
  );
}

