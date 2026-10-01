// Gross profit per invoice: line revenue minus cost of goods.
//
// Cost comes from opportunity_templates.cost_price, matched to an invoice line
// by Zoho item id first and SKU second. Roughly 1% of line revenue has no cost
// price behind it; that part is reported separately as `uncosted` rather than
// being silently treated as zero-cost, which would overstate profit.
//
// NOTE: cost_price is the CURRENT cost of a product, not the cost at the time
// of sale, so margins on older invoices move if a product's cost is updated.
// Snapshotting cost onto the line at sync time would fix that.

export type CostProduct = {
  zoho_item_id: string | null;
  sku: string | null;
  cost_price: number | string | null;
};

export type ProfitLineItem = {
  zoho_invoice_id: string;
  zoho_item_id: string | null;
  sku: string | null;
  quantity: number | string | null;
  amount: number | string | null;
  /** Cost per unit frozen when the line was first mirrored (00037). */
  unit_cost?: number | string | null;
  // Present when the caller needs the line-level breakdown.
  name?: string | null;
  unit?: string | null;
  rate?: number | string | null;
};

export type CostLookup = {
  byItemId: Map<string, number>;
  bySku: Map<string, number>;
};

export function buildCostLookup(products: CostProduct[] | null | undefined): CostLookup {
  const byItemId = new Map<string, number>();
  const bySku = new Map<string, number>();
  for (const p of products ?? []) {
    const cost = Number(p.cost_price ?? NaN);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    if (p.zoho_item_id) byItemId.set(String(p.zoho_item_id), cost);
    if (p.sku) bySku.set(String(p.sku), cost);
  }
  return { byItemId, bySku };
}

/**
 * Cost of one invoice line, or null when no cost is known.
 *
 * Prefers the cost snapshotted onto the line at sync time, so a past invoice's
 * margin does not move when a product's cost price is later edited. Falls back
 * to the product's current cost only for lines mirrored before snapshotting
 * existed, or whose product had no cost price at the time.
 */
export function lineCost(item: ProfitLineItem, lookup: CostLookup): number | null {
  const snapshot = Number(item.unit_cost ?? NaN);
  const unit = Number.isFinite(snapshot) && snapshot > 0
    ? snapshot
    : (item.zoho_item_id ? lookup.byItemId.get(String(item.zoho_item_id)) : undefined) ??
      (item.sku ? lookup.bySku.get(String(item.sku)) : undefined);
  if (unit == null) return null;
  return unit * Number(item.quantity ?? 0);
}

export type InvoiceProfit = {
  revenue: number;
  cost: number;
  /** Revenue on lines with no cost price — excluded from `cost`. */
  uncosted: number;
  profit: number;
  /** Null when there is no revenue to measure against. */
  marginPct: number | null;
  /** Share of revenue that does have a cost price behind it, 0–100. */
  coveragePct: number;
};

export function emptyProfit(): InvoiceProfit {
  return { revenue: 0, cost: 0, uncosted: 0, profit: 0, marginPct: null, coveragePct: 0 };
}

export function profitForLines(
  items: ProfitLineItem[],
  lookup: CostLookup
): InvoiceProfit {
  let revenue = 0;
  let cost = 0;
  let uncosted = 0;

  for (const it of items) {
    const rev = Number(it.amount ?? 0);
    revenue += rev;
    const c = lineCost(it, lookup);
    if (c == null) uncosted += rev;
    else cost += c;
  }

  const profit = revenue - cost;
  return {
    revenue,
    cost,
    uncosted,
    profit,
    marginPct: revenue > 0 ? (profit / revenue) * 100 : null,
    coveragePct: revenue > 0 ? ((revenue - uncosted) / revenue) * 100 : 0,
  };
}

/** Customer name out of an opportunity title like "INV-000478 · ACME LTD". */
export function customerFromTitle(title: string | null | undefined): string | null {
  const part = String(title ?? "").split("·")[1]?.trim();
  return part || null;
}
