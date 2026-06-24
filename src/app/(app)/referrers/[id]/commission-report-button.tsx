"use client";

export type ReportRow = {
  customer: string;
  invoice: string;
  date: string | null;
  taxable: number;
  pct: number;
  commission: number;
  isFirst: boolean;
  status: string;
};

const inr = (v: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v);

export function CommissionReportButton({
  referrerName,
  rows,
  generatedOn,
}: {
  referrerName: string;
  rows: ReportRow[];
  generatedOn: string;
}) {
  function printReport() {
    const totalTaxable = rows.reduce((s, r) => s + r.taxable, 0);
    const totalComm = rows.reduce((s, r) => s + r.commission, 0);

    const rowsHtml = rows
      .map(
        (r, i) => `<tr>
          <td class="c">${i + 1}</td>
          <td>${r.customer.replace(/</g, "&lt;")}</td>
          <td>${r.invoice.replace(/</g, "&lt;")}</td>
          <td class="c">${r.date ?? "—"}</td>
          <td class="r">${inr(r.taxable)}</td>
          <td class="c">${r.pct}%${r.isFirst ? ' <span class="b">1st</span>' : ""}</td>
          <td class="r" style="color:#1a7a2e;font-weight:600">${inr(r.commission)}</td>
          <td class="c">${r.status}</td>
        </tr>`
      )
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Commission Report — ${referrerName}</title>
    <style>
      *{box-sizing:border-box;}
      body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#1a1a1a;}
      .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;}
      .head h1{font-size:18px;margin:0 0 4px;}
      .meta{font-size:12px;color:#444;}
      .meta b{color:#1a1a1a;}
      table{width:100%;border-collapse:collapse;font-size:12px;}
      th{background:#b5c76a;color:#1a1a1a;padding:7px 8px;text-align:left;border:1px solid #94a653;font-size:11px;text-transform:uppercase;}
      td{padding:6px 8px;border:1px solid #ddd;}
      tr:nth-child(even) td{background:#fafafa;}
      .c{text-align:center;}
      .r{text-align:right;font-variant-numeric:tabular-nums;}
      .b{background:#fdf6e3;color:#9a7d00;border-radius:8px;padding:0 5px;font-size:9px;}
      tfoot td{font-weight:700;background:#f0f3e6 !important;border-top:2px solid #94a653;}
      .ts{font-size:11px;color:#888;margin-top:10px;}
    </style></head><body>
      <div class="head">
        <div>
          <h1>Referral Commission — ${referrerName}</h1>
          <div class="meta">Commission on pre-GST taxable value</div>
        </div>
        <div class="meta">Xeltrix Chemicals Private Limited<br>${generatedOn}</div>
      </div>
      <table>
        <thead><tr>
          <th>S.No</th><th>Customer</th><th>Invoice</th><th>Date</th>
          <th>Taxable Amt</th><th>Rate</th><th>Commission</th><th>Status</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr>
          <td colspan="4" class="r">TOTAL</td>
          <td class="r">${inr(totalTaxable)}</td>
          <td></td>
          <td class="r">${inr(totalComm)}</td>
          <td></td>
        </tr></tfoot>
      </table>
      <p class="ts">Generated from Xeltrix Team — Referrer Commission</p>
      <script>window.onload = () => { window.print(); }</script>
    </body></html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  return (
    <button
      onClick={printReport}
      className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors"
      style={{ background: "#b5c76a", color: "#1a1a1a" }}
    >
      🖨️ Download PDF
    </button>
  );
}
