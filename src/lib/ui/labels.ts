export function formatRoleLabel(role: string) {
  const r = String(role).trim().toUpperCase();
  if (r === "TEACHER") return "Преподаватель";
  if (r === "CURATOR") return "Куратор";
  if (r === "ACADEMIC_OFFICE") return "Учебная часть";
  if (r === "LEADERSHIP") return "Руководство";
  if (r === "ADMIN") return "Администратор";
  return role;
}

export function formatClassSessionStatusLabel(status: string) {
  const s = String(status).trim().toLowerCase();
  if (s === "finished") return "Занятие завершено";
  if (s === "active") return "Идет занятие";
  if (s === "scheduled") return "Запланировано";
  if (s === "auto_closed") return "Авто-закрыто";
  if (s === "cancelled") return "Отменено";
  return status;
}
