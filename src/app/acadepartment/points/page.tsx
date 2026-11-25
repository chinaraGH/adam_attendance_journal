import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { h1, pageNarrow, subtitle } from "@/lib/ui/office";
import { PointsSettingsClient } from "./points-settings-client";

export const dynamic = "force-dynamic";

export default async function AcadepartmentPointsPage() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") redirect("/login");

  const semesters = await prisma.semester.findMany({ where: { isLocked: false }, orderBy: { startDate: "desc" }, take: 3 });

  return (
    <main style={pageNarrow}>
      <h1 style={h1}>Баллы и модули</h1>
      <p style={{ ...subtitle, marginBottom: 12 }}>
        Лимиты баллов и закрытие модулей. После закрытия модуля оценки этого модуля у преподавателей не меняются.
      </p>
      {semesters.length === 0 ? <p style={subtitle}>Нет открытых семестров.</p> : null}
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
