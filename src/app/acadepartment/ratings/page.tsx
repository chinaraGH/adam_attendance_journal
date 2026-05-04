import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";

const LOW_THRESHOLD = 70;
const LIST_LIMIT = 10;

type RankRow = { id: string; name: string; code: string | null; pct: number; marks: number };

function pct(numer: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.round((numer / denom) * 1000) / 10;
}

export default async function AcadepartmentRatingsPage() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
    return (
      <main className="mx-auto max-w-[1100px] p-6">
        <h1 className="text-2xl font-black">Рейтинги</h1>
        <p className="mt-3 text-sm text-gray-600">Недостаточно прав.</p>
      </main>
    );
  }

  const groups = await prisma.group.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  const groupIds = groups.map((g) => g.id);

  const sessions = await prisma.classSession.findMany({
    where: { groupId: { in: groupIds }, isActive: true, deletedAt: null },
    select: { id: true, groupId: true, disciplineId: true, discipline: { select: { name: true, code: true } } },
  });
  const sessionToGroup = new Map(sessions.map((s) => [s.id, s.groupId]));
  const sessionToDiscipline = new Map(
    sessions.map((s) => [s.id, { id: s.disciplineId, name: s.discipline?.name ?? s.disciplineId, code: s.discipline?.code }]),
  );

  const sessionIds = sessions.map((s) => s.id);

  const totalBySession =
    sessionIds.length === 0
      ? []
      : await prisma.attendance.groupBy({
          by: ["classSessionId"],
          where: {
            isActive: true,
            deletedAt: null,
            statusV2: { not: null },
            classSessionId: { in: sessionIds },
          },
          _count: { _all: true },
        });

  const attendedBySession =
    sessionIds.length === 0
      ? []
      : await prisma.attendance.groupBy({
          by: ["classSessionId"],
          where: {
            isActive: true,
            deletedAt: null,
            statusV2: { in: ["P", "O"] },
            classSessionId: { in: sessionIds },
          },
          _count: { _all: true },
        });

  const denomByGroup = new Map<string, number>();
  const numerByGroup = new Map<string, number>();
  for (const r of totalBySession) {
    const gid = sessionToGroup.get(r.classSessionId);
    if (!gid) continue;
    denomByGroup.set(gid, (denomByGroup.get(gid) ?? 0) + r._count._all);
  }
  for (const r of attendedBySession) {
    const gid = sessionToGroup.get(r.classSessionId);
    if (!gid) continue;
    numerByGroup.set(gid, (numerByGroup.get(gid) ?? 0) + r._count._all);
  }

  const groupRows: RankRow[] = groups
    .map((g) => {
      const denom = denomByGroup.get(g.id) ?? 0;
      const numer = numerByGroup.get(g.id) ?? 0;
      return {
        id: g.id,
        name: g.name,
        code: g.code,
        pct: pct(numer, denom),
        marks: denom,
      };
    })
    .filter((r) => r.marks > 0);

  const topGroups = [...groupRows].sort((a, b) => b.pct - a.pct).slice(0, LIST_LIMIT);
  const problemGroups = [...groupRows]
    .filter((r) => r.pct < LOW_THRESHOLD)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, LIST_LIMIT);

  const denomByDiscipline = new Map<string, number>();
  const numerByDiscipline = new Map<string, number>();
  const discName = new Map<string, string>();

  for (const r of totalBySession) {
    const d = sessionToDiscipline.get(r.classSessionId);
    if (!d) continue;
    denomByDiscipline.set(d.id, (denomByDiscipline.get(d.id) ?? 0) + r._count._all);
    discName.set(d.id, d.name);
  }
  for (const r of attendedBySession) {
    const d = sessionToDiscipline.get(r.classSessionId);
    if (!d) continue;
    numerByDiscipline.set(d.id, (numerByDiscipline.get(d.id) ?? 0) + r._count._all);
  }

  const discRows = [...denomByDiscipline.keys()]
    .map((id) => {
      const denom = denomByDiscipline.get(id) ?? 0;
      const numer = numerByDiscipline.get(id) ?? 0;
      return { id, label: discName.get(id) ?? id, pct: pct(numer, denom), marks: denom };
    })
    .filter((r) => r.marks > 0);

  const topDisciplines = [...discRows].sort((a, b) => b.pct - a.pct).slice(0, LIST_LIMIT);
  const problemDisciplines = [...discRows]
    .filter((r) => r.pct < LOW_THRESHOLD)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, LIST_LIMIT);

  return (
    <main className="mx-auto max-w-[1100px] p-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Рейтинги</h1>
        <p className="mt-1 text-sm text-gray-600">
          Топ и «проблемные» группы и дисциплины по доле отметок П+О (ниже {LOW_THRESHOLD}% — проблемная зона).
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">Самые посещаемые группы</h2>
          <Ul rows={topGroups} href={(id) => `/admin/groups/${id}`} />
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">Наименее посещаемые группы</h2>
          <Ul rows={problemGroups} href={(id) => `/admin/groups/${id}`} empty="Нет групп ниже порога или нет данных." />
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">Самые «посещаемые» дисциплины (по доле П+О)</h2>
          <DiscTable rows={topDisciplines} />
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">Наиболее проблемные дисциплины</h2>
          <DiscTable rows={problemDisciplines} empty="Нет дисциплин ниже порога или нет данных." />
        </section>
      </div>
    </main>
  );
}

function formatPctLine(pct: number, marks: number) {
  return `${pct} % (${marks})`;
}

function Ul(props: { rows: RankRow[]; href: (id: string) => string; empty?: string }) {
  if (props.rows.length === 0) {
    return <p className="mt-3 text-sm text-gray-600">{props.empty ?? "Нет данных."}</p>;
  }
  return (
    <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm marker:font-black marker:text-gray-500">
      {props.rows.map((r) => (
        <li key={r.id} className="rounded-lg border border-gray-100 py-2 pl-1 pr-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Link className="min-w-0 flex-1 font-black text-blue-800 underline" href={props.href(r.id)}>
              {r.name}
            </Link>
            <span className="shrink-0 font-black tabular-nums">{formatPctLine(r.pct, r.marks)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function DiscTable(props: {
  rows: { id: string; label: string; pct: number; marks: number }[];
  empty?: string;
}) {
  if (props.rows.length === 0) {
    return <p className="mt-3 text-sm text-gray-600">{props.empty ?? "Нет данных."}</p>;
  }
  return (
    <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm marker:font-black marker:text-gray-500">
      {props.rows.map((r) => (
        <li key={r.id} className="rounded-lg border border-gray-100 py-2 pl-1 pr-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 flex-1 font-black">{r.label}</span>
            <span className="shrink-0 font-black tabular-nums">{formatPctLine(r.pct, r.marks)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
