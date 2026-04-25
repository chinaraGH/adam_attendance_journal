import type { AppRole } from "@/lib/auth/get-current-user";

export type AttendanceStatusV2 =
  | "P"
  | "O"
  | "NB"
  | "B_PENDING"
  | "B_CONFIRMED"
  | "A"
  | "S";

export function normalizeAttendanceStatusV2(input: unknown): AttendanceStatusV2 | null {
  if (typeof input !== "string") return null;
  const s = input.trim().toUpperCase();
  if (!s) return null;

  // Cyrillic shortcuts from UI/TZ.
  if (s === "П") return "P";
  if (s === "О") return "O";
  if (s === "НБ") return "NB";
  if (s === "Б") return "B_PENDING";

  if (s === "P") return "P";
  if (s === "O") return "O";
  if (s === "NB") return "NB";
  if (s === "S") return "S";
  if (s === "A") return "A";
  if (s === "B_PENDING") return "B_PENDING";
  if (s === "B_CONFIRMED") return "B_CONFIRMED";

  // Back-compat with older constants occasionally seen in prototypes.
  if (s === "PRESENT") return "P";
  if (s === "LATE") return "O";
  if (s === "UNEXCUSED_ABSENCE") return "NB";

  return null;
}

export function getCanonicalAttendanceStatusV2(row: { statusV2: string | null; status: string | null }): AttendanceStatusV2 | null {
  return normalizeAttendanceStatusV2(row.statusV2 ?? row.status ?? null);
}

export type AttendanceStatusDecision = {
  ok: true;
  next: AttendanceStatusV2;
};

export type AttendanceStatusRejection = {
  ok: false;
  error: string;
};

export function decideAttendanceStatusChange(input: {
  actorRole: AppRole;
  isSemesterLocked: boolean;
  currentStatus: AttendanceStatusV2 | null;
  requestedStatus: AttendanceStatusV2;
}): AttendanceStatusDecision | AttendanceStatusRejection {
  const { actorRole, isSemesterLocked, currentStatus, requestedStatus } = input;

  if (isSemesterLocked) {
    return { ok: false, error: "Семестр закрыт. Изменение посещаемости запрещено." };
  }

  // Hard lock statuses: only curator can touch them.
  if ((currentStatus === "B_CONFIRMED" || currentStatus === "A") && actorRole !== "CURATOR") {
    return { ok: false, error: "Недостаточно прав: статус B_CONFIRMED или A может изменять только куратор." };
  }

  // Only curator can set A or B_CONFIRMED.
  if ((requestedStatus === "A" || requestedStatus === "B_CONFIRMED") && actorRole !== "CURATOR") {
    return { ok: false, error: "Недостаточно прав: статус A и B_CONFIRMED может устанавливать только куратор." };
  }

  // Teachers can only set base statuses during session; curator flow handles A/B confirm separately.
  if (actorRole === "TEACHER") {
    if (requestedStatus !== "P" && requestedStatus !== "O" && requestedStatus !== "NB" && requestedStatus !== "B_PENDING") {
      return { ok: false, error: "Недопустимый статус для преподавателя." };
    }
  }

  return { ok: true, next: requestedStatus };
}

