import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { ExportExcelButton } from "@/components/export-excel-button";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { formatAttendanceStatusDisplay } from "@/lib/ui/labels";

export default async function AdminGroupReportPage(props: { params: { groupId: string } }) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
    return (
      <main className="mx-auto max-w-[1100px] p-6">
        <h1 className="text-2xl font-black">Отчет по группе</h1>
        <p className="mt-3 text-sm text-gray-600">Недостаточно прав.</p>
      </main>
    );
  }

  const groupId = props.params.groupId;

  const group = await prisma.group.findFirst({
    where: { id: groupId, isActive: true, deletedAt: null },
    select: { id: true, name: true, code: true },
  });
  if (!group) {
    return (
      <main className="mx-auto max-w-[1100px] p-6">
        <h1 className="text-2xl font-black">Отчет по группе</h1>
        <p className="mt-3 text-sm text-gray-600">Группа не найдена.</p>
      </main>
    );
  }

  const semester =
    (await prisma.semester.findFirst({
      where: { isLocked: false },
      orderBy: { startDate: "desc" },
      select: { id: true },
    })) ??
    (await prisma.semester.findFirst({
      orderBy: { startDate: "desc" },
      select: { id: true },
    }));

  const sessions =
    semester?.id
      ? await prisma.classSession.findMany({
          where: { groupId, semesterId: semester.id, isActive: true, deletedAt: null, OR: [{ statusV2: { not: "cancelled" } }, { statusV2: null, status: { not: "cancelled" } }] },
          orderBy: { startTime: "asc" },
          take: 20,
          select: { id: true, startTime: true, discipline: { select: { code: true } } },
        })
      : [];

  const students = await prisma.student.findMany({
    where: { groupId, isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const sessionIds = sessions.map((s) => s.id);
  const attendance =
    sessionIds.length === 0 || students.length === 0
      ? []
      : await prisma.attendance.findMany({
          where: { classSessionId: { in: sessionIds }, studentId: { in: students.map((s) => s.id) }, isActive: true, deletedAt: null },
          select: { studentId: true, classSessionId: true, statusV2: true, status: true },
        });

  const cell = new Map<string, string>();
  for (const a of attendance) {
    cell.set(
      `${a.studentId}:${a.classSessionId}`,
      formatAttendanceStatusDisplay({ statusV2: a.statusV2, status: a.status }),
    );
  }

  const abbrevMap: Record<string, string> = {
    MNG: "МЕН",
    DB: "БД",
    ENG: "АНГ",
    DE: "НЕМ",
    MATH: "МАТ",
    PHY: "ФИЗ",
    CHE: "ХИМ",
    BIO: "БИО",
    HIS: "ИСТ",
    GEO: "ГЕО",
    LIT: "ЛИТ",
    PE: "ФИЗРА",
  };

  const translateCode = (code: string | null) => {
    if (!code) return "-";
    return abbrevMap[code.toUpperCase()] || code;
  };

  const excelData = students.map((s) => {
    const row: any = { Студент: s.name };
    for (const session of sessions) {
      const dateStr = new Date(session.startTime).toLocaleDateString("ru-RU").slice(0, 10);
      const codeStr = translateCode(session.discipline?.code ?? null);
      const header = `${dateStr} ${codeStr}`;
      const status = cell.get(`${s.id}:${session.id}`) ?? "";
      row[header] = status;
    }
    return row;
  });

  return (
    <main className="mx-auto max-w-[1100px] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">
            {group.name} <span className="text-sm font-bold text-gray-600">{group.code ?? ""}</span>
          </h1>
          <div className="mt-1 text-sm text-gray-600">Отчет группы (просмотр для учебной части/админа)</div>
        </div>
        <div className="flex items-center gap-3">
          <Link className="font-bold underline" href="/acadepartment">
            ← Поиск
          </Link>
          <ExportExcelButton filename={`group-${groupId}.xlsx`} data={excelData} />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="sticky left-0 bg-white px-3 py-2 font-black">Студент</th>
              {sessions.map((s) => (
                <th key={s.id} className="min-w-[60px] break-all px-3 py-2 text-xs font-bold uppercase">
                  <div className="mb-1">{new Date(s.startTime).toLocaleDateString("ru-RU").slice(0, 10)}</div>
                  <div className="text-[10px] text-gray-500">{translateCode(s.discipline?.code ?? null)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((st) => (
              <tr key={st.id} className="border-b last:border-b-0">
                <td className="sticky left-0 bg-white px-3 py-2 font-bold">{st.name}</td>
                {sessions.map((s) => (
                  <td key={s.id} className="px-3 py-2 font-bold">
                    {cell.get(`${st.id}:${s.id}`) ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

