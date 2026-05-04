import Link from "next/link";

import { buildAcadepartmentAttendanceCharts } from "@/lib/academic/build-acadepartment-charts";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";

import { AttendanceDynamicsCharts } from "./attendance-charts";

function qNorm(v: string | undefined) {
  return (v ?? "").trim();
}

export default async function AcadepartmentPage(props: { searchParams: { q?: string } }) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
    return (
      <main className="mx-auto max-w-[1000px] p-6">
        <h1 className="text-2xl font-black">Учебная часть</h1>
        <p className="mt-3 text-sm text-gray-600">Недостаточно прав.</p>
      </main>
    );
  }

  const q = qNorm(props.searchParams.q);

  const charts = await buildAcadepartmentAttendanceCharts();

  const gaudiLastSuccess = await prisma.integrationLog.findFirst({
    where: { provider: "gaudi", status: "success" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const students =
    q.length > 0
      ? await prisma.student.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { gaudiId: { contains: q, mode: "insensitive" } },
              { id: { contains: q } },
            ],
          },
          take: 20,
          orderBy: { name: "asc" },
          select: { id: true, name: true, gaudiId: true, group: { select: { id: true, name: true, code: true } } },
        })
      : [];

  const teachers =
    q.length > 0
      ? await prisma.teacher.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            OR: [{ name: { contains: q, mode: "insensitive" } }, { gaudiId: { contains: q, mode: "insensitive" } }, { id: { contains: q } }],
          },
          take: 20,
          orderBy: { name: "asc" },
          select: { id: true, name: true, gaudiId: true },
        })
      : [];

  const groups =
    q.length > 0
      ? await prisma.group.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { id: { contains: q } }],
          },
          take: 20,
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true },
        })
      : [];

  const studentIds = students.map((s) => s.id);
  const sickAgg =
    studentIds.length === 0
      ? []
      : await prisma.attendance.groupBy({
          by: ["studentId", "statusV2"],
          where: {
            isActive: true,
            deletedAt: null,
            studentId: { in: studentIds },
            statusV2: { in: ["B_PENDING", "B_CONFIRMED"] },
          },
          _count: { _all: true },
        });
  const sickCountByStudent = new Map<string, number>();
  for (const r of sickAgg) {
    sickCountByStudent.set(r.studentId, (sickCountByStudent.get(r.studentId) ?? 0) + r._count._all);
  }

  return (
    <main className="mx-auto max-w-[1100px] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Учебная часть</h1>
          <p className="mt-1 text-sm text-gray-600">
            Семестр: <span className="font-bold">{charts.semesterName ?? "—"}</span>
            {" · "}
            GAUDI:{" "}
            <span className="font-bold">{gaudiLastSuccess ? new Date(gaudiLastSuccess.createdAt).toLocaleString("ru-RU") : "—"}</span>
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-700">
            <span className="font-black">Курс</span> определяется по последним цифрам кода или названия группы (год набора): самый большой такой
            номер среди групп считается <span className="font-black">1 курсом</span>, остальные курсы — насколько год набора меньше максимума (например,
            при максимуме 25 группа с 23 — 3-й курс).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-lg border border-gray-900 bg-white px-4 py-2 text-sm font-black text-gray-900 shadow-sm"
            href="/acadepartment/ratings"
          >
            Рейтинг
          </Link>
          <Link className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-black text-white" href="/admin/semester">
            Семестр →
          </Link>
        </div>
      </div>

      <div className="mt-8">
        {charts.emptyMessage ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            {charts.emptyMessage}
          </p>
        ) : null}
        <AttendanceDynamicsCharts
          weekLabels={charts.weekLabels}
          facultyCourse={charts.facultyCourse}
          byProgram={charts.byProgram}
          emptyHint={null}
        />
      </div>

      <section className="mt-12 border-t border-gray-200 pt-10">
        <h2 className="text-lg font-black text-gray-900">Поиск</h2>
        <form className="mt-4 flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="ФИО / код / ID"
            className="min-w-[260px] flex-1 rounded-lg border border-gray-300 px-3 py-2 font-bold"
          />
          <button type="submit" className="rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-sm font-black text-white">
            Найти
          </button>
        </form>

        {q.length === 0 ? (
          <div className="mt-4 text-sm text-gray-600">Введите запрос: студент / преподаватель / группа.</div>
        ) : (
          <div className="mt-5 grid gap-4">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="font-black">Студенты</div>
              {students.length === 0 ? (
                <div className="mt-2 text-sm text-gray-600">Нет результатов.</div>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {students.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 p-3">
                      <div>
                        <div className="font-black">
                          <Link className="text-blue-800 underline" href={`/admin/students/${s.id}`}>
                            {s.name}
                          </Link>
                          <span className="ml-2 text-xs font-black text-blue-700">
                            Б*: {sickCountByStudent.get(s.id) ?? 0}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {s.gaudiId} •{" "}
                          <Link className="font-bold text-blue-800 underline" href={`/admin/groups/${s.group.id}`}>
                            {s.group.code ?? s.group.name}
                          </Link>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">{s.id}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="font-black">Преподаватели</div>
              {teachers.length === 0 ? (
                <div className="mt-2 text-sm text-gray-600">Нет результатов.</div>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {teachers.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 p-3">
                      <div className="font-black">{t.name}</div>
                      <div className="text-sm text-gray-600">
                        {t.gaudiId ?? "—"} • <span className="text-xs">{t.id}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="font-black">Группы</div>
              {groups.length === 0 ? (
                <div className="mt-2 text-sm text-gray-600">Нет результатов.</div>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {groups.map((g) => (
                    <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 p-3">
                      <div className="font-black">
                        <Link className="text-blue-800 underline" href={`/admin/groups/${g.id}`}>
                          {g.name}
                        </Link>
                      </div>
                      <div className="text-sm text-gray-600">{g.code ?? "—"}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
