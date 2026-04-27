import { decideSickRequestForm, getPendingSickAttendances } from "@/app/curator/dashboard/actions";

export default async function CuratorBRequestsPage() {
  const result = await getPendingSickAttendances();

  return (
    <main className="mx-auto max-w-[1000px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Запросы по болезни (B_PENDING)</h1>
          <div className="mt-1 text-sm text-gray-600">Подтверждение/отклонение справок кураторами.</div>
        </div>
      </div>

      {!result.ok ? (
        <div className="mt-4 rounded-xl border bg-white p-4 text-sm font-bold text-red-700">{result.error}</div>
      ) : result.items.length === 0 ? (
        <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-gray-600">Нет активных запросов.</div>
      ) : (
        <ul className="mt-4 grid gap-3">
          {result.items.map((item) => (
            <li key={item.id} className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-black">{item.student.name}</div>
                  <div className="mt-1 text-sm text-gray-600">
                    Группа: {item.student.group.name} • Занятие: {item.classSession.disciplineId} •{" "}
                    {new Date(item.classSession.startTime).toLocaleString("ru-RU")}
                  </div>
                </div>
                <div className="text-sm font-black">Статус: {item.statusV2}</div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <form action={decideSickRequestForm}>
                  <input type="hidden" name="attendanceId" value={item.id} />
                  <input type="hidden" name="decision" value="confirm" />
                  <button
                    type="submit"
                    disabled={!!item.classSession.semester?.isLocked}
                    className="rounded-lg border border-green-600 bg-green-600 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    Подтвердить (B_CONFIRMED)
                  </button>
                </form>

                <form action={decideSickRequestForm}>
                  <input type="hidden" name="attendanceId" value={item.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <button
                    type="submit"
                    disabled={!!item.classSession.semester?.isLocked}
                    className="rounded-lg border border-red-600 bg-red-600 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    Отклонить (NB)
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

