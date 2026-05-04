"use client";

export function AutoSubmitDateInput(props: { defaultValue: string }) {
  return (
    <input
      type="date"
      name="date"
      defaultValue={props.defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 700 }}
    />
  );
}

