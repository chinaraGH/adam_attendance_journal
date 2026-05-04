import Link from "next/link";

import { getCuratorGroupSummary, getCuratorSickSemesterOverview } from "./actions";
import { formatDisciplineLabel } from "@/lib/ui/labels";
import { SickRequestActions } from "./sick-request-actions";

export default async function CuratorDashboardPage() {
  const sickSemester = await getCuratorSickSemesterOverview();
  const summary = await getCuratorGroupSummary();

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Кабинет куратора</h1>
        <Link
          href="/curator/exemptions"
          style={{
            fontWeight: 900,
            border: "1px solid #111827",
            background: "#111827",
            color: "white",
            padding: "10px 16px",
            borderRadius: 12,
            textDecoration: "none",
          }}
        >
          Освобождения
        </Link>
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

      <div style={{ marginTop: 20, fontWeight: 900, fontSize: 17 }}>Справки Б за текущий семестр</div>
      <p style={{ marginTop: 8, color: "#6b7280", fontWeight: 600 }}>
        Неподтверждённые (B_PENDING), подтверждённые (B_CONFIRMED) и отклонённые справки Б (NB после отклонения). Обработка запросов B_PENDING — после
        окончания занятия; правки по статусу А — в разделе «Освобождения», пока семестр не закрыт.
      </p>

      {!sickSemester.ok ? (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "#fef2f2", color: "#991b1b", fontWeight: 800 }}>
          {sickSemester.error}
        </div>
      ) : (
        <>
          {sickSemester.semesterName ? (
            <div style={{ marginTop: 10, color: "#374151", fontWeight: 700 }}>
              Семестр: {sickSemester.semesterName}
              {sickSemester.semesterEndDate ? (
                <span> • до {new Date(sickSemester.semesterEndDate).toLocaleDateString("ru-RU")}</span>
              ) : null}
            </div>
          ) : null}
          {sickSemester.semesterLocked ? (
            <div style={{ marginTop: 10, color: "#991b1b", fontWeight: 800 }}>Семестр заблокирован — новые действия по журналу недоступны.</div>
          ) : null}

          <div style={{ marginTop: 14, overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 14, background: "white" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 720 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <th style={{ padding: "10px 8px" }}>Тип</th>
                  <th style={{ padding: "10px 8px" }}>Студент</th>
                  <th style={{ padding: "10px 8px" }}>Группа</th>
                  <th style={{ padding: "10px 8px" }}>Занятие</th>
                  <th style={{ padding: "10px 8px" }}>Статус</th>
                  <th style={{ padding: "10px 8px" }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {sickSemester.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 14, color: "#6b7280", fontWeight: 700 }}>
                      Нет записей Б за семестр по вашим группам.
                    </td>
                  </tr>
                ) : (
                  sickSemester.rows.map((item) => {
                    const statusShown = (item.statusV2 ?? item.status ?? "—").toString();
                    const kindLabel =
                      item.rowKind === "pending"
                        ? "Ожидает (B_PENDING)"
                        : item.rowKind === "confirmed"
                          ? "Подтверждена (B_CONFIRMED)"
                          : "Отклонена (NB)";
                    return (
                      <tr key={item.attendanceId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 8px", fontWeight: 800 }}>{kindLabel}</td>
                        <td style={{ padding: "10px 8px", fontWeight: 800 }}>
                          {item.student.name}
                          <div style={{ color: "#6b7280", fontSize: 12 }}>{item.student.id}</div>
                        </td>
                        <td style={{ padding: "10px 8px" }}>{item.student.group.name}</td>
                        <td style={{ padding: "10px 8px" }}>
                          {formatDisciplineLabel({
                            disciplineId: item.classSession.disciplineId,
                            disciplineName: item.classSession.discipline?.name,
                          })}
                          <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                            {new Date(item.classSession.startTime).toLocaleString("ru-RU")}
                          </div>
                        </td>
                        <td style={{ padding: "10px 8px", fontWeight: 700 }}>{statusShown}</td>
                        <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                          {item.rowKind === "pending" ? (
                            <SickRequestActions
                              attendanceId={item.attendanceId}
                              semesterLocked={sickSemester.semesterLocked || !!item.classSession.semester?.isLocked}
                            />
                          ) : (
                            <Link
                              href={`/curator/exemptions/${item.student.group.id}?date=${item.exemptionsDateYmd}`}
                              style={{ fontWeight: 800, color: "#2563eb" }}
                            >
                              Освобождения
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

