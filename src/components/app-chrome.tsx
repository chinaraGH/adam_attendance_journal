"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { BackToolbar, ExitButton } from "@/components/exit-button";

const NAV_CURRENT_PATH_KEY = "ejp_current_path";
const NAV_PREV_PATH_KEY = "ejp_prev_path";

export function AppChrome() {
  const pathname = usePathname() ?? "";
  const [parentPath, setParentPath] = useState("/");

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;
    const current = window.sessionStorage.getItem(NAV_CURRENT_PATH_KEY);
    const clean = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const idx = clean.lastIndexOf("/");
    if (idx <= 0) setParentPath("/");
    else setParentPath(clean.slice(0, idx));
    if (current !== pathname) {
      if (current) window.sessionStorage.setItem(NAV_PREV_PATH_KEY, current);
      window.sessionStorage.setItem(NAV_CURRENT_PATH_KEY, pathname);
    }
  }, [pathname]);

  if (pathname.startsWith("/login")) return null;
  if (pathname.startsWith("/attendance")) return null;

  const curatorExemptionsGroup = /^\/curator\/exemptions\/[^/]+$/.test(pathname);
  const backTarget =
    pathname === "/"
      ? "/login"
      : pathname === "/teacher"
      ? "/login"
      : pathname === "/student"
      ? "/login"
      : pathname === "/reports"
      ? "/teacher"
      : pathname === "/teacher/reports"
      ? "/teacher"
      : pathname === "/curator" || pathname === "/curator/dashboard"
      ? "/login"
      : pathname.startsWith("/acadepartment/")
      ? "/acadepartment"
      : pathname === "/acadepartment"
      ? "/login"
      : pathname === "/leadership" || pathname === "/leadership/dashboard"
      ? "/login"
      : pathname === "/curator/exemptions" || curatorExemptionsGroup
        ? "/curator"
        : parentPath;

  return (
    <BackToolbar>
      <ExitButton label="Назад" to={backTarget} preferTo />
    </BackToolbar>
  );
}

