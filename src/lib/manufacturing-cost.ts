// Per-litre manufacturing (labour) cost for Xeltrix's own liquid products (X-).
// The team pays a fixed rate per litre made:
//   soap oil & phenyl  -> ₹5 / litre
//   every other liquid -> ₹10 / litre
// Litres are derived from the invoice line: the quantity when the item is sold
// by "ltr", otherwise quantity × the pack size parsed from the product name
// (e.g. "5 L", "200 ML"). Items sold by count with no pack size in the name
// fall back to 1 litre per unit.

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
