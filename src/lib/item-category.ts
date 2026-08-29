// Classify an order/invoice line by its ITEM NAME prefix.
//
// The Zoho SKU field uses an internal scheme (XE-F015A000L000…) that carries no
// traded/manufactured signal, so classification keys off the human name, which
// the team prefixes by type:
//   R-  , N-        -> traded        (resold third-party goods; N- = Norton brand)
//   RM- , PM- , X-  -> manufactured  (Xeltrix's own products)
//   S-              -> services      (S-DEEP CLEANING, S-MANPOWER)
//   anything else   -> other        (uncategorised)
//
// Verified against the live invoice mirror: this classifies ~100% of line value.
export type ItemCategory = "traded" | "manufactured" | "services" | "other";

export function itemCategory(name: string | null | undefined): ItemCategory {
  const u = (name ?? "").trim().toUpperCase();
  // Order matters: check the two-letter prefixes (RM-, PM-) before the R- rule
  // can't misfire — "RM-" does not start with "R-" (second char is "M"), so the
  // checks are independent, but keep manufactured first for clarity.
  if (u.startsWith("RM-") || u.startsWith("PM-") || u.startsWith("X-")) return "manufactured";
  if (u.startsWith("R-") || u.startsWith("N-")) return "traded";
  if (u.startsWith("S-")) return "services";
  return "other";
}

export const CATEGORY_META: Record<
  ItemCategory,
  { label: string; color: string }
> = {
  manufactured: { label: "Manufactured", color: "#b5c76a" },
  traded: { label: "Traded", color: "#7ca3d4" },
  services: { label: "Services", color: "#d4a373" },
  other: { label: "Other", color: "#71717a" },
};

// Fixed stacking / display order (bottom → top on the chart, top → bottom in legend)
export const CATEGORY_ORDER: ItemCategory[] = ["manufactured", "traded", "services", "other"];
