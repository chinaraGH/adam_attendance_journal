import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("x-cron-secret");
  if (header && header === secret) return true;

  const auth = request.headers.get("authorization");
  if (auth && auth === `Bearer ${secret}`) return true;

  return false;
}

function computeBackoffMinutes(attempts: number) {
  return Math.min(60, Math.max(1, 2 ** Math.max(0, attempts - 1)));
}

type DlqRow = {
  id: string;
  attempts: number;
  max_attempts: number;
};

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const dueRows = (await prisma.$queryRawUnsafe(
    `
      SELECT id, attempts, max_attempts
      FROM public.integration_dlq
      WHERE category = 'temporary'
        AND status IN ('pending', 'retrying')
        AND (next_retry_at IS NULL OR next_retry_at <= now())
      ORDER BY created_at ASC
      LIMIT 100
    `,
  )) as DlqRow[];

  let rescheduled = 0;
  let movedToDead = 0;

  for (const row of dueRows) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE public.integration_dlq
        SET status = 'retrying',
            updated_at = now()
        WHERE id = $1
      `,
      row.id,
    );

    const nextAttempts = row.attempts + 1;
    if (nextAttempts >= row.max_attempts) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE public.integration_dlq
          SET attempts = $2,
              status = 'dead',
              next_retry_at = NULL,
              last_error_at = now(),
              updated_at = now()
          WHERE id = $1
        `,
        row.id,
        nextAttempts,
      );
      movedToDead += 1;
      continue;
    }

    const backoffMinutes = computeBackoffMinutes(nextAttempts);
    const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
    await prisma.$executeRawUnsafe(
      `
        UPDATE public.integration_dlq
        SET attempts = $2,
            status = 'pending',
            next_retry_at = $3,
            last_error_at = now(),
            updated_at = now()
        WHERE id = $1
      `,
      row.id,
      nextAttempts,
      nextRetryAt,
    );
    rescheduled += 1;
  }

  return NextResponse.json({
    ok: true,
    scanned: dueRows.length,
    rescheduled,
    movedToDead,
  });
}
