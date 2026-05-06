import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { reconcileClassSessionsBySemesterBoundaries } from "@/lib/semester/reconcile-class-sessions";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("x-cron-secret");
  if (header && header === secret) return true;

  const auth = request.headers.get("authorization");
  if (auth && auth === `Bearer ${secret}`) return true;

  return false;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const correlationId = request.headers.get("x-correlation-id")?.trim() || randomUUID();
  const lockId = 92233720;
  const lockRows = (await prisma.$queryRawUnsafe(`SELECT pg_try_advisory_lock(${lockId}) AS locked`)) as Array<{ locked: boolean }>;
  const locked = Boolean(lockRows[0]?.locked);
  if (!locked) {
    return NextResponse.json({ ok: false, correlationId, error: "Reconcile job is already running" }, { status: 409 });
  }

  try {
    const result = await reconcileClassSessionsBySemesterBoundaries({ actorType: "system", actorId: null, correlationId });
    return NextResponse.json({ ok: true, correlationId, ...result });
  } finally {
    await prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock(${lockId})`);
  }
}
