"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

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
  const pathname = usePathname() ?? "/";
  const disabled = Boolean(props.disabled);
  const label = props.label ?? "Назад";
  const parentPath = (() => {
    if (!pathname || pathname === "/") return "/";
    const clean = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const idx = clean.lastIndexOf("/");
    if (idx <= 0) return "/";
    return clean.slice(0, idx);
  })();

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
        const explicitTarget = props.to && props.to.trim().length > 0 ? props.to : null;
        if (props.preferTo && explicitTarget) {
          router.push(explicitTarget);
          return;
        }
        router.push(explicitTarget ?? parentPath);
      }}
    >
      {label}
    </button>
  );
}

