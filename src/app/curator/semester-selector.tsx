"use client";

export function CuratorSemesterSelector(props: {
  allSemesters: { id: string; name: string | null; isLocked: boolean }[];
  currentSemesterId?: string;
  dateParam?: string;
  hidden?: Record<string, string>;
  /** Добавляет пункт «Все семестры» (значение all). */
  allowAll?: boolean;
}) {
  return (
    <form style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {props.dateParam ? <input type="hidden" name="date" value={props.dateParam} /> : null}
      {Object.entries(props.hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>Семестр:</span>
      <select
        name="semesterId"
        defaultValue={props.currentSemesterId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        style={{
          appearance: "none",
          border: "1px solid #111827",
          borderRadius: 12,
          padding: "6px 10px",
          fontWeight: 900,
          fontSize: 13,
          color: "#111827",
          background: "white",
          cursor: "pointer",
        }}
      >
        {!props.currentSemesterId && <option value="">Авто (текущий)</option>}
        {props.allowAll ? <option value="all">Все семестры</option> : null}
        {props.allSemesters.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name ?? "Без названия"} {s.isLocked ? "(Архив)" : ""}
          </option>
        ))}
      </select>
    </form>
  );
}
