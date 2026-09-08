import type { AppRole } from "@/lib/auth/get-current-user";

export function getDashboardPathForRole(role: AppRole) {
  if (role === "TEACHER") return "/teacher";
  if (role === "STUDENT") return "/student";
  if (role === "CURATOR") return "/curator";
  if (role === "LEADERSHIP") return "/acadepartment";
  if (role === "ADMIN" || role === "ACADEMIC_OFFICE") return "/acadepartment";
  return "/teacher";
}

