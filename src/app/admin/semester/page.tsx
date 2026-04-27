import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { getAllSemesters, getCurrentSemester, lockSemester, upsertSemester } from "./actions";

function toDateInputValue(d: Date) {
  // YYYY-MM-DD
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function SemesterAdminPage() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ACADEMIC_OFFICE" && actor.role !== "ADMIN") {
    return (
      <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Семестр</h1>
        <p style={{ marginTop: 12 }}>Недостаточно прав.</p>
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
      <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Семестр</h1>
        <p style={{ marginTop: 12 }}>Семестр не найден.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Управление семестром</h1>
      </div>

      <div style={{ marginTop: 12, color: "#6b7280" }}>
        Semester ID: <span style={{ fontWeight: 900 }}>{semester.id}</span>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "white" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Статус интеграций</div>
        <div style={{ display: "grid", gap: 6, color: "#111827" }}>
          <div>
            <span style={{ fontWeight: 900 }}>schedule_last_sync_at</span>:{" "}
            <span style={{ color: "#6b7280" }}>
              {scheduleLastSuccess ? new Date(scheduleLastSuccess.createdAt).toLocaleString("ru-RU") : "—"}
            </span>
          </div>
          <div>
            <span style={{ fontWeight: 900 }}>gaudi_last_sync_at</span>:{" "}
            <span style={{ color: "#6b7280" }}>
              {gaudiLastSuccess ? new Date(gaudiLastSuccess.createdAt).toLocaleString("ru-RU") : "—"}
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "white" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Создание / редактирование семестра</div>
        <form action={upsertSemester} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
          <input type="hidden" name="semesterId" value={semester.id} />
          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            Название
            <input
              name="name"
              defaultValue={semester.name ?? ""}
              placeholder="Например: Весенний семестр 2026"
              style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            Начало
            <input
              type="date"
              name="startDate"
              defaultValue={toDateInputValue(semester.startDate)}
              style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            Конец
            <input
              type="date"
              name="endDate"
              defaultValue={toDateInputValue(semester.endDate)}
              style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
            />
          </label>
          <button
            type="submit"
            style={{
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: "pointer",
              marginTop: 6,
            }}
          >
            Сохранить семестр
          </button>
        </form>

        <div style={{ marginTop: 14, color: "#6b7280", fontWeight: 700 }}>Последние семестры:</div>
        <div style={{ marginTop: 8, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "10px 8px" }}>Название</th>
                <th style={{ padding: "10px 8px" }}>Начало</th>
                <th style={{ padding: "10px 8px" }}>Конец</th>
                <th style={{ padding: "10px 8px" }}>Locked</th>
              </tr>
            </thead>
            <tbody>
              {semesters.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 8px", fontWeight: 900 }}>{s.name ?? "—"}</td>
                  <td style={{ padding: "10px 8px" }}>{new Date(s.startDate).toLocaleDateString("ru-RU")}</td>
                  <td style={{ padding: "10px 8px" }}>{new Date(s.endDate).toLocaleDateString("ru-RU")}</td>
                  <td style={{ padding: "10px 8px" }}>{s.isLocked ? "Да" : "Нет"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "white" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Блокировка семестра</div>
            <div style={{ marginTop: 4, color: "#6b7280" }}>
              После блокировки любые изменения посещаемости запрещены.
            </div>
          </div>
          <form action={lockSemester}>
            <input type="hidden" name="semesterId" value={semester.id} />
            <button
              type="submit"
              disabled={semester.isLocked}
              style={{
                border: "1px solid #dc2626",
                background: semester.isLocked ? "#f3f4f6" : "#dc2626",
                color: semester.isLocked ? "#6b7280" : "white",
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: semester.isLocked ? "not-allowed" : "pointer",
                opacity: semester.isLocked ? 0.7 : 1,
              }}
            >
              {semester.isLocked ? "Семестр заблокирован" : "Заблокировать семестр"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

