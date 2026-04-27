"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getSessionCookieName, signSessionToken } from "@/lib/auth/session";
import { getDashboardPathForRole } from "@/lib/auth/role-routes";

type LoginState = { ok: true } | { ok: false; error: string };

function getTestPassword() {
  return process.env.TEST_PASSWORD ?? "test";
}

export async function loginWithPassword(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const login = formData.get("login");
  const password = formData.get("password");

  if (typeof login !== "string" || login.trim().length === 0) {
    return { ok: false, error: "INVALID" };
  }
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, error: "INVALID" };
  }

  if (password !== getTestPassword()) {
    return { ok: false, error: "INVALID" };
  }

  const user = await prisma.appUser.findFirst({
    where: { id: login.trim(), isActive: true, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!user) return { ok: false, error: "INVALID" };

  const token = await signSessionToken({ sub: user.id, role: user.role });
  cookies().set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect(getDashboardPathForRole(user.role as any));
}

export async function logout() {
  cookies().set(getSessionCookieName(), "", { path: "/", maxAge: 0 });
  redirect("/login");
}

