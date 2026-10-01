// Group customers for commercial action: who to reward, who to renegotiate,
// who to grow, who to leave alone, who to fix.
//
// Margin alone is the wrong basis. Xeltrix Chemicals has 40 customers above 35%
// margin contributing 17% of profit, while 15 customers at 15-25% contribute
// two thirds — reward by margin and you reward the wrong people. So a customer
// is placed on TWO axes: how much profit they contribute, and whether their
// margin beats the book's own average.
//
// Both thresholds come from the data rather than being picked:
//   - margin benchmark = the whole book's gross margin
//   - "major" = inside the cumulative top 80% of profit (a Pareto split)
// so the tiers re-centre themselves as the business changes.

export type TierKey =
  | "champion"
  | "big_thin"
  | "premium_small"
  | "low_value"
  | "losing"
  | "unknown";

/**
 * A customer needs this much of their revenue backed by real cost prices before
 * their margin means anything. Without it a missing cost reads as 100% margin —
 * which would put an unmeasured customer in the "reward them" tier.
 */
export const MIN_COST_COVERAGE_PCT = 80;

export type TierMeta = {
  label: string;
  action: string;
  /** Validated against the dark chart surface — see dataviz palette checks. */
  color: string;
  blurb: string;
};

export const TIER_ORDER: TierKey[] = [
  "champion",
  "big_thin",
  "premium_small",
  "low_value",
  "losing",
  "unknown",
];

export const TIER_META: Record<TierKey, TierMeta> = {
  champion: {
    label: "Champions",
    action: "Protect and reward",
    color: "#199e70",
    blurb: "Big contributors earning above your average margin. These are the ones worth a gift.",
  },
  big_thin: {
    label: "Big but thin",
    action: "Renegotiate price",
    color: "#3987e5",
    blurb: "Large contributors earning below your average margin. A point of margin here is worth more than a whole small account.",
  },
  premium_small: {
    label: "Premium small",
    action: "Grow volume",
    color: "#3987e5",
    blurb: "Healthy margin but little volume. Worth selling more to, not worth discounting.",
  },
  low_value: {
    label: "Low value",
    action: "Serve cheaply",
    color: "#3987e5",
    blurb: "Small and below average margin. Keep the cost of serving them down.",
  },
  losing: {
    label: "Losing money",
    action: "Fix or exit",
    color: "#e66767",
    blurb: "Selling below cost. Re-price or stop — every order makes it worse.",
  },
  unknown: {
    label: "Not measurable",
    action: "Add cost prices",
    color: "#71717a",
    blurb:
      "Too little of what they bought has a cost price, so their margin cannot be trusted — a missing cost reads as pure profit. Not ranked until the products are costed.",
  },
};

export type TierInput = {
  customer: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number | null;
  /** Share of this customer's revenue that has a cost price behind it, 0-100. */
  coveragePct: number;
};

export type TieredCustomer = TierInput & { tier: TierKey };

export type TierResult = {
  customers: TieredCustomer[];
  /** The book's own gross margin — the line between "healthy" and "thin". */
  benchmarkPct: number;
  /** Smallest profit still inside the top 80%; the line between major and minor. */
  majorCutoff: number;
};

export function assignTiers(input: TierInput[]): TierResult {
  // Customers whose costs are largely unknown are excluded from the benchmark
  // too — their inflated margins would drag the "healthy" line upward.
  const measurable = input.filter((c) => c.coveragePct >= MIN_COST_COVERAGE_PCT);
  const totalRevenue = measurable.reduce((s, c) => s + c.revenue, 0);
  const netProfit = measurable.reduce((s, c) => s + c.profit, 0);
  const benchmarkPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Pareto split over the customers that actually make money.
  const earners = measurable.filter((c) => c.profit > 0).sort((a, b) => b.profit - a.profit);
  const earnedTotal = earners.reduce((s, c) => s + c.profit, 0);
  const major = new Set<string>();
  let cumulative = 0;
  let majorCutoff = 0;
  for (const c of earners) {
    major.add(c.customer);
    majorCutoff = c.profit;
    cumulative += c.profit;
    if (cumulative >= earnedTotal * 0.8) break;
  }

  const customers = input.map((c) => {
    let tier: TierKey;
    if (c.coveragePct < MIN_COST_COVERAGE_PCT) tier = "unknown";
    else if (c.profit < 0) tier = "losing";
    else if (major.has(c.customer))
      tier = (c.marginPct ?? 0) >= benchmarkPct ? "champion" : "big_thin";
    else tier = (c.marginPct ?? 0) >= benchmarkPct ? "premium_small" : "low_value";
    return { ...c, tier };
  });

  return { customers, benchmarkPct, majorCutoff };
}

export type TierSummary = {
  tier: TierKey;
  customers: number;
  revenue: number;
  profit: number;
  /** Share of net profit, as a percentage. Can be negative for the losing tier. */
  profitSharePct: number | null;
};

export function summariseTiers(customers: TieredCustomer[]): TierSummary[] {
  const net = customers.reduce((s, c) => s + c.profit, 0);
  return TIER_ORDER.map((tier) => {
    const g = customers.filter((c) => c.tier === tier);
    const profit = g.reduce((s, c) => s + c.profit, 0);
    return {
      tier,
      customers: g.length,
      revenue: g.reduce((s, c) => s + c.revenue, 0),
      profit,
      profitSharePct: net !== 0 ? (profit / net) * 100 : null,
    };
  });
}
