import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { canViewTechCard, visibleProgramIds } from "@/lib/points/access";
import { buildGroupPointsReport, groupsForTechCard } from "@/lib/points/report";
import { formatPoints } from "@/lib/points/calc";

export const dynamic = "force-dynamic";

const th = { padding: "8px 8px", textAlign: "right" as const, fontSize: 12, color: "#374151", fontWeight: 800, whiteSpace: "nowrap" as const, borderBottom: "1px solid #e5e7eb" };
const td = { padding: "8px 8px", textAlign: "right" as const, fontSize: 14, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" as const };

export default async function PointsReportPage(props: { searchParams: { cardId?: string; groupId?: string } }) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role === "STUDENT" || actor.role === "CURATOR") redirect("/login");
  const back = actor.role === "TEACHER" ? "/teacher" : actor.role === "PROGRAM_HEAD" ? "/program-head" : "/acadepartment";
  const { cardId, groupId } = props.searchParams;

  if (cardId && groupId) {
    const card = await prisma.techCard.findFirst({ where: { id: cardId, isActive: true, deletedAt: null }, select: { teacherId: true, programId: true, teacher: { select: { name: true } } } });
    if (!card || !(await canViewTechCard(actor, card))) redirect(back);
    const report = await buildGroupPointsReport({ techCardId: cardId, groupId });
    if (!report) redirect(back);
    const sum2 = (a: [number, number]) => a[0] + a[1];
    return (
      <main style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Итоги группы {report.groupName}</h1>
        <div style={{ fontWeight: 700, marginTop: 2 }}>{report.disciplineName} · {card.teacher.name}</div>
        <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
          {report.semesterName}. Посещаемость группы: {report.attendanceRate === null ? "нет данных" : `${String(report.attendanceRate).replace(".", ",")}%`}. Средний итог: {formatPoints(report.averageTotal)} из {formatPoints(report.limits.totalPoints)}.
          Баллы считаются в момент открытия страницы. Ведомость формирует GAUDI.
        </div>
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12, background: "white" }}>
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
