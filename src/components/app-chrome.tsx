"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { BackToolbar, ExitButton } from "@/components/exit-button";

const NAV_CURRENT_PATH_KEY = "ejp_current_path";
const NAV_PREV_PATH_KEY = "ejp_prev_path";

export function AppChrome() {
  const pathname = usePathname() ?? "";
  const [parentPath, setParentPath] = useState("/");
  const [prevPath, setPrevPath] = useState<string | null>(null);
  const [me, setMe] = useState<{ displayName: string; roleLabel: string; role: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;
    const current = window.sessionStorage.getItem(NAV_CURRENT_PATH_KEY);
    const clean = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const idx = clean.lastIndexOf("/");
    if (idx <= 0) setParentPath("/");
    else setParentPath(clean.slice(0, idx));
    if (current !== pathname) {
      if (current) {
        window.sessionStorage.setItem(NAV_PREV_PATH_KEY, current);
        setPrevPath(current);
      } else {
        setPrevPath(window.sessionStorage.getItem(NAV_PREV_PATH_KEY));
      }
      window.sessionStorage.setItem(NAV_CURRENT_PATH_KEY, pathname);
    } else {
      setPrevPath(window.sessionStorage.getItem(NAV_PREV_PATH_KEY));
    }
  }, [pathname]);

  // Имя текущего пользователя (обновляется при каждом переходе, в том числе сразу после входа)
  useEffect(() => {
    if (!pathname || pathname.startsWith("/login")) {
      setMe(null);
      return;
    }
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setMe(d?.ok ? { displayName: String(d.displayName ?? ""), roleLabel: String(d.roleLabel ?? ""), role: String(d.role ?? "") } : null);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (pathname.startsWith("/login")) return null;
  if (pathname.startsWith("/attendance")) return null;

  const curatorExemptionsGroup = /^\/curator\/exemptions\/[^/]+$/.test(pathname);
  const adminGroup = /^\/admin\/groups\/[^/]+$/.test(pathname);
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
      : pathname.startsWith("/teacher/tech-card") || pathname.startsWith("/teacher/control")
      ? "/teacher"
      : pathname === "/curator" || pathname === "/curator/dashboard"
      ? "/login"
      : pathname.startsWith("/acadepartment/")
      ? "/acadepartment"
      : pathname === "/admin/semester"
      ? "/acadepartment"
      : pathname === "/acadepartment"
      ? "/login"
      : pathname === "/program-head"
      ? "/login"
      : pathname.startsWith("/points-report")
      ? me?.role === "PROGRAM_HEAD"
        ? "/program-head"
        : me?.role === "ADMIN" || me?.role === "ACADEMIC_OFFICE"
          ? "/acadepartment"
          : "/teacher"
      : pathname === "/admin/audit" || pathname === "/admin/integration"
      ? "/acadepartment"
      : adminGroup || /^\/admin\/students\/[^/]+$/.test(pathname)
      ? (prevPath || "/acadepartment")
      : pathname === "/curator/exemptions" || curatorExemptionsGroup
        ? "/curator"
        : parentPath;

  return (
    <BackToolbar style={{ gap: 12, justifyContent: "space-between" }}>
      <ExitButton label="Назад" to={backTarget} preferTo />
      {me ? (
        <div style={{ minWidth: 0, textAlign: "right", lineHeight: 1.25 }} title={`${me.displayName} · ${me.roleLabel}`}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.displayName}</div>
          <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.roleLabel}</div>
        </div>
      ) : null}
    </BackToolbar>
  );
}

