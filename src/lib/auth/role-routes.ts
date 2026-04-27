import type { AppRole } from "@/lib/auth/get-current-user";

export function getDashboardPathForRole(role: AppRole) {
  if (role === "TEACHER") return "/";
  if (role === "STUDENT") return "/student";
  if (role === "CURATOR") return "/curator/dashboard";
  if (role === "LEADERSHIP") return "/leadership/dashboard";
  if (role === "ADMIN" || role === "ACADEMIC_OFFICE") return "/admin/search";
  return "/";
}

