import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { getCanonicalAttendanceStatusV2 } from "@/lib/attendance/status-machine";
import { formatAttendanceStatusDisplay } from "@/lib/ui/labels";
import { StudentAttendanceFilters } from "@/components/student-attendance-filters";
import { loadStudentPoints } from "@/lib/points/student-points";
import { formatPoints } from "@/lib/points/calc";

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toSingleParam(param: string | string[] | undefined): string | undefined {
  if (!param) return undefined;
  if (Array.isArray(param)) {
    const first = param.find(Boolean);
    return first?.trim() || undefined;
  }
  const value = param.trim();
  return value || undefined;
}

function parseDate(param: string | string[] | undefined): Date | null {
  const value = toSingleParam(param);
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, monthIndex, day);
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== monthIndex ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

function toStartOfDay(d: Date) {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toEndOfDay(d: Date) {
  const next = new Date(d);
  next.setHours(23, 59, 59, 999);
  return next;
}

export default async function StudentPage(props: {
  searchParams: {
    view?: string;
    disciplineId?: string | string[];
    day?: string | string[];
    from?: string | string[];
    to?: string | string[];
  };
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

  const myPoints = await loadStudentPoints(student.id, student.group.id);

  const view = (props.searchParams.view ?? "disciplines").toLowerCase(); // "disciplines" | "days"

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  defaultFrom.setHours(0, 0, 0, 0);
  const defaultTo = new Date(now);
  defaultTo.setHours(23, 59, 59, 999);

  const from = toStartOfDay(parseDate(props.searchParams.from) ?? defaultFrom);
  const to = toEndOfDay(parseDate(props.searchParams.to) ?? defaultTo);

  // Find sessions in period for this student's group, then join attendances.
  const sessions = await prisma.classSession.findMany({
    where: {
      groupId: student.group.id,
      isActive: true,
      deletedAt: null,
      startTime: { gte: from, lte: to },
      OR: [{ statusV2: { not: "cancelled" } }, { statusV2: null, status: { not: "cancelled" } }],
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

  const toArray = (value?: string | string[]) => {
    if (!value) return [];
    return (Array.isArray(value) ? value : [value]).filter(Boolean);
  };

  const selectedDisciplineIds = toArray(props.searchParams.disciplineId);
  const selectedDays = toArray(props.searchParams.day);

  const filtered =
    view === "days"
      ? sessions.filter((s) => {
          if (selectedDays.length === 0) return true;
          const iso = s.startTime.toISOString().slice(0, 10);
          return selectedDays.includes(iso);
        })
      : sessions.filter((s) =>
          selectedDisciplineIds.length > 0 ? selectedDisciplineIds.includes(s.discipline.id) : true,
        );

  const total = filtered.length;
  const counts = { P: 0, O: 0, NB: 0, B_PENDING: 0, B_CONFIRMED: 0, A: 0, S: 0, OTHER: 0, NULL: 0 };
  for (const s of filtered) {
    const raw = bySessionId.get(s.id) ?? null;
    const st = raw ? getCanonicalAttendanceStatusV2({ statusV2: raw, status: null }) : null;
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

      <div style={{ marginTop: 16, fontWeight: 900, fontSize: 18 }}>Мои баллы</div>
      {myPoints.length === 0 ? (
        <div style={{ marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "white", color: "#6b7280", fontWeight: 700 }}>
          Баллы пока не начислены: преподаватели ещё не заполнили технологические карты.
        </div>
      ) : (
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {myPoints.map((d) => {
            const r = d.row;
            const sum2 = (a: [number, number]) => a[0] + a[1];
            const share = d.limits.totalPoints > 0 ? Math.min(100, (r.total / d.limits.totalPoints) * 100) : 0;
            const tone = share >= 70 ? "#16a34a" : share >= 50 ? "#f59e0b" : "#dc2626";
            const line = (label: string, value: number, max: number) => (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", fontSize: 14 }}>
                <span style={{ color: "#374151" }}>{label}</span>
                <span style={{ fontWeight: 800 }}>
                  {formatPoints(value)}
                  <span style={{ color: "#6b7280", fontWeight: 600 }}> из {formatPoints(max)}</span>
                </span>
              </div>
            );
            return (
              <div key={d.cardId} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "white" }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{d.disciplineName}</div>
                <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>{d.teacherName}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>Итого</span>
                  <span style={{ fontSize: 24, fontWeight: 900 }}>
                    {formatPoints(r.total)}
                    <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 700 }}> из {formatPoints(d.limits.totalPoints)}</span>
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "#f3f4f6", overflow: "hidden", margin: "6px 0 10px" }}>
                  <div style={{ height: "100%", width: `${share}%`, background: tone }} />
                </div>
                {line("Посещаемость", sum2(r.attendance), sum2(d.max.attendance))}
                {line("Текущий контроль", sum2(r.current), sum2(d.max.current))}
                {line("Самостоятельная работа", sum2(r.selfWork), sum2(d.max.selfWork))}
                {line("Рубежный контроль", sum2(r.border), sum2(d.max.border))}
                <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 6, paddingTop: 6 }}>
                  {line(`Модуль 1${d.moduleClosed[0] ? " (закрыт)" : ""}`, r.moduleTotals[0], d.limits.modulePoints)}
                  {line(`Модуль 2${d.moduleClosed[1] ? " (закрыт)" : ""}`, r.moduleTotals[1], d.limits.modulePoints)}
                  {d.max.extra > 0 ? line("Дополнительные", r.extra, d.max.extra) : null}
                </div>
                <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
                  Занятий: был {r.attended}, пропустил {r.missed}, освобождён {r.excused}.
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: 4, color: "#6b7280", fontSize: 12 }}>
        Баллы считаются на момент открытия страницы. Итоговая ведомость формируется в GAUDI.
      </div>

      <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "white" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Фильтры</div>
        <StudentAttendanceFilters
          initialFrom={toDateInputValue(from)}
          initialTo={toDateInputValue(to)}
          disciplineOptions={disciplineOptions.map((d) => ({ value: d.id, label: d.name }))}
          selectedDisciplineIds={selectedDisciplineIds}
        />
      </div>

      <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "white" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Итоги</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, color: "#111827", fontWeight: 800 }}>
          <span>% посещаемости: {pct}%</span>
          <span>Всего занятий: {total}</span>
          <span>П: {counts.P}</span>
          <span>О: {counts.O}</span>
          <span>НБ: {counts.NB}</span>
          <span>неподтверждённое Б: {counts.B_PENDING}</span>
          <span>Б: {counts.B_CONFIRMED}</span>
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
                const raw = bySessionId.get(s.id);
                const statusLabel = formatAttendanceStatusDisplay(raw);
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 800 }}>{date}</td>
                    <td style={{ padding: "10px 8px" }}>{s.discipline.name}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 900 }}>{statusLabel}</td>
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

