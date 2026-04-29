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
