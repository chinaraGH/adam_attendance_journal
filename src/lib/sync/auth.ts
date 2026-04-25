import type { NextRequest } from "next/server";

export function requireSyncAuth(request: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false;

  const header = request.headers.get("x-sync-secret");
  if (header && header === secret) return true;

  const auth = request.headers.get("authorization");
  if (auth && auth === `Bearer ${secret}`) return true;

  return false;
}

