import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { visibleProgramIds } from "@/lib/points/access";
import { buildGroupPointsReport, groupsForTechCard } from "@/lib/points/report";
import { formatPoints } from "@/lib/points/calc";

export const dynamic = "force-dynamic";

export default async function ProgramHeadPage() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "PROGRAM_HEAD" && actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") redirect("/login");

  const programIds = await visibleProgramIds(actor);
  const programs = await prisma.program.findMany({
    where: { isActive: true, deletedAt: null, ...(programIds === null ? {} : { id: { in: programIds } }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const blocks = [];
  for (const program of programs) {
    const cards = await prisma.techCard.findMany({
      where: { programId: program.id, isActive: true, deletedAt: null, semester: { isLocked: false } },
      include: { discipline: { select: { name: true } }, teacher: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    const rows: { key: string; href: string; title: string; teacher: string; rate: number | null; avg: number; total: number }[] = [];
    for (const c of cards) {
      for (const g of await groupsForTechCard(c)) {
        const r = await buildGroupPointsReport({ techCardId: c.id, groupId: g.id });
        if (!r) continue;
        rows.push({
          key: `${c.id}|${g.id}`,
          href: `/points-report?cardId=${encodeURIComponent(c.id)}&groupId=${encodeURIComponent(g.id)}`,
          title: `${c.discipline.name} · ${g.name}`,
          teacher: c.teacher.name,
          rate: r.attendanceRate,
          avg: r.averageTotal,
          total: r.limits.totalPoints,
        });
      }
    }
    // занятия есть, а карты нет
    const sessions = await prisma.classSession.findMany({
      where: { isActive: true, deletedAt: null, semesterId: { not: null }, semester: { isLocked: false }, group: { programId: program.id } },
      select: { disciplineId: true, teacherId: true, semesterId: true, discipline: { select: { name: true } }, teacher: { select: { name: true } } },
    });
    const have = new Set(cards.map((c) => `${c.disciplineId}|${c.teacherId}|${c.semesterId}`));
    const missing = new Map<string, string>();
    for (const s of sessions) {
      const k = `${s.disciplineId}|${s.teacherId}|${s.semesterId}`;
      if (!have.has(k)) missing.set(k, `${s.discipline.name} · ${s.teacher.name}`);
    }
    blocks.push({ program, rows, missing: [...missing.values()] });
  }

  return (
    <main style={{ padding: 16, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Руководитель направления</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 12 }}>Посещаемость, баллы и технологические карты преподавателей ваших направлений.</p>
      {blocks.length === 0 ? <p>За вами не закреплено направлений.</p> : null}
      {blocks.map((b) => (
        <section key={b.program.id} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{b.program.name}</h2>
          {b.missing.length > 0 ? (
            <div style={{ border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: 12, padding: "10px 12px", fontSize: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 800 }}>Технологическая карта не заполнена:</div>
              {b.missing.map((m) => <div key={m}>{m}</div>)}
            </div>
          ) : null}
          {b.rows.length === 0 ? <p style={{ color: "#6b7280" }}>Заполненных карт пока нет.</p> : null}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
            {b.rows.map((r) => (
              <li key={r.key}>
                <Link href={r.href} style={{ display: "block", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "white", textDecoration: "none", color: "inherit" }}>
                  <div style={{ fontWeight: 800 }}>{r.title}</div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>{r.teacher}</div>
                  <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 14, fontWeight: 700 }}>
                    <span>Посещаемость: {r.rate === null ? "нет данных" : `${String(r.rate).replace(".", ",")}%`}</span>
                    <span>Средний итог: {formatPoints(r.avg)} из {formatPoints(r.total)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
