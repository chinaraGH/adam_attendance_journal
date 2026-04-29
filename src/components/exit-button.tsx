"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const baseStyle: React.CSSProperties = {
  appearance: "none",
  border: "1px solid #111827",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 900,
  fontFamily: "inherit",
  fontSize: "inherit",
  lineHeight: "inherit",
  textDecoration: "none",
  color: "#111827",
  background: "white",
};

export function ExitButton(props: {
  disabled?: boolean;
  label?: string;
  to?: string;
  preferTo?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const disabled = Boolean(props.disabled);
  const label = props.label ?? "Назад";

  return (
    <button
      type="button"
      disabled={disabled}
      className={props.className}
      style={{
        ...baseStyle,
        ...(disabled ? { cursor: "not-allowed", opacity: 0.6 } : { cursor: "pointer" }),
        ...(props.style ?? {}),
      }}
      onClick={() => {
        if (disabled) return;
        if (props.preferTo && props.to && props.to.trim().length > 0) {
          router.push(props.to);
          return;
        }
        // Go to previous screen; fallback to home.
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(props.to && props.to.trim().length > 0 ? props.to : "/");
        }
      }}
    >
      {label}
    </button>
  );
}

