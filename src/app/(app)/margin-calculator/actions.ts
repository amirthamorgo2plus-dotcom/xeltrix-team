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

    // unpdf returns the whole document as one continuous string (no newlines),
    // and pdf.js often emits blocks out of visual order — e.g. Zoho quotes put
    // the totals block BEFORE the line-items block. So anchor the items region
    // on the column header (which ends in "Amount") rather than assuming the
    // totals come last, and only trim at a totals marker if one actually
    // appears AFTER the header.
    let region = text;
    // Zoho column header: "S.No Item & Description HSN/SAC Qty Rate [CGST SGST] Amount".
    // Fall back to a plain "Qty Rate Amount" header if "Item & Description" is absent.
    const header =
      /Item\s*&\s*Description[\s\S]*?Amount/i.exec(region) ??
      /Qty\s+Rate[\s\S]*?Amount/i.exec(region);
    if (header) region = region.slice(header.index + header[0].length);
    const endMatch = /Sub\s*Total|Total\s+In\s+Words|Authorized\s+Signature/i.exec(region);
    if (endMatch) region = region.slice(0, endMatch.index);
    // Drop page-break artifacts like "POWERED BY 2"
    region = region.replace(/POWERED BY\s*\d*/gi, " ");

    // Each row: <rownum> <NAME> [<HSN/SAC>] <qty> [unit] <rate> [<CGST%> <SGST%>] <amount>
    //   - HSN/SAC is an optional 4-8 digit code (present on GST quotes)
    //   - qty may be "1" or "1.00"; unit is an optional word (Nos, pac, ltr…)
    //   - rate/amount are money (e.g. 3,250.00); CGST%/SGST% (e.g. "9% 9%")
    //     sit between rate and amount on GST quotes and are skipped
    //   - the NAME may contain digits (e.g. R-DUST BIN 120L, CAN-2L)
    const rowRe =
      /(\d{1,3})\s+(.+?)\s+(?:\d{4,8}\s+)?(\d+(?:\.\d{1,2})?)\s+(?:([A-Za-z]+)\s+)?([\d,]+\.\d{2})\s+(?:\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%\s+)?([\d,]+\.\d{2})/g;
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
