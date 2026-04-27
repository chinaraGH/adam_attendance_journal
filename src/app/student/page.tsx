import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(param: string | undefined): Date | null {
  if (!param) return null;
  const d = new Date(param);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function StudentPage(props: {
  searchParams: { view?: string; disciplineId?: string; day?: string; from?: string; to?: string };
}) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "STUDENT") {
    return (
      <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Моя посещаемость</h1>
        <p style={{ marginTop: 12 }}>Недостаточно прав.</p>
      </main>
    );
  }

  // Convention: for prototype auth, `User.id` matches `Student.id`.
  const student = await prisma.student.findFirst({
    where: { id: actor.id, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      group: { select: { id: true, name: true, code: true } },
    },
  });

  if (!student) {
    return (
      <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Моя посещаемость</h1>
        <p style={{ marginTop: 12 }}>Студент не найден или не активен.</p>
      </main>
    );
  }

  const view = (props.searchParams.view ?? "disciplines").toLowerCase(); // "disciplines" | "days"

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  defaultFrom.setHours(0, 0, 0, 0);
  const defaultTo = new Date(now);
  defaultTo.setHours(23, 59, 59, 999);

  const from = parseDate(props.searchParams.from) ?? defaultFrom;
  const to = parseDate(props.searchParams.to) ?? defaultTo;

  // Find sessions in period for this student's group, then join attendances.
  const sessions = await prisma.classSession.findMany({
    where: {
      groupId: student.group.id,
      isActive: true,
      deletedAt: null,
      startTime: { gte: from, lte: to },
      NOT: [{ statusV2: "cancelled" }, { status: "cancelled" }],
    },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      discipline: { select: { id: true, name: true, code: true } },
    },
  });

  const sessionIds = sessions.map((s) => s.id);
  const attendances =
    sessionIds.length === 0
      ? []
      : await prisma.attendance.findMany({
          where: {
            classSessionId: { in: sessionIds },
            studentId: student.id,
            isActive: true,
            deletedAt: null,
          },
          select: { classSessionId: true, statusV2: true, status: true },
        });
  const bySessionId = new Map(attendances.map((a) => [a.classSessionId, (a.statusV2 ?? a.status ?? null) as string | null]));

  const disciplineOptions = Array.from(
    new Map(sessions.map((s) => [s.discipline.id, s.discipline] as const)).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const selectedDisciplineId = props.searchParams.disciplineId ?? "";
  const selectedDay = props.searchParams.day ?? "";

  const filtered =
    view === "days"
      ? sessions.filter((s) => {
          if (!selectedDay) return true;
          const iso = s.startTime.toISOString().slice(0, 10);
          return iso === selectedDay;
        })
      : sessions.filter((s) => (selectedDisciplineId ? s.discipline.id === selectedDisciplineId : true));

  const total = filtered.length;
  const counts = { P: 0, O: 0, NB: 0, B_PENDING: 0, B_CONFIRMED: 0, A: 0, S: 0, OTHER: 0, NULL: 0 };
  for (const s of filtered) {
    const st = (bySessionId.get(s.id) ?? null)?.toUpperCase() ?? null;
    if (!st) counts.NULL += 1;
    else if (st === "P") counts.P += 1;
    else if (st === "O") counts.O += 1;
    else if (st === "NB") counts.NB += 1;
    else if (st === "B_PENDING") counts.B_PENDING += 1;
    else if (st === "B_CONFIRMED") counts.B_CONFIRMED += 1;
    else if (st === "A") counts.A += 1;
    else if (st === "S") counts.S += 1;
    else counts.OTHER += 1;
  }
  const pct = total > 0 ? Math.round(((counts.P + counts.O) / total) * 1000) / 10 : 0;

  // Day options derived from sessions in range.
  const dayOptions = Array.from(new Set(sessions.map((s) => s.startTime.toISOString().slice(0, 10)))).sort().reverse();

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900 }}>Моя посещаемость</h1>
          <div style={{ marginTop: 6, color: "#6b7280", fontWeight: 800 }}>
            {student.name} • {student.group.name}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "white" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Фильтры</div>

        <form style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            С
            <input
              type="date"
              name="from"
              defaultValue={toDateInputValue(from)}
              style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            По
            <input
              type="date"
              name="to"
              defaultValue={toDateInputValue(to)}
              style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            Вид
            <select
              name="view"
              defaultValue={view}
              style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
            >
              <option value="disciplines">По дисциплинам</option>
              <option value="days">По дням</option>
            </select>
          </label>

          {view === "days" ? (
            <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
              День
              <select
                name="day"
                defaultValue={selectedDay}
                style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
              >
                <option value="">Все</option>
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
              Дисциплина
              <select
                name="disciplineId"
                defaultValue={selectedDisciplineId}
                style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
              >
                <option value="">Все</option>
                {disciplineOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              type="submit"
              style={{
                width: "100%",
                border: "1px solid #111827",
                background: "#111827",
                color: "white",
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Применить
            </button>
          </div>
        </form>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "white" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Итоги</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, color: "#111827", fontWeight: 800 }}>
          <span>% посещаемости: {pct}%</span>
          <span>Всего занятий: {total}</span>
          <span>П: {counts.P}</span>
          <span>О: {counts.O}</span>
          <span>НБ: {counts.NB}</span>
          <span>Б_pending: {counts.B_PENDING}</span>
          <span>Б_confirmed: {counts.B_CONFIRMED}</span>
          <span>А: {counts.A}</span>
        </div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, background: "white", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "10px 8px" }}>Дата</th>
              <th style={{ padding: "10px 8px" }}>Дисциплина</th>
              <th style={{ padding: "10px 8px" }}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 12, color: "#6b7280", fontWeight: 800 }}>
                  За выбранный период данных нет.
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const date = s.startTime.toLocaleDateString("ru-RU");
                const status = bySessionId.get(s.id) ?? "—";
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 800 }}>{date}</td>
                    <td style={{ padding: "10px 8px" }}>{s.discipline.name}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 900 }}>{String(status)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

