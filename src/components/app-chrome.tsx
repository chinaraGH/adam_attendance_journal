"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { ExitButton } from "@/components/exit-button";

const NAV_CURRENT_PATH_KEY = "ejp_current_path";
const NAV_PREV_PATH_KEY = "ejp_prev_path";

export function AppChrome() {
  const pathname = usePathname() ?? "";
  const [previousPath, setPreviousPath] = useState("/");

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;
    const current = window.sessionStorage.getItem(NAV_CURRENT_PATH_KEY);
    const prev = window.sessionStorage.getItem(NAV_PREV_PATH_KEY);
    if (prev && prev !== pathname) setPreviousPath(prev);
    else setPreviousPath("/");
    if (current !== pathname) {
      if (current) window.sessionStorage.setItem(NAV_PREV_PATH_KEY, current);
      window.sessionStorage.setItem(NAV_CURRENT_PATH_KEY, pathname);
    }
  }, [pathname]);

  if (pathname.startsWith("/login")) return null;
  if (pathname.startsWith("/attendance")) return null;

  return (
    <div style={{ position: "fixed", top: 16, left: 16, zIndex: 50 }}>
      <ExitButton label="Назад" to={previousPath} />
    </div>
  );
}

