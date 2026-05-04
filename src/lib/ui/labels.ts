import { getCanonicalAttendanceStatusV2 } from "@/lib/attendance/status-machine";

/**
 * Единообразные подписи статусов посещаемости для пользовательского интерфейса
 * (в БД остаются латинские коды: P, NB, B_PENDING, …).
 */
export function formatAttendanceStatusDisplay(
  input: string | null | undefined | { statusV2: string | null; status: string | null },
): string {
  const row =
    typeof input === "object" && input !== null && "statusV2" in input
      ? input
      : { statusV2: typeof input === "string" ? input : null, status: null };

  const canonical = getCanonicalAttendanceStatusV2(row);
  if (!canonical) {
    if (typeof input === "string" && input.trim()) return input.trim();
    return "—";
  }

  switch (canonical) {
    case "P":
      return "П";
    case "O":
      return "О";
    case "NB":
      return "НБ";
    case "B_PENDING":
      return "неподтверждённое Б";
    case "B_CONFIRMED":
      return "Б";
    case "A":
      return "А";
    case "S":
      return "С";
    default:
      return canonical;
  }
}

export function formatRoleLabel(role: string) {
  const r = String(role).trim().toUpperCase();
  if (r === "TEACHER") return "Преподаватель";
  if (r === "CURATOR") return "Куратор";
  if (r === "ACADEMIC_OFFICE") return "Учебная часть";
  if (r === "LEADERSHIP") return "Руководство";
  if (r === "ADMIN") return "Администратор";
  if (r === "STUDENT") return "Студент";
  return role;
}

export function formatClassSessionStatusLabel(status: string) {
  const s = String(status).trim().toLowerCase();
  if (s === "finished") return "Занятие завершено";
  if (s === "active") return "Идет занятие";
  if (s === "scheduled") return "Запланировано";
  if (s === "auto_closed") return "Только просмотр";
  if (s === "cancelled") return "Отменено";
  return status;
}

const DISCIPLINE_FALLBACK_BY_ID: Record<string, string> = {
  DINF: "Информатика",
  DENG: "Английский язык",
  DHISECO: "История экономики",
  DMNG: "Менеджмент",
  DDESIGN: "Дизайн мышления",
  DDB: "Базы данных",
};

export function formatDisciplineLabel(input: { disciplineId: string; disciplineName?: string | null }) {
  const name = input.disciplineName?.trim();
  if (name) return name;
  const disciplineId = String(input.disciplineId ?? "").trim();
  const normalized = disciplineId.toUpperCase();
  return DISCIPLINE_FALLBACK_BY_ID[normalized] ?? disciplineId;
}
