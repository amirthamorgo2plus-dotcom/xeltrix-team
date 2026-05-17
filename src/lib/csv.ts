function escape(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = val instanceof Date ? val.toISOString() : String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T & string; header?: string }[]
): string {
  const headerLine = columns.map((c) => escape(c.header ?? c.key)).join(",");
  const lines = rows.map((r) => columns.map((c) => escape(r[c.key])).join(","));
  // Excel/Sheets-friendly: prepend BOM so utf-8 is detected correctly
  return "﻿" + [headerLine, ...lines].join("\r\n");
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}
