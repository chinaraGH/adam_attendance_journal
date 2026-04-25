import { NextResponse, type NextRequest } from "next/server";

import { verifySessionToken } from "@/lib/auth/session";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/cron")
  );
}

function roleAllowed(pathname: string, role: string) {
  if (pathname.startsWith("/admin")) return role === "ADMIN" || role === "ACADEMIC_OFFICE";
  if (pathname.startsWith("/leadership")) return role === "LEADERSHIP";
  if (pathname.startsWith("/curator")) return role === "CURATOR";
  return true;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = req.cookies.get("ejp_session")?.value ?? null;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (!roleAllowed(pathname, payload.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

