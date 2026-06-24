"use server";

import { extractText } from "unpdf";

export type ParsedRow = { name: string; qty: number; rate: number };

function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, "")) || 0;
}

export async function parsePdfInvoice(fd: FormData): Promise<{ rows: ParsedRow[]; error: string | null }> {
  const file = fd.get("pdf") as File | null;
  if (!file) return { rows: [], error: "No file uploaded" };

  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const { text } = await extractText(buf, { mergePages: true });

    const rows: ParsedRow[] = [];
    const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);

    // Pattern: line starting with a row number, ending with 3+ decimal numbers
    // e.g. "1 SYNTHETIC BROOM 25.00 160.00 4,000.00"
    // Accumulate multi-line item names
    let pending: { name: string; nums: number[] } | null = null;

    for (const line of lines) {
      // Try to detect a new numbered row: starts with digits followed by non-digit
      const rowStart = /^(\d{1,3})\s+(.+)$/.exec(line);
      // Extract all numbers from end of the line
      const numMatches = [...line.matchAll(/([\d,]+\.?\d{0,2})/g)];
      const nums = numMatches.map((m) => parseNum(m[1]));

      if (rowStart) {
        // Save previous pending row first
        if (pending && pending.nums.length >= 2) {
          const n = pending.nums;
          // Last = amount, second-to-last = rate, third-to-last = qty
          const rate = n[n.length - 2];
          const qty = n[n.length - 3] ?? 1;
          if (rate > 0) rows.push({ name: pending.name.trim(), qty, rate });
        }
        // Start new row
        const firstNum = nums[0];
        const rowNum = parseInt(rowStart[1]);
        // Only treat as table row if first number is the row number
        if (firstNum === rowNum || isNaN(firstNum)) {
          const restText = rowStart[2];
          pending = { name: restText.replace(/([\d,]+\.?\d*\s*)+$/, "").trim(), nums };
        } else {
          pending = null;
        }
      } else if (pending && nums.length > 0) {
        // Continuation line — accumulate numbers
        pending.nums.push(...nums);
        // If line has only numbers it's probably the rest of the row
        if (/^[\d\s,\.]+$/.test(line)) {
          // numbers-only continuation, skip adding to name
        } else {
          pending.name += " " + line.replace(/([\d,]+\.?\d*\s*)+$/, "").trim();
        }
      }
    }

    // Flush last pending row
    if (pending && pending.nums.length >= 2) {
      const n = pending.nums;
      const rate = n[n.length - 2];
      const qty = n[n.length - 3] ?? 1;
      if (rate > 0) rows.push({ name: pending.name.trim(), qty, rate });
    }

    // Filter out header-like rows and rows with no name
    const filtered = rows.filter(
      (r) => r.name.length > 1 && r.rate > 0 && !r.name.toUpperCase().includes("S.NO") && !r.name.toUpperCase().includes("ITEM &")
    );

    return { rows: filtered, error: null };
  } catch (e) {
    return { rows: [], error: String(e) };
  }
}
