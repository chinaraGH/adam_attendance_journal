import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { visibleProgramIds } from "@/lib/points/access";
import { aggregate, loadAnalyticsRows, sumCounts, ATTENDANCE_RISK_PERCENT, type Aggregate, type AnalyticsRow, type Counts } from "@/lib/points/analytics";
import { formatPoints } from "@/lib/points/calc";
import { listSemesterOptions, resolveSemesterId } from "@/lib/semester/resolve";
import { CuratorSemesterSelector } from "@/app/curator/semester-selector";

export const dynamic = "force-dynamic";

type View = "overview" | "courses" | "groups" | "disciplines";
type Params = { view?: string; groupId?: string; disciplineId?: string; programId?: string; course?: string; semesterId?: string };

const pct = (n: number | null) => (n === null ? "нет данных" : `${String(n).replace(".", ",")}%`);
const rateColor = (n: number | null) => (n === null ? "#6b7280" : n >= 85 ? "#166534" : n >= ATTENDANCE_RISK_PERCENT ? "#b45309" : "#b91c1c");
const courseLabel = (c: number | null) => (c === null ? "Курс не определён" : `${c} курс`);
const ratio = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

const card: CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 14, background: "white" };
const th: CSSProperties = { padding: "8px 10px", textAlign: "right", fontSize: 12, color: "#374151", fontWeight: 800, whiteSpace: "nowrap", borderBottom: "1px solid #e5e7eb", verticalAlign: "bottom" };
const td: CSSProperties = { padding: "9px 10px", textAlign: "right", fontSize: 14, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap", verticalAlign: "top" };
const link: CSSProperties = { color: "#1d4ed8", textDecoration: "none", fontWeight: 700 };

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const a = m.get(k);
    if (a) a.push(it);
    else m.set(k, [it]);
  }
  return m;
}

function Tile(props: { label: string; value: ReactNode; tone?: string; sub?: string }) {
  return (
    <div style={{ ...card, padding: "10px 12px" }}>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{props.label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: props.tone ?? "#111827", lineHeight: 1.2 }}>{props.value}</div>
      {props.sub ? <div style={{ fontSize: 12, color: "#6b7280" }}>{props.sub}</div> : null}
    </div>
  );
}

function Tiles(props: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>{props.children}</div>;
}

function H2(props: { children: ReactNode }) {
  return <h2 style={{ fontSize: 17, fontWeight: 800, margin: "18px 0 8px" }}>{props.children}</h2>;
}

function Bands(props: { bands: { high: number; good: number; mid: number; low: number } }) {
  const { high, good, mid, low } = props.bands;
  const total = high + good + mid + low;
  const parts = [
    { n: high, c: "#16a34a", t: "90–100%" },
    { n: good, c: "#84cc16", t: "70–89%" },
    { n: mid, c: "#f59e0b", t: "50–69%" },
    { n: low, c: "#dc2626", t: "ниже 50%" },
  ];
  return (
    <div style={{ ...card, padding: 12 }}>
      <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "#f3f4f6" }}>
        {total > 0 ? parts.map((p) => (p.n > 0 ? <div key={p.t} style={{ width: `${(p.n / total) * 100}%`, background: p.c }} /> : null)) : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8, fontSize: 13 }}>
        {parts.map((p) => (
          <span key={p.t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 10, height: 10, borderRadius: 5, background: p.c, display: "inline-block" }} />
            {p.t}: <b>{p.n}</b>
          </span>
        ))}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>Сколько студентов по итоговым баллам в каждой зоне (доля от максимума, по каждому предмету).</div>
    </div>
  );
}

/** Все виды отметок посещаемости: сколько и какая доля от всех отметок. */
function Breakdown(props: { counts: Counts }) {
  const c = props.counts;
  const total = c.p + c.o + c.nb + c.bPending + c.bConfirmed + c.a;
  const items: Array<{ label: string; n: number; color: string; note?: string }> = [
    { label: "Присутствовали (П)", n: c.p, color: "#166534" },
    { label: "Опоздали (О)", n: c.o, color: "#b45309" },
    { label: "Не были (НБ)", n: c.nb, color: "#b91c1c" },
    { label: "Б без подтверждения", n: c.bPending, color: "#b91c1c", note: "считается пропуском" },
    { label: "Б подтверждённая", n: c.bConfirmed, color: "#1d4ed8", note: "освобождены, в посещаемость не входят" },
    { label: "Освобождены (А)", n: c.a, color: "#1d4ed8", note: "освобождены, в посещаемость не входят" },
  ];
  return (
    <div style={{ ...card, padding: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Отметки посещаемости: всего {total}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
        {items.map((it) => (
          <div key={it.label} style={{ border: "1px solid #f3f4f6", borderRadius: 10, padding: "6px 8px" }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{it.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: it.color }}>
              {it.n} <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>({String(ratio(it.n, total)).replace(".", ",")}%)</span>
            </div>
            {it.note ? <div style={{ fontSize: 11, color: "#9ca3af" }}>{it.note}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Table(props: { head: ReactNode[]; children: ReactNode; minWidth?: number }) {
  return (
    <div style={{ ...card, overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: props.minWidth ?? 520 }}>
        <thead>
          <tr>
            {props.head.map((h, i) => (
              <th key={i} style={{ ...th, textAlign: i === 0 ? "left" : "right" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{props.children}</tbody>
      </table>
    </div>
  );
}

/** Посещаемость: процент и «сколько из скольких». */
function RateCell(props: { a: Aggregate }) {
  const { a } = props;
  return (
    <td style={td}>
      <div style={{ color: rateColor(a.attendanceRate), fontWeight: 800 }}>{pct(a.attendanceRate)}</div>
      <div style={{ fontSize: 11, color: "#6b7280" }}>
        {a.attended} из {a.attended + a.missed}
      </div>
    </td>
  );
}

function AvgCell(props: { a: Aggregate }) {
  const { a } = props;
  return (
    <td style={td}>
      <div style={{ fontWeight: 800 }}>{formatPoints(a.averageTotal)}</div>
      <div style={{ fontSize: 11, color: "#6b7280" }}>
        {formatPoints(a.minTotal)}–{formatPoints(a.maxTotalScore)}
      </div>
    </td>
  );
}

function RiskCell(props: { a: Aggregate }) {
  return <td style={{ ...td, color: props.a.atRisk > 0 ? "#b91c1c" : undefined, fontWeight: props.a.atRisk > 0 ? 800 : 500 }}>{props.a.atRisk}</td>;
}

export default async function ProgramHeadPage(props: { searchParams: Params }) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "PROGRAM_HEAD" && actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") redirect("/login");

  const sp = props.searchParams;
  const view: View = sp.view === "groups" || sp.view === "disciplines" || sp.view === "courses" ? sp.view : "overview";

  const allowed = await visibleProgramIds(actor);
  const programs = await prisma.program.findMany({
    where: { isActive: true, deletedAt: null, ...(allowed === null ? {} : { id: { in: allowed } }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const selectedProgram = programs.find((p) => p.id === sp.programId) ?? null;
  const scopeIds = selectedProgram ? [selectedProgram.id] : allowed === null ? null : programs.map((p) => p.id);

  const semesterId = await resolveSemesterId(sp.semesterId);
  const semesterOptions = await listSemesterOptions();
  const rows: AnalyticsRow[] = await loadAnalyticsRows(scopeIds, semesterId);
  const total = aggregate(rows);

  // занятия есть, а карты нет
  const sessions = await prisma.classSession.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...(semesterId ? { semesterId } : { semesterId: { not: null } }),
      ...(scopeIds === null ? {} : { group: { programId: { in: scopeIds } } }),
    },
    select: { disciplineId: true, teacherId: true, discipline: { select: { name: true } }, teacher: { select: { name: true } } },
  });
  const haveCard = new Set(rows.map((r) => `${r.disciplineId}|${r.teacherId}`));
  const cardsInScope = await prisma.techCard.findMany({
    where: { isActive: true, deletedAt: null, ...(semesterId ? { semesterId } : {}), ...(scopeIds === null ? {} : { programId: { in: scopeIds } }) },
    select: { disciplineId: true, teacherId: true },
  });
  for (const c of cardsInScope) haveCard.add(`${c.disciplineId}|${c.teacherId}`);
  const missing = new Map<string, string>();
  for (const s of sessions) {
    const k = `${s.disciplineId}|${s.teacherId}`;
    if (!haveCard.has(k)) missing.set(k, `${s.discipline.name} · ${s.teacher.name}`);
  }

  const byGroup = groupBy(rows, (r) => r.groupId);
  const byDiscipline = groupBy(rows, (r) => r.disciplineId);
  const byCourse = groupBy(rows, (r) => String(r.course ?? 0));

  const href = (q: Params) => {
    const p = new URLSearchParams();
    if (q.view && q.view !== "overview") p.set("view", q.view);
    if (q.groupId) p.set("groupId", q.groupId);
    if (q.disciplineId) p.set("disciplineId", q.disciplineId);
    if (q.course) p.set("course", q.course);
    if (semesterId) p.set("semesterId", semesterId);
    const pid = q.programId ?? selectedProgram?.id;
    if (pid) p.set("programId", pid);
    const s = p.toString();
    return `/program-head${s ? `?${s}` : ""}`;
  };
  const tab = (v: View, label: string) => (
    <Link
      key={v}
      href={href({ view: v })}
      style={{
        flex: 1,
        textAlign: "center",
        padding: "10px 6px",
        borderRadius: 10,
        fontWeight: 800,
        fontSize: 13,
        textDecoration: "none",
        border: "1px solid " + (view === v ? "#111827" : "#d1d5db"),
        background: view === v ? "#111827" : "white",
        color: view === v ? "white" : "#374151",
      }}
    >
      {label}
    </Link>
  );
  const reportHref = (r: AnalyticsRow) => `/points-report?cardId=${encodeURIComponent(r.cardId)}&groupId=${encodeURIComponent(r.groupId)}`;

  const kpis = (a: Aggregate, opts?: { groups?: boolean; disciplines?: boolean; teachers?: boolean }) => (
    <Tiles>
      <Tile label="Студентов" value={a.students} />
      {opts?.groups ? <Tile label="Групп" value={a.groups} /> : null}
      {opts?.disciplines ? <Tile label="Дисциплин" value={a.disciplines} /> : null}
      {opts?.teachers ? <Tile label="Преподавателей" value={a.teachers} /> : null}
      <Tile label="Посещаемость" value={pct(a.attendanceRate)} tone={rateColor(a.attendanceRate)} sub={`${a.attended} из ${a.attended + a.missed} отметок`} />
      <Tile label="Средний итог" value={`${formatPoints(a.averageTotal)} из ${formatPoints(a.totalMax)}`} sub={`от ${formatPoints(a.minTotal)} до ${formatPoints(a.maxTotalScore)}`} />
      <Tile label={`Посещаемость ниже ${ATTENDANCE_RISK_PERCENT}%`} value={a.atRisk} tone={a.atRisk > 0 ? "#b91c1c" : "#166534"} sub="студентов в зоне риска" />
    </Tiles>
  );

  const groupRow = (gid: string, items: AnalyticsRow[]) => {
    const a = aggregate(items);
    return (
      <tr key={gid}>
        <td style={{ ...td, textAlign: "left", fontWeight: 800 }}>
          <Link href={href({ view: "groups", groupId: gid })} style={link}>
            {items[0].groupName}
          </Link>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{courseLabel(items[0].course)}</div>
        </td>
        <td style={td}>{a.students}</td>
        <RateCell a={a} />
        <AvgCell a={a} />
        <RiskCell a={a} />
      </tr>
    );
  };
  const disciplineRow = (did: string, items: AnalyticsRow[]) => {
    const a = aggregate(items);
    return (
      <tr key={did}>
        <td style={{ ...td, textAlign: "left", fontWeight: 800 }}>
          <Link href={href({ view: "disciplines", disciplineId: did })} style={link}>
            {items[0].disciplineName}
          </Link>
        </td>
        <td style={td}>{a.groups}</td>
        <RateCell a={a} />
        <AvgCell a={a} />
        <RiskCell a={a} />
      </tr>
    );
  };
  const courseRow = (key: string, items: AnalyticsRow[]) => {
    const a = aggregate(items);
    return (
      <tr key={key}>
        <td style={{ ...td, textAlign: "left", fontWeight: 800 }}>
          <Link href={href({ view: "courses", course: key })} style={link}>
            {courseLabel(items[0].course)}
          </Link>
        </td>
        <td style={td}>{a.groups}</td>
        <td style={td}>{a.students}</td>
        <RateCell a={a} />
        <AvgCell a={a} />
        <RiskCell a={a} />
      </tr>
    );
  };
  const groupHead = ["Группа", "Студентов", "Посещаемость", "Ср. итог (мин–макс)", "Риск"];
  const disciplineHead = ["Дисциплина", "Групп", "Посещаемость", "Ср. итог (мин–макс)", "Риск"];
  const courseHead = ["Курс", "Групп", "Студентов", "Посещаемость", "Ср. итог (мин–макс)", "Риск"];
  const sortedGroups = [...byGroup.entries()].sort((a, b) => a[1][0].groupName.localeCompare(b[1][0].groupName, "ru"));
  const sortedDisciplines = [...byDiscipline.entries()].sort((a, b) => a[1][0].disciplineName.localeCompare(b[1][0].disciplineName, "ru"));
  const sortedCourses = [...byCourse.entries()].sort((a, b) => (Number(a[0]) || 99) - (Number(b[0]) || 99));

  let body: ReactNode;
  if (rows.length === 0) {
    body = <p style={{ color: "#6b7280" }}>Заполненных технологических карт пока нет, считать нечего.</p>;
  } else if (view === "overview") {
    body = (
      <>
        {kpis(total, { groups: true, disciplines: true, teachers: true })}
        <H2>Посещаемость: все виды отметок</H2>
        <Breakdown counts={total.counts} />
        <H2>Распределение итоговых баллов</H2>
        <Bands bands={total.bands} />
        <H2>По курсам</H2>
        <Table head={courseHead}>{sortedCourses.map(([k, items]) => courseRow(k, items))}</Table>
        <H2>По группам</H2>
        <Table head={groupHead}>{sortedGroups.map(([id, items]) => groupRow(id, items))}</Table>
        <H2>По дисциплинам</H2>
        <Table head={disciplineHead}>{sortedDisciplines.map(([id, items]) => disciplineRow(id, items))}</Table>
      </>
    );
  } else if (view === "courses") {
    const ck = sp.course && byCourse.has(sp.course) ? sp.course : null;
    if (!ck) {
      body = (
        <>
          <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 8px" }}>
            Курс определяется по году набора из названия группы (например, «ИСТ-5-25» — набор 2025) и началу семестра.
          </p>
          <Table head={courseHead}>{sortedCourses.map(([k, items]) => courseRow(k, items))}</Table>
        </>
      );
    } else {
      const items = byCourse.get(ck)!;
      const a = aggregate(items);
      body = (
        <>
          <div style={{ marginBottom: 8 }}>
            <Link href={href({ view: "courses" })} style={link}>
              ← Все курсы
            </Link>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 10px" }}>{courseLabel(items[0].course)}</h2>
          {kpis(a, { groups: true, disciplines: true, teachers: true })}
          <H2>Посещаемость: все виды отметок</H2>
          <Breakdown counts={a.counts} />
          <H2>Распределение итоговых баллов</H2>
          <Bands bands={a.bands} />
          <H2>Группы курса</H2>
          <Table head={groupHead}>
            {[...groupBy(items, (r) => r.groupId).entries()].sort((x, y) => x[1][0].groupName.localeCompare(y[1][0].groupName, "ru")).map(([id, rs]) => groupRow(id, rs))}
          </Table>
          <H2>Дисциплины курса</H2>
          <Table head={disciplineHead}>
            {[...groupBy(items, (r) => r.disciplineId).entries()].sort((x, y) => x[1][0].disciplineName.localeCompare(y[1][0].disciplineName, "ru")).map(([id, rs]) => disciplineRow(id, rs))}
          </Table>
        </>
      );
    }
  } else if (view === "groups") {
    const gid = sp.groupId && byGroup.has(sp.groupId) ? sp.groupId : null;
    if (!gid) {
      body = (
        <>
          <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 8px" }}>Выберите группу, чтобы увидеть аналитику по её предметам и студентам.</p>
          <Table head={groupHead}>{sortedGroups.map(([id, items]) => groupRow(id, items))}</Table>
        </>
      );
    } else {
      const items = byGroup.get(gid)!;
      const a = aggregate(items);
      const perCard = [...groupBy(items, (r) => r.cardId).values()];
      const perStudent = [...groupBy(items, (r) => r.studentId).entries()]
        .map(([id, rs]) => ({ id, name: rs[0].studentName, rs, a: aggregate(rs) }))
        .sort((p, q) => (p.a.attendanceRate ?? 101) - (q.a.attendanceRate ?? 101) || p.name.localeCompare(q.name, "ru"));
      body = (
        <>
          <div style={{ marginBottom: 8 }}>
            <Link href={href({ view: "groups" })} style={link}>
              ← Все группы
            </Link>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 2px" }}>Группа {items[0].groupName}</h2>
          <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>{courseLabel(items[0].course)}</div>
          {kpis(a, { disciplines: true, teachers: true })}
          <H2>Посещаемость: все виды отметок</H2>
          <Breakdown counts={a.counts} />
          <H2>Распределение итоговых баллов</H2>
          <Bands bands={a.bands} />
          <H2>По дисциплинам</H2>
          <Table head={["Дисциплина", "Преподаватель", "Посещаемость", "Ср. итог (мин–макс)", "Риск", ""]} minWidth={640}>
            {perCard.map((rs) => {
              const x = aggregate(rs);
              return (
                <tr key={rs[0].cardId}>
                  <td style={{ ...td, textAlign: "left", fontWeight: 800 }}>{rs[0].disciplineName}</td>
                  <td style={{ ...td, textAlign: "left", fontWeight: 500 }}>{rs[0].teacherName}</td>
                  <RateCell a={x} />
                  <AvgCell a={x} />
                  <RiskCell a={x} />
                  <td style={td}>
                    <Link href={reportHref(rs[0])} style={link}>
                      Итоги
                    </Link>
                  </td>
                </tr>
              );
            })}
          </Table>
          <H2>Студенты (сначала с низкой посещаемостью)</H2>
          <Table
            minWidth={820}
            head={[
              "Студент",
              "Посещаемость",
              "П",
              "О",
              "НБ",
              "Б без подтв.",
              "Б подтв.",
              "А",
              "Ср. итог",
              ...perCard.map((rs) => `${rs[0].disciplineName}`),
            ]}
          >
            {perStudent.map((s) => {
              const c = sumCounts(s.rs);
              return (
                <tr key={s.id}>
                  <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{s.name}</td>
                  <RateCell a={s.a} />
                  <td style={td}>{c.p}</td>
                  <td style={td}>{c.o}</td>
                  <td style={td}>{c.nb}</td>
                  <td style={td}>{c.bPending}</td>
                  <td style={td}>{c.bConfirmed}</td>
                  <td style={td}>{c.a}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{formatPoints(s.a.averageTotal)}</td>
                  {perCard.map((rs) => {
                    const r = s.rs.find((x) => x.cardId === rs[0].cardId);
                    return (
                      <td key={rs[0].cardId} style={td}>
                        {r ? formatPoints(r.total) : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </Table>
        </>
      );
    }
  } else {
    const did = sp.disciplineId && byDiscipline.has(sp.disciplineId) ? sp.disciplineId : null;
    if (!did) {
      body = (
        <>
          <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 8px" }}>Выберите дисциплину, чтобы сравнить группы и преподавателей.</p>
          <Table head={disciplineHead}>{sortedDisciplines.map(([id, items]) => disciplineRow(id, items))}</Table>
        </>
      );
    } else {
      const items = byDiscipline.get(did)!;
      const a = aggregate(items);
      const perGroup = [...groupBy(items, (r) => `${r.cardId}|${r.groupId}`).values()];
      const rate = (r: AnalyticsRow) => ratio(r.counts.p + r.counts.o, r.counts.p + r.counts.o + r.counts.nb + r.counts.bPending);
      const risky = items
        .filter((r) => r.counts.p + r.counts.o + r.counts.nb + r.counts.bPending > 0 && rate(r) < ATTENDANCE_RISK_PERCENT)
        .sort((p, q) => rate(p) - rate(q))
        .slice(0, 20);
      body = (
        <>
          <div style={{ marginBottom: 8 }}>
            <Link href={href({ view: "disciplines" })} style={link}>
              ← Все дисциплины
            </Link>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 10px" }}>{items[0].disciplineName}</h2>
          {kpis(a, { groups: true, teachers: true })}
          <H2>Посещаемость: все виды отметок</H2>
          <Breakdown counts={a.counts} />
          <H2>Распределение итоговых баллов</H2>
          <Bands bands={a.bands} />
          <H2>По группам</H2>
          <Table head={["Группа", "Преподаватель", "Посещаемость", "Ср. итог (мин–макс)", "Риск", ""]} minWidth={640}>
            {perGroup.map((rs) => {
              const x = aggregate(rs);
              return (
                <tr key={`${rs[0].cardId}|${rs[0].groupId}`}>
                  <td style={{ ...td, textAlign: "left", fontWeight: 800 }}>
                    {rs[0].groupName}
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{courseLabel(rs[0].course)}</div>
                  </td>
                  <td style={{ ...td, textAlign: "left", fontWeight: 500 }}>{rs[0].teacherName}</td>
                  <RateCell a={x} />
                  <AvgCell a={x} />
                  <RiskCell a={x} />
                  <td style={td}>
                    <Link href={reportHref(rs[0])} style={link}>
                      Итоги
                    </Link>
                  </td>
                </tr>
              );
            })}
          </Table>
          <H2>Студенты с посещаемостью ниже {ATTENDANCE_RISK_PERCENT}% по этому предмету</H2>
          {risky.length === 0 ? (
            <p style={{ color: "#166534", fontWeight: 700 }}>Таких студентов нет.</p>
          ) : (
            <Table head={["Студент", "Группа", "Посещаемость", "П", "О", "НБ", "Б без подтв.", "Б подтв.", "А", "Итог"]} minWidth={760}>
              {risky.map((r) => (
                <tr key={`${r.cardId}|${r.studentId}`}>
                  <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{r.studentName}</td>
                  <td style={td}>{r.groupName}</td>
                  <td style={{ ...td, color: "#b91c1c", fontWeight: 800 }}>
                    {pct(rate(r))}
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
                      {r.counts.p + r.counts.o} из {r.counts.p + r.counts.o + r.counts.nb + r.counts.bPending}
                    </div>
                  </td>
                  <td style={td}>{r.counts.p}</td>
                  <td style={td}>{r.counts.o}</td>
                  <td style={td}>{r.counts.nb}</td>
                  <td style={td}>{r.counts.bPending}</td>
                  <td style={td}>{r.counts.bConfirmed}</td>
                  <td style={td}>{r.counts.a}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{formatPoints(r.total)}</td>
                </tr>
              ))}
            </Table>
          )}
        </>
      );
    }
  }

  return (
    <main style={{ padding: 16, maxWidth: 1040, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Аналитика направления</h1>
      <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 12px" }}>
        Посещаемость = присутствовавшие (П, О) среди отмеченных, без освобождённых (А, подтверждённая Б). Средний итог считается по каждому студенту и предмету; под ним в таблицах минимум и максимум.
      </p>

      {programs.length > 1 ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[{ id: "", name: "Все направления" }, ...programs].map((p) => {
            const active = (p.id === "" && !selectedProgram) || p.id === selectedProgram?.id;
            const q = new URLSearchParams();
            if (view !== "overview") q.set("view", view);
            if (p.id) q.set("programId", p.id);
            if (semesterId) q.set("semesterId", semesterId);
            return (
              <Link
                key={p.id || "all"}
                href={`/program-head${q.toString() ? `?${q}` : ""}`}
                style={{ padding: "6px 10px", borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: "none", border: "1px solid " + (active ? "#111827" : "#d1d5db"), background: active ? "#111827" : "white", color: active ? "white" : "#374151" }}
              >
                {p.name}
              </Link>
            );
          })}
        </div>
      ) : programs.length === 1 ? (
        <div style={{ fontWeight: 800, marginBottom: 10 }}>{programs[0].name}</div>
      ) : null}

      <div style={{ marginBottom: 10 }}>
        <CuratorSemesterSelector
          allSemesters={semesterOptions}
          currentSemesterId={semesterId ?? undefined}
          hidden={{
            ...(view !== "overview" ? { view } : {}),
            ...(selectedProgram ? { programId: selectedProgram.id } : {}),
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {tab("overview", "Общая")}
        {tab("courses", "По курсам")}
        {tab("groups", "По группам")}
        {tab("disciplines", "По предметам")}
      </div>

      {missing.size > 0 ? (
        <div style={{ border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: 12, padding: "10px 12px", fontSize: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 800 }}>Технологическая карта не заполнена:</div>
          {[...missing.values()].map((m) => (
            <div key={m}>{m}</div>
          ))}
        </div>
      ) : null}

      {body}
    </main>
  );
}
