// How much a referrer earns on one invoice.
//
// Shared deliberately: the referrer page displays these figures and the bulk
// "log & mark paid" action writes them. If the two computed separately they
// could drift, and the button would commit a different number from the one on
// screen. Both import this.

import { itemCategory, type ItemCategory } from "./item-category";

export type ReferrerRates = {
  default_pct: number | null;
  first_invoice_pct: number | null;
  traded_pct: number | null;
  manufactured_pct: number | null;
};

export type CommissionLineItem = { name: string | null; amount: number | null };

export type CommissionBreakdown = {
  category: ItemCategory | "unitemised";
  base: number;
  pct: number;
  amount: number;
};

export type CommissionCalc = {
  /** Effective rate against the invoice's taxable value. Blended when split. */
  pct: number;
  amount: number;
  reason: "first_invoice" | "category_split" | "default";
  breakdown?: CommissionBreakdown[];
};

/**
 * A referrer is paid per item category when they have at least one category
 * rate set. Referrers with only a flat default (Dinesh, Sasi) keep the simple
 * behaviour — this is additive, not a change to how they are paid.
 */
export function isCategoryRated(r: ReferrerRates): boolean {
  return r.traded_pct != null || r.manufactured_pct != null;
}

function rateFor(category: ItemCategory, r: ReferrerRates): number {
  if (category === "traded") return Number(r.traded_pct ?? r.default_pct ?? 0);
  if (category === "manufactured") return Number(r.manufactured_pct ?? r.default_pct ?? 0);
  // Raw material, packing material, services and uncategorised fall back to the
  // flat rate; a referrer is not assumed to earn a product rate on them.
  return Number(r.default_pct ?? 0);
}

export function calcCommission({
  rates,
  base,
  isFirstInvoice,
  items,
}: {
  rates: ReferrerRates;
  /** Invoice value excluding tax. */
  base: number;
  isFirstInvoice: boolean;
  items?: CommissionLineItem[] | null;
}): CommissionCalc {
  // A configured 1st-invoice bonus applies to the whole invoice and overrides
  // category rates — it is a one-off incentive, not a per-product rate.
  if (isFirstInvoice && rates.first_invoice_pct != null) {
    const pct = Number(rates.first_invoice_pct);
    return { pct, amount: (base * pct) / 100, reason: "first_invoice" };
  }

  if (isCategoryRated(rates) && items && items.length > 0) {
    const byCategory = new Map<ItemCategory, number>();
    for (const it of items) {
      const c = itemCategory(it.name);
      byCategory.set(c, (byCategory.get(c) ?? 0) + Number(it.amount ?? 0));
    }

    const breakdown: CommissionBreakdown[] = [];
    let itemised = 0;
    for (const [category, catBase] of byCategory) {
      if (!(catBase > 0)) continue;
      const pct = rateFor(category, rates);
      itemised += catBase;
      breakdown.push({ category, base: catBase, pct, amount: (catBase * pct) / 100 });
    }

    // Any part of the invoice with no matching line item still earns the flat
    // rate, so the parts always add up to the invoice total.
    const residual = base - itemised;
    if (residual > 0.5) {
      const pct = Number(rates.default_pct ?? 0);
      breakdown.push({
        category: "unitemised",
        base: residual,
        pct,
        amount: (residual * pct) / 100,
      });
    }

    const amount = breakdown.reduce((s, b) => s + b.amount, 0);
    return {
      pct: base > 0 ? (amount / base) * 100 : 0,
      amount,
      reason: "category_split",
      breakdown,
    };
  }

  const pct = Number(rates.default_pct ?? 0);
  return { pct, amount: (base * pct) / 100, reason: "default" };
}

/** Group line items by the Zoho invoice id they belong to. */
export function groupItemsByInvoice<T extends { zoho_invoice_id: string }>(
  items: T[] | null | undefined
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items ?? []) {
    const arr = map.get(it.zoho_invoice_id) ?? [];
    arr.push(it);
    map.set(it.zoho_invoice_id, arr);
  }
  return map;
}
