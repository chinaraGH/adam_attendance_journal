"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getSessionCookieName, signSessionToken } from "@/lib/auth/session";

export async function loginWithRole(formData: FormData) {
  const role = formData.get("role");
  const userId = formData.get("userId");

  if (typeof role !== "string" || !role) return;
  if (typeof userId !== "string" || !userId) return;

  const user = await prisma.user.findFirst({
    where: { id: userId, role, isActive: true, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!user) return;

  const token = await signSessionToken({ sub: user.id, role: user.role });
  cookies().set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/");
}

export async function logout() {
  cookies().set(getSessionCookieName(), "", { path: "/", maxAge: 0 });
  redirect("/login");
}

