import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/auth/session";

export type AppRole = "TEACHER" | "CURATOR" | "ACADEMIC_OFFICE" | "ADMIN" | "LEADERSHIP";

export type CurrentUser = {
  id: string;
  role: AppRole;
};

export async function getCurrentUser(): Promise<CurrentUser> {
  const token = cookies().get("ejp_session")?.value ?? null;
  if (!token) throw new Error("UNAUTHORIZED");

  const payload = await verifySessionToken(token);
  if (!payload) throw new Error("UNAUTHORIZED");

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, isActive: true, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!user) throw new Error("UNAUTHORIZED");

  return { id: user.id, role: user.role as AppRole };
}

