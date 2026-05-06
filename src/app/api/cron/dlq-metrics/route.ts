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

type DlqStatusRow = { status: string; count: bigint };
type DlqDueRow = { due_count: bigint };

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const byStatus = (await prisma.$queryRawUnsafe(
    `
      SELECT status, COUNT(*)::bigint AS count
      FROM public.integration_dlq
      GROUP BY status
    `,
  )) as DlqStatusRow[];

  const dueRows = (await prisma.$queryRawUnsafe(
    `
      SELECT COUNT(*)::bigint AS due_count
      FROM public.integration_dlq
      WHERE category = 'temporary'
        AND status IN ('pending', 'retrying')
        AND (next_retry_at IS NULL OR next_retry_at <= now())
    `,
  )) as DlqDueRow[];

  const statusMap = new Map(byStatus.map((row) => [row.status, Number(row.count)]));
  return NextResponse.json({
    ok: true,
    metrics: {
      pending: statusMap.get("pending") ?? 0,
      retrying: statusMap.get("retrying") ?? 0,
      dead: statusMap.get("dead") ?? 0,
      resolved: statusMap.get("resolved") ?? 0,
      dueNow: Number(dueRows[0]?.due_count ?? 0),
      total: byStatus.reduce((acc, row) => acc + Number(row.count), 0),
    },
  });
}
