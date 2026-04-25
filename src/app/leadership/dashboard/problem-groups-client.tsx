"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportCsvButton } from "@/components/export-csv-button";

type GroupRow = { groupId: string; name: string; code: string | null; attendancePct: number; totalMarks: number };
type ApiResponse =
  | { ok: true; threshold: number; problemGroups: GroupRow[]; topGroups: GroupRow[] }
  | { ok: false; error: string };

export function ProblemGroupsClient() {
  const [data, setData] = React.useState<ApiResponse | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/problem-groups", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json as ApiResponse);
      })
      .catch((e) => {
        if (!cancelled) setData({ ok: false, error: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const problem = data && data.ok ? data.problemGroups : [];
  const top = data && data.ok ? data.topGroups : [];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Руководство</h1>
          <div className="mt-1 text-sm text-gray-600">Проблемные группы: посещаемость ниже 70%</div>
        </div>
        <ExportCsvButton
          filename="leadership-dashboard.csv"
          rows={[
            ...problem.map((g) => ({ type: "problem", ...g })),
            ...top.map((g) => ({ type: "top5", ...g })),
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Проблемные группы</CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <div className="text-sm text-gray-600">Загрузка...</div>
          ) : !data.ok ? (
            <div className="text-sm font-bold text-red-700">{data.error}</div>
          ) : problem.length === 0 ? (
            <div className="text-sm text-gray-600">Нет проблемных групп.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {problem.map((g) => (
                <div key={g.groupId} className="rounded-xl border p-4">
                  <div className="font-black">{g.name}</div>
                  <div className="mt-1 text-sm text-gray-600">
                    {g.code ?? "—"} • {g.attendancePct}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ТОП-5 групп по посещаемости</CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <div className="text-sm text-gray-600">Загрузка...</div>
          ) : !data.ok ? (
            <div className="text-sm font-bold text-red-700">{data.error}</div>
          ) : top.length === 0 ? (
            <div className="text-sm text-gray-600">Нет данных.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Группа</TableHead>
                    <TableHead>% посещаемости</TableHead>
                    <TableHead>Отметок</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top.map((g, idx) => (
                    <TableRow key={g.groupId}>
                      <TableCell className="font-black">{idx + 1}</TableCell>
                      <TableCell className="font-black">{g.name}</TableCell>
                      <TableCell className="font-black">{g.attendancePct}%</TableCell>
                      <TableCell>{g.totalMarks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

