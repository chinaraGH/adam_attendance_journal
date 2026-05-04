"use client";

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

