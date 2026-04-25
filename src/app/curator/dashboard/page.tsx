import Link from "next/link";

import { decideSickRequestForm, getCuratorGroupSummary, getPendingSickAttendances, setAForm } from "./actions";

export default async function CuratorDashboardPage() {
  const result = await getPendingSickAttendances();
  const summary = await getCuratorGroupSummary();

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Кабинет куратора</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/" style={{ fontWeight: 800 }}>
            ← Назад
          </Link>
          <Link href="/admin/search" style={{ fontWeight: 800 }}>
            Поиск студентов
          </Link>
          <Link href="/admin/semester" style={{ fontWeight: 800 }}>
            Семестр
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "white" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Сводка по группам</div>
        {!summary.ok ? (
          <div style={{ color: "#991b1b", fontWeight: 800 }}>{summary.error}</div>
        ) : summary.rows.length === 0 ? (
          <div style={{ color: "#6b7280" }}>Нет групп, закреплённых за куратором.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 8px" }}>Группа</th>
                  <th style={{ padding: "10px 8px" }}>Всего занятий</th>
                  <th style={{ padding: "10px 8px" }}>% посещаемости</th>
                  <th style={{ padding: "10px 8px" }}>NB</th>
                  <th style={{ padding: "10px 8px" }}>Б</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={r.groupId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 900 }}>
                      <Link href={`/curator/reports/${r.groupId}`} style={{ fontWeight: 900 }}>
                        {r.groupName}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 8px" }}>{r.totalSessions}</td>
                    <td style={{ padding: "10px 8px" }}>
                      {r.attendancePct}%{" "}
                      <span style={{ fontWeight: 900, color: r.trend === "up" ? "#16a34a" : r.trend === "down" ? "#dc2626" : "#6b7280" }}>
                        {r.trend === "up" ? "↑" : r.trend === "down" ? "↓" : "→"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 8px" }}>{r.nbCount}</td>
                    <td style={{ padding: "10px 8px" }}>{r.sickCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ marginTop: 10, color: "#6b7280", fontWeight: 700 }}>
        Запросы по болезни (B_PENDING), доступные для обработки после окончания занятия.
      </p>

      {!result.ok ? (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "#fef2f2", color: "#991b1b", fontWeight: 800 }}>
          {result.error}
        </div>
      ) : result.items.length === 0 ? (
        <p style={{ marginTop: 16 }}>Нет активных запросов B_PENDING.</p>
      ) : (
        <ul style={{ marginTop: 16, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
          {result.items.map((item) => (
            <li
              key={item.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 14,
                background: "white",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>
                    {item.student.name} <span style={{ color: "#6b7280" }}>({item.student.id})</span>
                  </div>
                  <div style={{ marginTop: 4, color: "#374151", fontWeight: 800 }}>
                    Группа: {item.student.group.name}
                  </div>
                  <div style={{ marginTop: 4, color: "#6b7280" }}>
                    Занятие: {item.classSession.disciplineId} • {new Date(item.classSession.startTime).toLocaleString("ru-RU")}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 900 }}>Статус: {item.statusV2}</div>
                  <div style={{ marginTop: 4, color: "#6b7280" }}>Обновлено: {new Date(item.updatedAt).toLocaleString("ru-RU")}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {/* actions are server actions via <form> to keep it dependency-free */}
                <form action={decideSickRequestForm}>
                  <input type="hidden" name="attendanceId" value={item.id} />
                  <input type="hidden" name="decision" value="confirm" />
                  <button
                    type="submit"
                    disabled={!!item.classSession.semester?.isLocked}
                    style={{
                      borderRadius: 12,
                      padding: "10px 12px",
                      border: "1px solid #16a34a",
                      background: item.classSession.semester?.isLocked ? "#f3f4f6" : "#16a34a",
                      color: item.classSession.semester?.isLocked ? "#6b7280" : "white",
                      fontWeight: 900,
                      cursor: item.classSession.semester?.isLocked ? "not-allowed" : "pointer",
                    }}
                  >
                    Подтвердить (B_CONFIRMED)
                  </button>
                </form>

                <form action={decideSickRequestForm}>
                  <input type="hidden" name="attendanceId" value={item.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <button
                    type="submit"
                    disabled={!!item.classSession.semester?.isLocked}
                    style={{
                      borderRadius: 12,
                      padding: "10px 12px",
                      border: "1px solid #dc2626",
                      background: item.classSession.semester?.isLocked ? "#f3f4f6" : "#dc2626",
                      color: item.classSession.semester?.isLocked ? "#6b7280" : "white",
                      fontWeight: 900,
                      cursor: item.classSession.semester?.isLocked ? "not-allowed" : "pointer",
                    }}
                  >
                    Отклонить (NB)
                  </button>
                </form>

                <form action={setAForm}>
                  <input type="hidden" name="attendanceId" value={item.id} />
                  <button
                    type="submit"
                    disabled={!!item.classSession.semester?.isLocked}
                    style={{
                      borderRadius: 12,
                      padding: "10px 12px",
                      border: "1px solid #111827",
                      background: item.classSession.semester?.isLocked ? "#f3f4f6" : "white",
                      color: item.classSession.semester?.isLocked ? "#6b7280" : "#111827",
                      fontWeight: 900,
                      cursor: item.classSession.semester?.isLocked ? "not-allowed" : "pointer",
                    }}
                  >
                    Поставить A
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

