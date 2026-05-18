"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitBulkExpenses } from "./actions";

type ParsedRow = {
  date: string;
  description: string;
  amount: number;
  raw: string;
  ok: boolean;
};

function parseDate(s: string): string | null {
  s = s.trim();
  // yyyy-mm-dd  /  yyyy.mm.dd  /  yyyy/mm/dd
  let m = s.match(/^(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // dd-mm-yy  /  dd.mm.yyyy  /  dd/mm/yy
  m = s.match(/^(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    let year = Number(y);
    if (year < 100) year += 2000;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseLine(line: string): ParsedRow {
  const raw = line;
  const trimmed = line.trim();
  if (!trimmed)
    return { date: "", description: "", amount: 0, raw, ok: false };

  // Find amount at end: optional ₹, optional commas, optional decimals
  const amountRe = /(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)\s*$/i;
  const amountMatch = trimmed.match(amountRe);
  if (!amountMatch || amountMatch.index === undefined)
    return { date: "", description: "", amount: 0, raw, ok: false };
  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  const beforeAmount = trimmed.slice(0, amountMatch.index).replace(/[-—:|]\s*$/, "").trim();

  // Find date at start
  const dateRe = /^(\d{1,4}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})\s*[-—:|]?\s*/;
  const dateMatch = beforeAmount.match(dateRe);
  if (!dateMatch)
    return { date: "", description: beforeAmount, amount: amount || 0, raw, ok: false };

  const date = parseDate(dateMatch[1]) ?? "";
  const description = beforeAmount.slice(dateMatch[0].length).trim();

  return {
    date,
    description,
    amount: amount || 0,
    raw,
    ok: !!(date && description && amount > 0),
  };
}

export function BulkSubmissionForm() {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const parsed = useMemo(() => {
    if (!text.trim()) return [] as ParsedRow[];
    return text.split(/\r?\n/).map(parseLine).filter((r) => r.raw.trim());
  }, [text]);

  const validRows = parsed.filter((r) => r.ok);
  const invalidRows = parsed.filter((r) => !r.ok);

  function handleSubmit() {
    if (validRows.length === 0) {
      setMsg({ type: "err", text: "No valid rows to submit." });
      return;
    }
    start(async () => {
      try {
        const res = await submitBulkExpenses(
          validRows.map((r) => ({
            date: r.date,
            description: r.description,
            amount: r.amount,
          }))
        );
        setMsg({ type: "ok", text: `Submitted ${res.inserted} entries.` });
        setText("");
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        setMsg({ type: "err", text: m });
      }
    });
  }

  if (!open) {
    return (
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Bulk add (paste multiple lines)
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk add — paste from notebook / WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-zinc-500">
          One entry per line. Each line should contain: a date · a description · an amount.
          Many formats work — examples:
        </p>
        <pre className="overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
{`29.3.26 Sasi (Welthoil) - 1230
30.3.26 Thiruvarungonam — 1280
30.3.26 Shine 320
30.3.26 Lunch expenses (Team lunch) — 950
4.5.26  Sub-chemical 3304
2026-05-12 Porter 200`}
        </pre>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Paste lines here…"
          className="min-h-[160px] w-full rounded-md border border-zinc-300 bg-transparent p-3 font-mono text-xs dark:border-zinc-700"
        />

        {parsed.length > 0 && (
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
              Preview · <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {validRows.length} valid
              </span>
              {invalidRows.length > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {invalidRows.length} unparseable
                  </span>
                </>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900/40">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-t border-zinc-200 dark:border-zinc-800 ${
                      r.ok ? "" : "bg-amber-50/50 dark:bg-amber-900/10"
                    }`}
                  >
                    <td className="px-3 py-1.5 tabular-nums">{r.date || "—"}</td>
                    <td className="px-3 py-1.5">{r.description || "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.amount ? `₹${r.amount.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      {r.ok ? (
                        <span className="text-emerald-600 dark:text-emerald-400">ok</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          can&apos;t parse
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {msg && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              msg.type === "ok"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSubmit} disabled={pending || validRows.length === 0}>
            {pending
              ? "Submitting…"
              : `Submit ${validRows.length} valid ${validRows.length === 1 ? "entry" : "entries"}`}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setText("");
              setMsg(null);
            }}
            disabled={pending}
          >
            Clear
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Hide
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
