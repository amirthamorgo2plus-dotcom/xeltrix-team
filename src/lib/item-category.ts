// Classify an order/invoice line by its ITEM NAME prefix.
//
// The Zoho SKU field uses an internal scheme (XE-F015A000L000…) that carries no
// type signal, so classification keys off the human name, which the team
// prefixes by type:
//   R-  , N-   -> traded            (resold third-party goods; N- = Norton brand)
//   X-         -> manufactured      (Xeltrix's own finished products)
//   RM-        -> raw material      (inputs occasionally sold: caustic, colors…)
//   PM-        -> packing material  (inputs; rarely sold)
//   S-         -> services          (S-DEEP CLEANING, S-MANPOWER)
//   else       -> other             (uncategorised / pre-convention items)
//
// Verified against the live invoice mirror: this classifies ~100% of line value.
export type ItemCategory =
  | "manufactured"
  | "traded"
  | "raw_material"
  | "packing_material"
  | "services"
  | "other";

export function itemCategory(name: string | null | undefined): ItemCategory {
  const u = (name ?? "").trim().toUpperCase();
  // Check the longer two-letter prefixes before the single-letter ones.
  if (u.startsWith("RM-")) return "raw_material";
  if (u.startsWith("PM-")) return "packing_material";
  if (u.startsWith("X-")) return "manufactured";
  if (u.startsWith("R-") || u.startsWith("N-")) return "traded";
  if (u.startsWith("S-")) return "services";
  return "other";
}

export const CATEGORY_META: Record<ItemCategory, { label: string; color: string }> = {
  manufactured: { label: "Manufactured", color: "#b5c76a" },
  traded: { label: "Traded", color: "#7ca3d4" },
  raw_material: { label: "Raw Material", color: "#e0975a" },
  packing_material: { label: "Packing Material", color: "#9d7cc7" },
  services: { label: "Services", color: "#5fb3a3" },
  other: { label: "Other", color: "#71717a" },
};

// Fixed stacking / display order (bottom → top on the chart, top → bottom in legend)
export const CATEGORY_ORDER: ItemCategory[] = [
  "manufactured",
  "traded",
  "raw_material",
  "packing_material",
  "services",
  "other",
];

export type CategoryMix = Record<ItemCategory, number>;

export function emptyMix(): CategoryMix {
  return {
    manufactured: 0,
    traded: 0,
    raw_material: 0,
    packing_material: 0,
    services: 0,
    other: 0,
  };
}

// Scale a raw line-item mix onto an authoritative total (e.g. the KPI's sales
// figure). Any unreconciled remainder — pre-convention items, or a total with no
// line items at all — lands in "other" so the parts always sum to the total.
export function fitMix(total: number, raw: CategoryMix): CategoryMix & { total: number } {
  const t = Math.round(total);
  const known = CATEGORY_ORDER.filter((c) => c !== "other");
  const catSum = known.reduce((s, c) => s + raw[c], 0);
  if (catSum <= 0) return { ...emptyMix(), other: t, total: t };
  const scale = catSum > total ? total / catSum : 1;
  const out = emptyMix();
  let allocated = 0;
  for (const c of known) {
    out[c] = Math.round(raw[c] * scale);
    allocated += out[c];
  }
  out.other = Math.max(0, t - allocated);
  return { ...out, total: t };
}
