"use server";

import { extractText, getDocumentProxy } from "unpdf";

export type ParsedRow = { name: string; qty: number; rate: number };

function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, "")) || 0;
}

export async function parsePdfInvoice(fd: FormData): Promise<{ rows: ParsedRow[]; error: string | null }> {
  const file = fd.get("pdf") as File | null;
  if (!file) return { rows: [], error: "No file uploaded" };

  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });

    // unpdf returns the whole document as one continuous string (no newlines).
    // Isolate the line-items region: after the "Qty Rate Amount" header,
    // and before the "Sub Total" / totals section.
    let region = text;
    const headerMatch = /Qty\s+Rate\s+Amount/i.exec(region);
    if (headerMatch) region = region.slice(headerMatch.index + headerMatch[0].length);
    const endMatch = /Sub\s*Total/i.exec(region);
    if (endMatch) region = region.slice(0, endMatch.index);
    // Drop page-break artifacts like "POWERED BY 2"
    region = region.replace(/POWERED BY\s*\d*/gi, " ");

    // Each row: <rownum> <NAME> <qty> [unit] <rate> <amount>
    //   qty / rate / amount are decimals (e.g. 25.00, 4,000.00)
    //   unit is an optional word between qty and rate (Nos, pac, ltr…)
    //   the NAME may contain digits without decimals (e.g. CAN-2L)
    const rowRe = /(\d{1,3})\s+(.+?)\s+(\d+\.\d{2})\s+(?:([A-Za-z]+)\s+)?([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/g;
    const rows: ParsedRow[] = [];
    let mm: RegExpExecArray | null;
    while ((mm = rowRe.exec(region)) !== null) {
      const name = mm[2].trim();
      const qty = parseNum(mm[3]);
      const rate = parseNum(mm[5]);
      if (name.length > 1 && rate > 0) {
        rows.push({ name, qty: qty || 1, rate });
      }
    }

    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: String(e) };
  }
}
