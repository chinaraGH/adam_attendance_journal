import { NextResponse } from "next/server";

import { getSessionCookieName } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.redirect(new URL("/login", "http://localhost"));
  res.cookies.set(getSessionCookieName(), "", { path: "/", maxAge: 0 });
  return res;
}

