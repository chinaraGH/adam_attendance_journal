"use client";

import { usePathname } from "next/navigation";

import { ExitButton } from "@/components/exit-button";

export function AppChrome() {
  const pathname = usePathname() ?? "";

  if (pathname.startsWith("/login")) return null;
  if (pathname.startsWith("/attendance")) return null;

  return (
    <div style={{ position: "fixed", top: 16, left: 16, zIndex: 50 }}>
      <ExitButton />
    </div>
  );
}

