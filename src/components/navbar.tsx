import Link from "next/link";

import type { CurrentUser } from "@/lib/auth/get-current-user";

export function Navbar(props: { user: CurrentUser }) {
  const { user } = props;
  return (
    <div className="border-b bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-black">
            ЭЖП
          </Link>
          <Link href="/reports" className="text-sm font-bold underline">
            Отчеты
          </Link>
          <Link href="/curator/dashboard" className="text-sm font-bold underline">
            Куратор
          </Link>
          <Link href="/curator/b-requests" className="text-sm font-bold underline">
            B-запросы
          </Link>
          <Link href="/leadership/dashboard" className="text-sm font-bold underline">
            Руководство
          </Link>
          <Link href="/admin/search" className="text-sm font-bold underline">
            Поиск
          </Link>
          <Link href="/admin/semester" className="text-sm font-bold underline">
            Семестр
          </Link>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div className="rounded-lg border px-3 py-2">
            <span className="font-black">{user.role}</span> <span className="text-gray-600">({user.id})</span>
          </div>
          <form action="/login/logout" method="post">
            <button className="rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-sm font-black text-white">
              Выйти
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

