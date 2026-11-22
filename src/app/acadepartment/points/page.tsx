import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { PointsSettingsClient } from "./points-settings-client";

export const dynamic = "force-dynamic";

export default async function AcadepartmentPointsPage() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") redirect("/login");

  const semesters = await prisma.semester.findMany({ where: { isLocked: false }, orderBy: { startDate: "desc" }, take: 3 });

  return (
    <main style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Баллы семестра</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 12 }}>
        Лимиты баллов и закрытие модулей. После закрытия модуля оценки этого модуля у преподавателей не меняются.
      </p>
      {semesters.length === 0 ? <p>Нет открытых семестров.</p> : null}
      {semesters.map((s) => (
        <PointsSettingsClient
          key={s.id}
          semesterId={s.id}
          name={s.name ?? "Семестр"}
          totalPoints={s.totalPoints}
          modulePoints={s.modulePoints}
          extraMaxPoints={s.extraMaxPoints}
          module1Closed={Boolean(s.module1ClosedAt)}
          module2Closed={Boolean(s.module2ClosedAt)}
        />
      ))}
    </main>
  );
}
