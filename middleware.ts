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
  if (pathname.startsWith("/admin")) return role === "ADMIN";
  if (pathname.startsWith("/acadepartment")) return role === "ADMIN" || role === "ACADEMIC_OFFICE";
  if (pathname.startsWith("/curator")) return role === "CURATOR";
  if (pathname.startsWith("/teacher")) return role === "TEACHER";
  if (pathname.startsWith("/student")) return role === "STUDENT";
  if (pathname.startsWith("/reports")) return role === "TEACHER" || role === "CURATOR";
  if (pathname.startsWith("/attendance")) return role !== "STUDENT";
  return true;
}

function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return nextWithPathname(req);

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

  return nextWithPathname(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

