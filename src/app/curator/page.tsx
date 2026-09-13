import Link from "next/link";

import {
  getCuratorGroupSummary,
  getCuratorSickSemesterOverview,
  getCuratorProblematicStudents,
  getCuratorAllSemesters,
} from "./dashboard/actions";
import { formatDisciplineLabel } from "@/lib/ui/labels";
import { SickRequestActions } from "./dashboard/sick-request-actions";
import { DateInputWithApply } from "./exemptions/auto-submit-date-input";

function parseYmd(param: string | undefined): string | null {
  if (!param || typeof param !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(param.trim());
  return m ? param.trim() : null;
}

function CuratorSemesterSelector(props: {
  allSemesters: { id: string; name: string | null; isLocked: boolean }[];
  currentSemesterId?: string;
  dateParam?: string;
}) {
  return (
    <form style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {props.dateParam ? <input type="hidden" name="date" value={props.dateParam} /> : null}
      <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>Семестр:</span>
      <select
        name="semesterId"
        defaultValue={props.currentSemesterId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        style={{
          appearance: "none",
          border: "1px solid #111827",
          borderRadius: 12,
          padding: "6px 10px",
          fontWeight: 900,
          fontSize: 13,
          color: "#111827",
          background: "white",
          cursor: "pointer",
        }}
      >
        {!props.currentSemesterId && <option value="">Авто (текущий)</option>}
        {props.allSemesters.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name ?? "Без названия"} {s.isLocked ? "(Архив)" : ""}
          </option>
        ))}
      </select>
    </form>
  );
}

export default async function CuratorPage(props: { searchParams: { date?: string; semesterId?: string } }) {
  const selectedDate = parseYmd(props.searchParams.date);
  const semesterIdParam = props.searchParams.semesterId;
  const semesterId = typeof semesterIdParam === "string" && semesterIdParam.length > 0 ? semesterIdParam : undefined;

  const allSemesters = await getCuratorAllSemesters();
  const sickSemester = await getCuratorSickSemesterOverview(selectedDate ?? undefined, semesterId);
  const summary = await getCuratorGroupSummary(semesterId);
  const problemRes = await getCuratorProblematicStudents(semesterId);

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 28, fontWeight: 900 }}>Кабинет куратора</h1>
          <CuratorSemesterSelector allSemesters={allSemesters} currentSemesterId={semesterId} dateParam={selectedDate ?? undefined} />
        </div>
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
                  <th style={{ padding: "10px 8px" }}>НБ</th>
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

      <div style={{ marginTop: 24, border: "1px solid #fca5a5", borderRadius: 14, padding: 14, background: "#fef2f2" }}>
        <div style={{ fontWeight: 900, marginBottom: 10, color: "#991b1b", fontSize: 17 }}>Студенты в зоне риска (Топ-15 по НБ)</div>
        <p style={{ marginTop: 4, color: "#7f1d1d", fontWeight: 600, fontSize: 13, marginBottom: 14 }}>
          Отображаются студенты ваших групп с наибольшим числом пропусков (НБ) за семестр.
        </p>
        {!problemRes.ok ? (
          <div style={{ color: "#991b1b", fontWeight: 800 }}>{problemRes.error}</div>
        ) : problemRes.items.length === 0 ? (
          <div style={{ color: "#991b1b", fontWeight: 700 }}>Нет студентов с пропусками.</div>
        ) : (
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {problemRes.items.map((st, i) => (
              <div key={st.studentId} style={{ display: "flex", justifyContent: "space-between", background: "white", padding: "10px 14px", borderRadius: 10, border: "1px solid #fca5a5" }}>
                <div>
                  <span style={{ fontWeight: 800, color: "#991b1b", marginRight: 8 }}>#{i + 1}</span>
                  <span style={{ fontWeight: 900, color: "#111827" }}>{st.studentName}</span>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{st.groupName}</div>
                </div>
                <strong style={{ color: "#b91c1c", fontSize: 16 }}>{st.nbCount}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, fontWeight: 900, fontSize: 17 }}>Справки Б за текущий семестр</div>
      <p style={{ marginTop: 8, color: "#6b7280", fontWeight: 600 }}>
        Неподтверждённые Б, подтверждённые Б и отклонённые справки Б (НБ после отклонения). Обработка запросов Б — после окончания занятия; правки по статусу
        А — в разделе «Освобождения», пока семестр не закрыт.
      </p>

      <form method="get" style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
        {semesterId && <input type="hidden" name="semesterId" value={semesterId} />}
        <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
          Дата
          <DateInputWithApply defaultValue={selectedDate ?? ""} />
        </label>
        {selectedDate && (
          <Link href="/curator" style={{ marginBottom: 12, fontSize: 14, fontWeight: 800, color: "#dc2626", textDecoration: "none" }}>Сбросить фильтр</Link>
        )}
      </form>

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
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 640 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <th style={{ padding: "10px 8px" }}>Студент</th>
                  <th style={{ padding: "10px 8px" }}>Группа</th>
                  <th style={{ padding: "10px 8px" }}>Занятие</th>
                  <th style={{ padding: "10px 8px" }}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {sickSemester.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 14, color: "#6b7280", fontWeight: 700 }}>
                      Нет записей Б за семестр по вашим группам.
                    </td>
                  </tr>
                ) : (
                  sickSemester.rows.map((item) => (
                    <tr key={item.attendanceId} style={{ borderBottom: "1px solid #f3f4f6" }}>
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
                      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                        <SickRequestActions
                          attendanceId={item.attendanceId}
                          semesterLocked={sickSemester.semesterLocked || !!item.classSession.semester?.isLocked}
                          rowKind={item.rowKind}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

