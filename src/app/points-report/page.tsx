import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { canViewTechCard, visibleProgramIds } from "@/lib/points/access";
import { buildGroupPointsReport, groupsForTechCard } from "@/lib/points/report";
import { formatPoints } from "@/lib/points/calc";
import { attendanceSheet, pointsSheet, statusShort, summarySheet, STATUS_LEGEND, type CanonStatus, type ModuleTables } from "@/lib/points/module-tables";
import { ExportTableButton } from "@/components/export-table-button";

export const dynamic = "force-dynamic";

const th = { padding: "8px 8px", textAlign: "right" as const, fontSize: 12, color: "#374151", fontWeight: 800, whiteSpace: "nowrap" as const, borderBottom: "1px solid #e5e7eb" };
const td = { padding: "8px 8px", textAlign: "right" as const, fontSize: 14, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" as const };

const stickyName = { position: "sticky" as const, left: 0, background: "white", zIndex: 1 };
const center = { textAlign: "center" as const };
const STATUS_COLORS: Record<CanonStatus, { bg: string; fg: string }> = {
  P: { bg: "#dcfce7", fg: "#166534" },
  O: { bg: "#fef3c7", fg: "#92400e" },
  NB: { bg: "#fee2e2", fg: "#991b1b" },
  B_PENDING: { bg: "#dbeafe", fg: "#1e40af" },
  B_CONFIRMED: { bg: "#bfdbfe", fg: "#1e3a8a" },
  A: { bg: "#e5e7eb", fg: "#374151" },
  S: { bg: "#f3f4f6", fg: "#6b7280" },
};

const pct = (n: number | null) => (n === null ? "—" : `${String(n).replace(".", ",")}%`);
const cellPoints = (n: number | null) => (n === null ? "—" : formatPoints(n));
const fileSafe = (t: string) => t.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");

function Section(props: { title: string; hint?: string; button: ReactNode; children: ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{props.title}</h2>
          {props.hint ? <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>{props.hint}</div> : null}
        </div>
        {props.button}
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12, background: "white" }}>{props.children}</div>
    </section>
  );
}

function ModuleView(props: { m: ModuleTables; groupName: string; disciplineName: string; semesterName: string; teacherName: string }) {
  const { m, groupName, disciplineName } = props;
  const meta = { groupName, disciplineName, teacherName: props.teacherName, semesterName: props.semesterName };
  const base = `Итоги_${fileSafe(groupName)}_${fileSafe(disciplineName)}_Модуль${m.moduleNo}`;
  const lessonsFound = m.lessons.length;
  return (
    <div>
      <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
        Модуль {m.moduleNo}{m.closed ? " · закрыт учебной частью" : ""}. Занятий в карте: {m.lessonsPlanned}, в расписании пока: {lessonsFound}.
        Средний итог за модуль: {formatPoints(m.averageTotal)} из {formatPoints(m.max.total)}. Пропуски группы: {pct(m.groupMissedPercent)}.
      </div>
      {lessonsFound < m.lessonsPlanned ? (
        <div style={{ marginTop: 8, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 10, padding: "8px 10px", fontSize: 13 }}>
          В расписании группы пока меньше занятий, чем задано в карте, поэтому в таблицах {lessonsFound} из {m.lessonsPlanned} занятий.
        </div>
      ) : null}

      <Section
        title="1. Итог модуля"
        hint="Баллы по видам контроля и итог за модуль."
        button={<ExportTableButton filename={`${base}_итог.xlsx`} sheet={summarySheet(m, meta)} />}
      >
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", ...stickyName }}>Студент</th>
              <th style={th}>Посещ.<br /><span style={{ fontWeight: 600 }}>{formatPoints(m.max.attendance)}</span></th>
              <th style={th}>Текущий<br /><span style={{ fontWeight: 600 }}>{formatPoints(m.max.current)}</span></th>
              <th style={th}>СРС<br /><span style={{ fontWeight: 600 }}>{formatPoints(m.max.selfWork)}</span></th>
              <th style={th}>РК<br /><span style={{ fontWeight: 600 }}>{formatPoints(m.max.border)}</span></th>
              <th style={th}>Итого<br /><span style={{ fontWeight: 600 }}>{formatPoints(m.max.total)}</span></th>
            </tr>
          </thead>
          <tbody>
            {m.summary.map((r, i) => (
              <tr key={r.studentId}>
                <td style={{ ...td, textAlign: "left", fontWeight: 700, ...stickyName }}>{i + 1}. {r.name}</td>
                <td style={td}>{formatPoints(r.attendance)}</td>
                <td style={td}>{formatPoints(r.current)}</td>
                <td style={td}>{formatPoints(r.selfWork)}</td>
                <td style={td}>{formatPoints(r.border)}</td>
                <td style={{ ...td, fontWeight: 800 }}>{formatPoints(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section
        title="2. Баллы по занятиям"
        hint="За каждое занятие: баллы за посещение и за текущий контроль, затем СРС, рубежный контроль и итог модуля."
        button={<ExportTableButton filename={`${base}_баллы_по_занятиям.xlsx`} sheet={pointsSheet(m, meta)} />}
      >
        <table style={{ borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", ...stickyName }} rowSpan={2}>Студент</th>
              {m.lessons.map((l) => (
                <th key={l.no} style={{ ...th, ...center, borderLeft: "1px solid #e5e7eb" }} colSpan={2}>
                  Занятие {l.no}<br /><span style={{ fontWeight: 600 }}>{l.date}</span>
                </th>
              ))}
              <th style={{ ...th, borderLeft: "1px solid #e5e7eb" }} rowSpan={2}>Посещ.<br />сумма</th>
              <th style={th} rowSpan={2}>Текущий<br />сумма</th>
              <th style={th} rowSpan={2}>СРС<br /><span style={{ fontWeight: 600 }}>{formatPoints(m.max.selfWork)}</span></th>
              <th style={th} rowSpan={2}>РК<br /><span style={{ fontWeight: 600 }}>{formatPoints(m.max.border)}</span></th>
              <th style={th} rowSpan={2}>Итого<br /><span style={{ fontWeight: 600 }}>{formatPoints(m.max.total)}</span></th>
            </tr>
            <tr>
              {m.lessons.map((l) => (
                <Fragment key={l.no}>
                  <th style={{ ...th, fontWeight: 600, borderLeft: "1px solid #e5e7eb" }}>Пос.<br />{formatPoints(l.attendanceMax)}</th>
                  <th style={{ ...th, fontWeight: 600 }}>Тек.<br />{formatPoints(l.scoreMax)}</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.points.map((r, i) => (
              <tr key={r.studentId}>
                <td style={{ ...td, textAlign: "left", fontWeight: 700, ...stickyName }}>{i + 1}. {r.name}</td>
                {r.cells.map((c, k) => (
                  <Fragment key={k}>
                    <td style={{ ...td, borderLeft: "1px solid #f3f4f6", color: c.attendance === null ? "#9ca3af" : undefined }}>{cellPoints(c.attendance)}</td>
                    <td style={{ ...td, color: c.current === null ? "#9ca3af" : undefined }}>{cellPoints(c.current)}</td>
                  </Fragment>
                ))}
                <td style={{ ...td, borderLeft: "1px solid #f3f4f6" }}>{formatPoints(r.attendanceSum)}</td>
                <td style={td}>{formatPoints(r.currentSum)}</td>
                <td style={td}>{formatPoints(r.selfWork)}</td>
                <td style={td}>{formatPoints(r.border)}</td>
                <td style={{ ...td, fontWeight: 800 }}>{formatPoints(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section
        title="3. Посещаемость по занятиям"
        hint="Отметка каждого студента за каждое занятие, сколько пропущено и процент пропусков."
        button={<ExportTableButton filename={`${base}_посещаемость.xlsx`} sheet={attendanceSheet(m, meta)} />}
      >
        <table style={{ borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", ...stickyName }}>Студент</th>
              {m.lessons.map((l) => (
                <th key={l.no} style={{ ...th, ...center }}>{l.no}<br /><span style={{ fontWeight: 600 }}>{l.date}</span></th>
              ))}
              <th style={{ ...th, borderLeft: "1px solid #e5e7eb" }}>Был</th>
              <th style={th}>Пропущено</th>
              <th style={th}>Освобождён</th>
              <th style={th}>% пропусков</th>
            </tr>
          </thead>
          <tbody>
            {m.attendance.map((r, i) => (
              <tr key={r.studentId}>
                <td style={{ ...td, textAlign: "left", fontWeight: 700, ...stickyName }}>{i + 1}. {r.name}</td>
                {r.cells.map((c, k) => {
                  const col = c ? STATUS_COLORS[c] : null;
                  return (
                    <td key={k} style={{ ...td, ...center, padding: "6px 4px" }}>
                      <span style={{ display: "inline-block", minWidth: 30, borderRadius: 8, padding: "3px 6px", fontWeight: 800, fontSize: 13, background: col?.bg ?? "transparent", color: col?.fg ?? "#9ca3af" }}>{statusShort(c)}</span>
                    </td>
                  );
                })}
                <td style={{ ...td, borderLeft: "1px solid #f3f4f6" }}>{r.present}</td>
                <td style={{ ...td, fontWeight: 800, color: r.missed > 0 ? "#991b1b" : undefined }}>{r.missed}</td>
                <td style={td}>{r.excused}</td>
                <td style={td}>{pct(r.missedPercent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "8px 10px", fontSize: 12, color: "#6b7280", borderTop: "1px solid #f3f4f6" }}>
          {STATUS_LEGEND}. Процент пропусков: пропущено ÷ (был + пропущено); освобождённые занятия не учитываются.
        </div>
      </Section>
    </div>
  );
}

function Tabs(props: { cardId: string; groupId: string; active: "all" | "1" | "2" }) {
  const items: { key: "all" | "1" | "2"; label: string }[] = [
    { key: "all", label: "Итог семестра" },
    { key: "1", label: "Модуль 1" },
    { key: "2", label: "Модуль 2" },
  ];
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 4px" }}>
      {items.map((it) => {
        const on = props.active === it.key;
        const href = `/points-report?cardId=${encodeURIComponent(props.cardId)}&groupId=${encodeURIComponent(props.groupId)}${it.key === "all" ? "" : `&module=${it.key}`}`;
        return (
          <Link
            key={it.key}
            href={href}
            style={{
              textDecoration: "none",
              borderRadius: 999,
              padding: "7px 14px",
              fontSize: 14,
              fontWeight: 800,
              border: "1px solid #111827",
              background: on ? "#111827" : "white",
              color: on ? "white" : "#111827",
            }}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}

export default async function PointsReportPage(props: { searchParams: { cardId?: string; groupId?: string; module?: string } }) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role === "STUDENT" || actor.role === "CURATOR") redirect("/login");
  const back = actor.role === "TEACHER" ? "/teacher" : actor.role === "PROGRAM_HEAD" ? "/program-head" : "/acadepartment";
  const { cardId, groupId } = props.searchParams;
  const view: "all" | "1" | "2" = props.searchParams.module === "1" ? "1" : props.searchParams.module === "2" ? "2" : "all";

  if (cardId && groupId) {
    const card = await prisma.techCard.findFirst({ where: { id: cardId, isActive: true, deletedAt: null }, select: { teacherId: true, programId: true, teacher: { select: { name: true } } } });
    if (!card || !(await canViewTechCard(actor, card))) redirect(back);
    const report = await buildGroupPointsReport({ techCardId: cardId, groupId });
    if (!report) redirect(back);
    const sum2 = (a: [number, number]) => a[0] + a[1];
    return (
      <main style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Итоги группы {report.groupName}</h1>
        <div style={{ fontWeight: 700, marginTop: 2 }}>{report.disciplineName} · {card.teacher.name}</div>
        <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 6 }}>
          {report.semesterName}. Посещаемость группы: {report.attendanceRate === null ? "нет данных" : `${String(report.attendanceRate).replace(".", ",")}%`}. Средний итог: {formatPoints(report.averageTotal)} из {formatPoints(report.limits.totalPoints)}.
          Баллы считаются в момент открытия страницы. Ведомость формирует GAUDI.
        </div>
        {report.sessionsTotal > report.planLessons ? (
          <div style={{ border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: 10, padding: "8px 10px", fontSize: 13, marginBottom: 6 }}>
            В расписании группы занятий: {report.sessionsTotal}, в технологической карте: {report.planLessons}. Занятия сверх карты в баллы не входят и в таблицах модулей не показаны.
          </div>
        ) : null}
        <Tabs cardId={cardId} groupId={groupId} active={view} />
        {view === "all" ? (
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12, background: "white", marginTop: 8 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>Студент</th>
                  <th style={th}>Посещ.<br /><span style={{ fontWeight: 600 }}>{formatPoints(sum2(report.max.attendance))}</span></th>
                  <th style={th}>Текущий<br /><span style={{ fontWeight: 600 }}>{formatPoints(sum2(report.max.current))}</span></th>
                  <th style={th}>СРС<br /><span style={{ fontWeight: 600 }}>{formatPoints(sum2(report.max.selfWork))}</span></th>
                  <th style={th}>РК<br /><span style={{ fontWeight: 600 }}>{formatPoints(sum2(report.max.border))}</span></th>
                  <th style={th}>Модуль 1<br /><span style={{ fontWeight: 600 }}>{formatPoints(report.limits.modulePoints)}{report.moduleClosed[0] ? " · закрыт" : ""}</span></th>
                  <th style={th}>Модуль 2<br /><span style={{ fontWeight: 600 }}>{formatPoints(report.limits.modulePoints)}{report.moduleClosed[1] ? " · закрыт" : ""}</span></th>
                  <th style={th}>Доп.<br /><span style={{ fontWeight: 600 }}>{formatPoints(report.max.extra)}</span></th>
                  <th style={th}>Итого<br /><span style={{ fontWeight: 600 }}>{formatPoints(report.limits.totalPoints)}</span></th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, i) => (
                  <tr key={r.studentId}>
                    <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{i + 1}. {r.name}</td>
                    <td style={td}>{formatPoints(sum2(r.attendance))}</td>
                    <td style={td}>{formatPoints(sum2(r.current))}</td>
                    <td style={td}>{formatPoints(sum2(r.selfWork))}</td>
                    <td style={td}>{formatPoints(sum2(r.border))}</td>
                    <td style={td}>{formatPoints(r.moduleTotals[0])}</td>
                    <td style={td}>{formatPoints(r.moduleTotals[1])}</td>
                    <td style={td}>{formatPoints(r.extra)}</td>
                    <td style={{ ...td, fontWeight: 800 }}>{formatPoints(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ModuleView m={report.modules[view === "1" ? 0 : 1]} groupName={report.groupName} disciplineName={report.disciplineName} semesterName={report.semesterName} teacherName={card.teacher.name} />
        )}
      </main>
    );
  }

  // Список доступных отчётов
  const programs = await visibleProgramIds(actor);
  const cards = await prisma.techCard.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      semester: { isLocked: false },
      ...(actor.role === "TEACHER" ? { teacherId: actor.id } : programs === null ? {} : { programId: { in: programs } }),
    },
    include: { discipline: { select: { name: true } }, program: { select: { name: true } }, teacher: { select: { name: true } } },
    orderBy: [{ createdAt: "asc" }],
  });
  const items: { href: string; title: string; sub: string }[] = [];
  for (const c of cards) {
    for (const g of await groupsForTechCard(c)) {
      items.push({ href: `/points-report?cardId=${encodeURIComponent(c.id)}&groupId=${encodeURIComponent(g.id)}`, title: `${c.discipline.name} · ${g.name}`, sub: `${c.program.name} · ${c.teacher.name}` });
    }
  }
  return (
    <main style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Итоги по группам</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 12 }}>Баллы за посещаемость и оценки, расчёт на момент открытия.</p>
      {items.length === 0 ? <p>Нет данных: сначала заполните технологические карты.</p> : null}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} style={{ display: "block", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "white", textDecoration: "none", color: "inherit" }}>
              <div style={{ fontWeight: 800 }}>{it.title}</div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>{it.sub}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
