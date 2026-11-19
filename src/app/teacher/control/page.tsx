import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { BackToolbar, ExitButton } from "@/components/exit-button";
import { groupsForTechCard } from "@/lib/points/report";
import { ControlClient } from "./control-client";

export const dynamic = "force-dynamic";

export default async function ControlPage(props: { searchParams: { cardId?: string; groupId?: string; cat?: string } }) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "TEACHER") redirect("/login");

  const cards = await prisma.techCard.findMany({
    where: { teacherId: actor.id, isActive: true, deletedAt: null, semester: { isLocked: false } },
    include: { discipline: { select: { name: true } }, program: { select: { name: true } }, semester: true, modules: true },
    orderBy: [{ createdAt: "asc" }],
  });

  const options = [];
  for (const c of cards) {
    const groups = await groupsForTechCard(c);
    if (groups.length === 0) continue;
    options.push({
      cardId: c.id,
      label: `${c.discipline.name} · ${c.program.name}`,
      groups,
      categories: [
        ...[1, 2].flatMap((no) => {
          const m = c.modules.find((x) => x.moduleNo === no);
          const closed = Boolean(no === 1 ? c.semester.module1ClosedAt : c.semester.module2ClosedAt);
          return [
            { key: `SELF_WORK:${no}`, label: `Модуль ${no} · Самостоятельная работа`, max: m?.selfWorkPoints ?? 0, closed },
            { key: `BORDER_CONTROL:${no}`, label: `Модуль ${no} · Рубежный контроль`, max: m?.borderControlPoints ?? 0, closed },
          ];
        }),
        { key: "EXTRA:0", label: "Дополнительные баллы", max: Math.min(c.extraMaxPoints, c.semester.extraMaxPoints), closed: false },
      ],
    });
  }

  const header = (
    <BackToolbar style={{ marginBottom: 12 }}>
      <ExitButton to="/teacher" preferTo />
    </BackToolbar>
  );

  if (options.length === 0) {
    return (
      <main style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
        {header}
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Контрольные точки</h1>
        <p>Сначала заполните технологическую карту (раздел «Технологические карты»).</p>
      </main>
    );
  }

  const opt = options.find((o) => o.cardId === props.searchParams.cardId) ?? options[0];
  const group = opt.groups.find((g) => g.id === props.searchParams.groupId) ?? opt.groups[0];
  const cat = opt.categories.find((c) => c.key === props.searchParams.cat) ?? opt.categories[0];
  const [category, moduleNoRaw] = cat.key.split(":");

  const students = await prisma.student.findMany({
    where: { groupId: group.id, isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const scores = await prisma.controlScore.findMany({
    where: { techCardId: opt.cardId, category: category as "SELF_WORK" | "BORDER_CONTROL" | "EXTRA", moduleNo: Number(moduleNoRaw), studentId: { in: students.map((s) => s.id) } },
    select: { studentId: true, score: true },
  });
  const initial: Record<string, number> = {};
  for (const s of scores) initial[s.studentId] = s.score;

  return (
    <main style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
      {header}
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Контрольные точки</h1>
      <ControlClient
        key={`${opt.cardId}|${group.id}|${cat.key}`}
        options={options}
        selected={{ cardId: opt.cardId, groupId: group.id, cat: cat.key }}
        category={category as "SELF_WORK" | "BORDER_CONTROL" | "EXTRA"}
        moduleNo={Number(moduleNoRaw)}
        max={cat.max}
        closed={cat.closed}
        students={students}
        initial={initial}
      />
    </main>
  );
}
