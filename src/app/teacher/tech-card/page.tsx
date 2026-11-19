import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { BackToolbar, ExitButton } from "@/components/exit-button";
import { ensureTechCard, techCardInclude } from "@/lib/points/tech-card";
import { TechCardEditor } from "./tech-card-editor";

export const dynamic = "force-dynamic";

export default async function TechCardPage(props: {
  searchParams: { cardId?: string; disciplineId?: string; programId?: string; semesterId?: string };
}) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "TEACHER" && actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") redirect("/login");
  const { cardId, disciplineId, programId, semesterId } = props.searchParams;

  let card = null;
  if (cardId) {
    card = await prisma.techCard.findFirst({ where: { id: cardId, isActive: true, deletedAt: null }, include: techCardInclude });
    if (card && actor.role === "TEACHER" && card.teacherId !== actor.id) card = null;
  } else if (disciplineId && programId && semesterId) {
    card = await ensureTechCard({ actor, disciplineId, programId, semesterId });
  }

  if (card) {
    return (
      <main style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
        <BackToolbar style={{ marginBottom: 12 }}>
          <ExitButton to="/teacher/tech-card" preferTo />
        </BackToolbar>
        <TechCardEditor
          cardId={card.id}
          title={card.discipline.name}
          subtitle={`${card.program.name} · ${card.semester.name ?? "семестр"}`}
          readOnly={card.semester.isLocked || (actor.role !== "TEACHER" && actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE")}
          limits={{ modulePoints: card.semester.modulePoints, totalPoints: card.semester.totalPoints, extraMaxPoints: card.semester.extraMaxPoints }}
          initial={{
            latePercent: card.latePercent,
            extraMaxPoints: card.extraMaxPoints,
            modules: [1, 2].map((no) => {
              const m = card!.modules.find((x) => x.moduleNo === no);
              return {
                moduleNo: no,
                lessonsCount: m?.lessonsCount ?? 0,
                attendancePoints: m?.attendancePoints ?? 0,
                selfWorkPoints: m?.selfWorkPoints ?? 0,
                currentControlPoints: m?.currentControlPoints ?? 0,
                borderControlPoints: m?.borderControlPoints ?? 0,
                lessons: (m?.lessons ?? []).map((l) => l.points),
              };
            }),
          }}
        />
      </main>
    );
  }

  // Список карт преподавателя
  const sessions =
    actor.role === "TEACHER"
      ? await prisma.classSession.findMany({
          where: { teacherId: actor.id, semesterId: { not: null }, isActive: true, deletedAt: null, semester: { isLocked: false } },
          select: {
            disciplineId: true,
            semesterId: true,
            discipline: { select: { name: true } },
            semester: { select: { name: true } },
            group: { select: { programId: true, program: { select: { name: true } } } },
          },
        })
      : [];
  const items = new Map<string, { disciplineId: string; programId: string; semesterId: string; title: string; sub: string }>();
  for (const s of sessions) {
    const programId = s.group.programId;
    if (!programId || !s.semesterId) continue;
    const key = `${s.disciplineId}|${programId}|${s.semesterId}`;
    if (!items.has(key)) {
      items.set(key, {
        disciplineId: s.disciplineId,
        programId,
        semesterId: s.semesterId,
        title: s.discipline.name,
        sub: `${s.group.program?.name ?? ""} · ${s.semester?.name ?? "семестр"}`,
      });
    }
  }
  const cards = await prisma.techCard.findMany({
    where: { teacherId: actor.id, isActive: true, deletedAt: null },
    select: { disciplineId: true, programId: true, semesterId: true },
  });
  const have = new Set(cards.map((c) => `${c.disciplineId}|${c.programId}|${c.semesterId}`));

  return (
    <main style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
      <BackToolbar style={{ marginBottom: 12 }}>
        <ExitButton to="/teacher" preferTo />
      </BackToolbar>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Технологические карты</h1>
      <p style={{ color: "#6b7280", marginBottom: 12, fontSize: 14 }}>Выберите дисциплину, чтобы распределить баллы.</p>
      {items.size === 0 ? (
        <p>Для вас не найдено занятий в текущем семестре.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {[...items.entries()].map(([key, it]) => (
            <li key={key}>
              <Link
                href={`/teacher/tech-card?disciplineId=${encodeURIComponent(it.disciplineId)}&programId=${encodeURIComponent(it.programId)}&semesterId=${encodeURIComponent(it.semesterId)}`}
                style={{ display: "block", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "white", textDecoration: "none", color: "inherit" }}
              >
                <div style={{ fontWeight: 800 }}>{it.title}</div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>{it.sub}</div>
                <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: have.has(key) ? "#166534" : "#92400e" }}>
                  {have.has(key) ? "Карта заполнена, открыть" : "Карта не создана, заполнить"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
