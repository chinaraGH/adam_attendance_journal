import { redirect } from "next/navigation";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { getDashboardPathForRole } from "@/lib/auth/role-routes";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const user = await getCurrentUserOrRedirect("/login");
  redirect(getDashboardPathForRole(user.role));
}
