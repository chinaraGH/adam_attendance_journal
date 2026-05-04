import { redirect } from "next/navigation";

export default function LegacyAdminSearchRedirect(props: { searchParams: { q?: string } }) {
  const raw = props.searchParams.q;
  const q = typeof raw === "string" ? raw.trim() : "";
  if (q.length > 0) redirect(`/acadepartment?q=${encodeURIComponent(q)}`);
  redirect("/acadepartment");
}
