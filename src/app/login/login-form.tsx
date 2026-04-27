"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";

import { formatRoleLabel } from "@/lib/ui/labels";

import { loginWithPassword } from "./actions";

type UserRow = { id: string; role: string };
type State = { ok: true } | { ok: false; error: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="mt-2 rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500"
    >
      {pending ? "Входим..." : "Войти"}
    </button>
  );
}

export function LoginForm(props: { users: UserRow[]; dbUnavailable?: boolean }) {
  const [state, formAction] = useFormState<State, FormData>(loginWithPassword as any, { ok: false, error: "" });
  const loginRef = React.useRef<HTMLInputElement | null>(null);

  const usersByRole = React.useMemo(() => {
    const m = new Map<string, UserRow[]>();
    for (const u of props.users) {
      const r = String(u.role);
      m.set(r, [...(m.get(r) ?? []), u]);
    }
    for (const [k, v] of m) {
      v.sort((a, b) => a.id.localeCompare(b.id));
      m.set(k, v);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [props.users]);

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-3 rounded-xl border bg-white p-4">
        <label className="grid gap-2 text-sm font-bold">
          Логин
          <input
            ref={loginRef}
            name="login"
            autoComplete="username"
            placeholder="Например: ADMIN_TEST"
            className="rounded-lg border px-3 py-2 font-bold"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold">
          Пароль
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Введите пароль"
            className="rounded-lg border px-3 py-2 font-bold"
          />
        </label>

        {state.ok === false && state.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            Неверный логин или пароль
          </div>
        ) : null}

        <SubmitButton />
      </form>

      <details className="rounded-xl border bg-white p-4" open={props.dbUnavailable && props.users.length === 0}>
        <summary className="cursor-pointer text-sm font-black">Тестовые логины (по ролям)</summary>
        <div className="mt-2 text-xs text-gray-600">
          Нажмите на логин, чтобы подставить его в поле «Логин». Пароль — одинаковый для всех тестовых аккаунтов.
        </div>
        {props.dbUnavailable && props.users.length === 0 ? (
          <div className="mt-2 text-xs font-bold text-amber-800">
            Список не загружен: без базы нельзя подсмотреть тестовые id, но вручную можно ввести логин из seed (например
            TEACHER_TEST) после проверки DATABASE_URL.
          </div>
        ) : null}

        <div className="mt-3 grid gap-3">
          {usersByRole.map(([role, items]) => (
            <div key={role} className="rounded-lg border p-3">
              <div className="text-sm font-black">{formatRoleLabel(role)}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {items.slice(0, 8).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="rounded-lg border bg-white px-2 py-1 text-xs font-black hover:bg-gray-50"
                    onClick={() => {
                      if (loginRef.current) {
                        loginRef.current.value = u.id;
                        loginRef.current.focus();
                      }
                    }}
                  >
                    {u.id}
                  </button>
                ))}
                {items.length > 8 ? <span className="text-xs text-gray-600">и ещё {items.length - 8}…</span> : null}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

