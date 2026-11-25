import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { getAllSemesters, getCurrentSemester, lockSemester } from "./actions";
import { SemesterForm } from "./semester-form";
import { btnDanger, card, fmtDateTime, h1, h2, hint, page, subtitle, tableWrap, td, th } from "@/lib/ui/office";

export const dynamic = "force-dynamic";

function formatSemesterDateRu(d: Date) {
  return d.toLocaleDateString("ru-RU", { timeZone: "UTC" });
}

export default async function SemesterAdminPage() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ACADEMIC_OFFICE" && actor.role !== "ADMIN") {
    return (
      <main style={page}>
        <h1 style={h1}>Управление семестром</h1>
        <p style={subtitle}>Недостаточно прав.</p>
      </main>
    );
  }

  const { semester } = await getCurrentSemester();
  const { semesters } = await getAllSemesters();
  const gaudiLastSuccess = await prisma.integrationLog.findFirst({
    where: { provider: "gaudi", status: "success" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const scheduleLastSuccess = await prisma.integrationLog.findFirst({
    where: { provider: "schedule", status: "success" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (!semester) {
    return (
      <main style={page}>
        <h1 style={h1}>Управление семестром</h1>
        <p style={subtitle}>Семестр не найден.</p>
      </main>
    );
  }

  return (
    <main style={page}>
      <h1 style={h1}>Управление семестром</h1>
      <div style={subtitle}>
        {semester.isLocked ? "Нет активных семестров. Заполните форму ниже, чтобы создать новый." : `Текущий семестр: ${semester.name ?? semester.id}`}
      </div>

      <section style={card}>
        <h2 style={h2}>Последняя успешная синхронизация</h2>
        <div style={{ marginTop: 10, display: "grid", gap: 4, fontSize: 14 }}>
          <div>
            Расписание: <span style={{ fontWeight: 800 }}>{scheduleLastSuccess ? fmtDateTime(scheduleLastSuccess.createdAt) : "—"}</span>
          </div>
          <div>
            Данные GAUDI: <span style={{ fontWeight: 800 }}>{gaudiLastSuccess ? fmtDateTime(gaudiLastSuccess.createdAt) : "—"}</span>
          </div>
        </div>
      </section>

      <section style={card}>
        <h2 style={h2}>{semester.isLocked ? "Создание семестра" : "Редактирование семестра"}</h2>
        <div style={{ marginTop: 12 }}>
          <SemesterForm semester={semester.isLocked ? null : semester} />
        </div>

        <h3 style={{ ...h2, fontSize: 15, marginTop: 20 }}>Последние семестры</h3>
        <div style={{ ...tableWrap, marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Название</th>
                <th style={th}>Начало</th>
                <th style={th}>Конец</th>
                <th style={th}>Заблокирован</th>
              </tr>
            </thead>
            <tbody>
              {semesters.map((s) => (
                <tr key={s.id}>
                  <td style={{ ...td, fontWeight: 800 }}>{s.name ?? "—"}</td>
                  <td style={td}>{formatSemesterDateRu(new Date(s.startDate))}</td>
                  <td style={td}>{formatSemesterDateRu(new Date(s.endDate))}</td>
                  <td style={td}>{s.isLocked ? "Да" : "Нет"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={h2}>Блокировка семестра</h2>
            <div style={hint}>После блокировки любые изменения посещаемости запрещены.</div>
          </div>
          <form action={lockSemester}>
            <input type="hidden" name="semesterId" value={semester.id} />
            <button
              type="submit"
              disabled={semester.isLocked}
              style={semester.isLocked ? { ...btnDanger, background: "#f3f4f6", borderColor: "#d1d5db", color: "#6b7280", cursor: "not-allowed" } : btnDanger}
            >
              {semester.isLocked ? "Семестр заблокирован" : "Заблокировать семестр"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
