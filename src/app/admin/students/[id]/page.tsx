import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function AdminStudentPage(props: { params: { id: string } }) {
  const actor = await getCurrentUser();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
    return (
      <main className="mx-auto max-w-[900px] p-6">
        <h1 className="text-2xl font-black">Профиль студента</h1>
        <p className="mt-3 text-sm text-gray-600">Недостаточно прав.</p>
      </main>
    );
  }

  const id = props.params.id;

  const student = await prisma.student.findFirst({
    where: { id, isActive: true, deletedAt: null },
    select: { id: true, name: true, gaudiId: true, group: { select: { id: true, name: true, code: true } } },
  });

  if (!student) {
    return (
      <main className="mx-auto max-w-[900px] p-6">
        <h1 className="text-2xl font-black">Профиль студента</h1>
        <p className="mt-3 text-sm text-gray-600">Не найден.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[900px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-black">{student.name}</h1>
        <Link className="font-bold underline" href="/admin/search">
          ← Поиск
        </Link>
      </div>
      <div className="mt-3 rounded-xl border bg-white p-4 text-sm">
        <div>
          <span className="font-black">ID</span>: {student.id}
        </div>
        <div className="mt-1">
          <span className="font-black">GAUDI</span>: {student.gaudiId}
        </div>
        <div className="mt-1">
          <span className="font-black">Группа</span>:{" "}
          <Link className="font-bold underline" href={`/admin/groups/${student.group.id}`}>
            {student.group.code ?? student.group.name}
          </Link>
        </div>
      </div>
    </main>
  );
}

