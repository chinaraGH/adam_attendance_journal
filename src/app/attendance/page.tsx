import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Журнал открывается из кабинета преподавателя по конкретному занятию. */
export default function AttendanceIndexPage() {
  redirect("/teacher");
}
