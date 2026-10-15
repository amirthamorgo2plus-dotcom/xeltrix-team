/**
 * Costing and pricing for a deep cleaning job.
 *
 * Unlike a product, the cost is assembled rather than looked up: people for
 * a number of days, the chemicals consumed, and getting there. Materials are
 * priced from opportunity_templates.cost_price, so the chemicals a job uses
 * are costed at what they actually cost us.
 *
 * The pricing direction is the point. A referral commission is a percentage
 * of the PRICE, not of the margin, so marking cost up by the margin you want
 * leaves you short: on a real job costing 7,800 with a 10% referrer, a 25%
 * markup gives 9,750 and nets 11%, where the correct answer is 12,000.
 */

export const DEFAULT_LABOUR_PER_PERSON_DAY = 500;
export const DEFAULT_TRAVEL_FLAT = 300;

export type MaterialLine = {
  /** Snapshot of the product name, so a renamed product does not rewrite a quote. */
  name: string;
  unitCost: number;
  qty: number;
};

export type QuoteInput = {
  crewSize: number;
  days: number;
  labourRate: number;
  travel: number;
  materials: MaterialLine[];
  /** 0 when the job came in directly — most do. */
  referralPct: number;
};

export type CostBreakdown = {
  labour: number;
  materials: number;
  travel: number;
  total: number;
};

export function costOf(input: QuoteInput): CostBreakdown {
  const labour = Math.max(0, input.crewSize) * Math.max(0, input.days) * Math.max(0, input.labourRate);
  const materials = input.materials.reduce(
    (s, m) => s + Math.max(0, m.unitCost) * Math.max(0, m.qty),
    0
  );
  const travel = Math.max(0, input.travel);
  return { labour, materials, travel, total: labour + materials + travel };
}

export type Outcome = {
  price: number;
  cost: number;
  gross: number;
  grossPct: number | null;
  referral: number;
  net: number;
  netPct: number | null;
};

/** What a given price actually leaves, after the referral comes off the top. */
export function outcomeAt(price: number, input: QuoteInput): Outcome {
  const cost = costOf(input).total;
  const referral = price * (clampPct(input.referralPct) / 100);
  const gross = price - cost;
  const net = gross - referral;
  return {
    price,
    cost,
    gross,
    grossPct: price > 0 ? (gross / price) * 100 : null,
    referral,
    net,
    netPct: price > 0 ? (net / price) * 100 : null,
  };
}

/**
 * The price that leaves `targetNetPct` of it as profit after the referral.
 *
 *   net   = price - cost - price * ref
 *   net/price = 1 - cost/price - ref = target
 *   price = cost / (1 - target - ref)
 *
 * Null when the target and the commission together leave nothing to cover
 * cost — at 90% target plus a 15% referrer there is no such price, and
 * returning a huge number would be worse than saying so.
 */
export function priceForTargetNet(targetNetPct: number, input: QuoteInput): number | null {
  const cost = costOf(input).total;
  const denom = 1 - clampPct(targetNetPct) / 100 - clampPct(input.referralPct) / 100;
  if (denom <= 0) return null;
  if (cost <= 0) return 0;
  return cost / denom;
}

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
}
