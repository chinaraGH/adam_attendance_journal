import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { saveAttendances } from "@/app/attendance/actions";

export async function POST(request: Request, ctx: { params: { id: string } }) {
  let actor: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    actor = await getCurrentUser();
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (actor.role !== "TEACHER") {
    return NextResponse.json({ ok: false, error: "Недостаточно прав." }, { status: 403 });
  }

  const classSessionId = ctx?.params?.id;
  if (!classSessionId) {
    return NextResponse.json({ ok: false, error: "Не указан id занятия." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON." }, { status: 400 });
  }

  const items =
    payload && typeof payload === "object" && "items" in payload && Array.isArray((payload as any).items)
      ? ((payload as any).items as Array<{ studentId: string; status: string }>)
      : null;

  if (!items || items.length === 0) {
    return NextResponse.json({ ok: false, error: "Нет данных для сохранения." }, { status: 400 });
  }

  const result = await saveAttendances({ classSessionId, items });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

