// Per-litre manufacturing (labour) cost for Xeltrix's own liquid products (X-).
// The team pays a fixed rate per litre made:
//   soap oil & phenyl  -> ₹5 / litre
//   every other liquid -> ₹10 / litre
// Litres are derived from the invoice line: the quantity when the item is sold
// by "ltr", otherwise quantity × the pack size parsed from the product name
// (e.g. "5 L", "200 ML"). Items sold by count with no pack size in the name
// fall back to 1 litre per unit.

// Expense accounts that hold the per-litre production payment, used to show
// when it was last recorded. Overridable per team in
// team_settings.config.production_expense_accounts.
export const DEFAULT_PRODUCTION_ACCOUNTS = [
  "Production Consultancy charges",
  "Manufacturing charges",
];

export const RATE_SOAP_PHENYL = 5;
export const RATE_OTHER = 10;

// Pack size in litres parsed from a product name; null if none present.
export function packLitres(name: string | null | undefined): number | null {
  const u = String(name ?? "").toUpperCase();
  const m = u.match(/(\d+(?:\.\d+)?)\s*(ML|LTR|LITRE|LITER|LIT|L)\b/);
  if (!m) return null;
  const val = parseFloat(m[1]);
  return m[2] === "ML" ? val / 1000 : val;
}

// Litres represented by one manufactured line. Falls back to 1 L/unit when the
// unit isn't litres and no pack size can be read from the name.
export function lineLitres(
  name: string | null | undefined,
  qty: number | null | undefined,
  unit: string | null | undefined,
): number {
  const u = String(unit ?? "").toLowerCase();
  const q = Number(qty ?? 0);
  if (u.includes("ltr") || u.includes("lit") || u === "l") return q;
  const pk = packLitres(name);
  return q * (pk ?? 1);
}

// Soap oil / phenyl (incl. white phenyl, phenyl concentrate) → the ₹5 rate.
export function isSoapOrPhenyl(name: string | null | undefined): boolean {
  const u = String(name ?? "").toUpperCase();
  return u.includes("SOAP OIL") || u.includes("PHENYL") || u.includes("PHENOYL");
}

export function litreRate(name: string | null | undefined): number {
  return isSoapOrPhenyl(name) ? RATE_SOAP_PHENYL : RATE_OTHER;
}

export type ManufacturingLitreCost = {
  soapLitres: number;
  soapCost: number;
  otherLitres: number;
  otherCost: number;
  totalLitres: number;
  totalCost: number;
};

export function emptyLitreCost(): ManufacturingLitreCost {
  return { soapLitres: 0, soapCost: 0, otherLitres: 0, otherCost: 0, totalLitres: 0, totalCost: 0 };
}

// Accumulate one manufactured line into a running total.
export function addLine(
  acc: ManufacturingLitreCost,
  name: string | null | undefined,
  qty: number | null | undefined,
  unit: string | null | undefined,
): void {
  const litres = lineLitres(name, qty, unit);
  if (litres <= 0) return;
  if (isSoapOrPhenyl(name)) {
    acc.soapLitres += litres;
    acc.soapCost += litres * RATE_SOAP_PHENYL;
  } else {
    acc.otherLitres += litres;
    acc.otherCost += litres * RATE_OTHER;
  }
  acc.totalLitres += litres;
  acc.totalCost += litres * (isSoapOrPhenyl(name) ? RATE_SOAP_PHENYL : RATE_OTHER);
}

/**
 * Litres written into a Zoho expense line description.
 *
 * The production charge is entered as free text next to the amount —
 * "Glass cleaner 200L", or "Floor Cleaner 1000L Room Freshner 240L" with two
 * products on one line. There is no quantity field in Zoho to read instead,
 * so this reads the text, and deliberately returns nothing rather than
 * guessing when the text is a bank narration.
 *
 * Returns every "<name> <number>L" pair found, in order.
 */
export type ParsedProduction = { product: string; litres: number };

export function parseProductionLitres(description: string | null | undefined): ParsedProduction[] {
  const text = String(description ?? "");
  if (!text.trim()) return [];
  const out: ParsedProduction[] = [];
  // A product name, then a number, then a litre unit. The name is taken from
  // the text since the previous match, which is what separates two products
  // written on one line.
  const re = /([A-Za-z][A-Za-z\s\-&.()]{1,40}?)\s*(\d+(?:\.\d+)?)\s*(?:L|LTR|LITRE|LITER)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const product = m[1].replace(/[\s\-]+$/, "").trim();
    const litres = parseFloat(m[2]);
    // A bank narration is mostly digits and codes; a product name is not.
    if (!product || /\d/.test(product) || product.length < 3) continue;
    if (!Number.isFinite(litres) || litres <= 0) continue;
    out.push({ product, litres });
  }
  return out;
}

/** What the parsed litres should have cost, for comparison with the amount. */
export function expectedCost(parsed: ParsedProduction[]): number {
  return parsed.reduce((s, p) => s + p.litres * litreRate(p.product), 0);
}
