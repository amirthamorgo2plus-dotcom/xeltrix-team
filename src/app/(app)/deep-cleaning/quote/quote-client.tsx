"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  costOf,
  outcomeAt,
  priceForTargetNet,
  type MaterialLine,
  type QuoteInput,
} from "@/lib/deep-cleaning-quote";
import { saveQuoteDefaults } from "./actions";

export type Product = {
  id: string;
  name: string;
  cost_price: number | null;
  category: string;
};

// Ordered by how likely a cleaning job is to use them, not alphabetically:
// our own liquids first, then the consumables bought in for the job.
const GROUPS: { key: string; label: string }[] = [
  { key: "manufactured", label: "Our products" },
  { key: "traded", label: "Bought-in consumables" },
  { key: "raw_material", label: "Raw materials" },
  { key: "packing_material", label: "Packing" },
  { key: "other", label: "Other" },
];
export type Referrer = { id: string; name: string; default_pct: number | null };

type Line = { id: string; productId: string; qty: number };
const uid = () => Math.random().toString(36).slice(2, 9);

export function QuoteClient({
  products,
  referrers,
  currency,
  defaultLabour,
  defaultTravel,
  canSaveDefaults,
}: {
  products: Product[];
  referrers: Referrer[];
  currency: string;
  defaultLabour: number;
  defaultTravel: number;
  canSaveDefaults: boolean;
}) {
  const [crewSize, setCrewSize] = useState(2);
  const [days, setDays] = useState(1);
  const [labourRate, setLabourRate] = useState(defaultLabour);
  const [travel, setTravel] = useState(defaultTravel);
  const [lines, setLines] = useState<Line[]>([]);
  const [referrerId, setReferrerId] = useState("");
  const [referralPct, setReferralPct] = useState(0);
  const [targetNet, setTargetNet] = useState(25);
  const [price, setPrice] = useState("");
  const [savedDefaults, setSavedDefaults] = useState(false);

  const money = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const materials: MaterialLine[] = lines
    .map((l) => {
      const p = productById.get(l.productId);
      if (!p) return null;
      return { name: p.name, unitCost: Number(p.cost_price ?? 0), qty: l.qty };
    })
    .filter((m): m is MaterialLine => m !== null);

  const input: QuoteInput = { crewSize, days, labourRate, travel, materials, referralPct };
  const cost = costOf(input);
  const suggested = priceForTargetNet(targetNet, input);
  // Typing a price answers the other question; until then the suggestion is
  // what gets measured, so the two panels always agree.
  const effectivePrice = price.trim() !== "" ? Number(price) : (suggested ?? 0);
  const outcome = outcomeAt(Number.isFinite(effectivePrice) ? effectivePrice : 0, input);

  // A product with no cost price would silently cost nothing, which is worse
  // than saying so — 60 of them have none.
  const uncosted = lines.filter((l) => {
    const p = productById.get(l.productId);
    return p && (p.cost_price == null || Number(p.cost_price) <= 0);
  }).length;

  return (
    <div className="flex flex-col gap-4">
      {/* ---- what it costs ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="People">
          <Input type="number" min="0" step="1" value={crewSize}
            onChange={(e) => setCrewSize(Number(e.target.value))} />
        </Field>
        <Field label="Days">
          <Input type="number" min="0" step="0.5" value={days}
            onChange={(e) => setDays(Number(e.target.value))} />
        </Field>
        <Field label={`Per person / day`}>
          <Input type="number" min="0" step="10" value={labourRate}
            onChange={(e) => setLabourRate(Number(e.target.value))} />
        </Field>
        <Field label="Travel">
          <Input type="number" min="0" step="10" value={travel}
            onChange={(e) => setTravel(Number(e.target.value))} />
        </Field>
      </div>

      {canSaveDefaults && (labourRate !== defaultLabour || travel !== defaultTravel) && (
        <div className="flex items-center gap-2 text-xs">
          <Button
            variant="outline"
            onClick={async () => {
              await saveQuoteDefaults(labourRate, travel);
              setSavedDefaults(true);
            }}
          >
            Save {money(labourRate)}/day and {money(travel)} travel as the default
          </Button>
          {savedDefaults && <span className="text-[#b5c76a]">Saved</span>}
        </div>
      )}

      {/* ---- materials ---- */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Chemicals used</span>
          <Button
            variant="outline"
            onClick={() => setLines((l) => [...l, { id: uid(), productId: "", qty: 1 }])}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        {lines.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Optional. Costed at what the product costs us, not what it sells for.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lines.map((l) => {
              const p = productById.get(l.productId);
              const lineCost = (Number(p?.cost_price ?? 0)) * l.qty;
              return (
                <li key={l.id} className="flex items-center gap-2">
                  <Select
                    value={l.productId}
                    onChange={(e) =>
                      setLines((ls) =>
                        ls.map((x) => (x.id === l.id ? { ...x, productId: e.target.value } : x))
                      )
                    }
                    className="min-w-0 flex-1"
                  >
                    <option value="">Select…</option>
                    {GROUPS.map((g) => {
                      const items = products.filter((pr) => pr.category === g.key);
                      if (items.length === 0) return null;
                      return (
                        <optgroup key={g.key} label={`${g.label} (${items.length})`}>
                          {items.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </Select>
                  <Input
                    type="number" min="0" step="0.5" value={l.qty}
                    onChange={(e) =>
                      setLines((ls) =>
                        ls.map((x) => (x.id === l.id ? { ...x, qty: Number(e.target.value) } : x))
                      )
                    }
                    className="w-20 shrink-0"
                  />
                  <span className="w-20 shrink-0 text-right text-sm tabular-nums text-zinc-400">
                    {money(lineCost)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}
                    className="shrink-0 p-1.5 text-zinc-500 hover:text-red-400"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {uncosted > 0 && (
          <p className="text-xs text-amber-500">
            {uncosted} selected product{uncosted === 1 ? " has" : "s have"} no cost price, so
            {uncosted === 1 ? " it adds" : " they add"} nothing to the cost below. Set it on the
            product price list.
          </p>
        )}
      </div>

      {/* ---- referral ---- */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Referrer">
          <Select
            value={referrerId}
            onChange={(e) => {
              const id = e.target.value;
              setReferrerId(id);
              const r = referrers.find((x) => x.id === id);
              // Most jobs come in directly, so no referrer means no commission.
              setReferralPct(id === "" ? 0 : Number(r?.default_pct ?? 0));
            }}
          >
            <option value="">None — direct</option>
            {referrers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Commission %">
          <Input
            type="number" min="0" max="100" step="0.5"
            value={referralPct}
            disabled={referrerId === ""}
            onChange={(e) => setReferralPct(Number(e.target.value))}
          />
        </Field>
      </div>

      {/* ---- cost ---- */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm">
        <div className="flex justify-between text-zinc-400">
          <span>Labour — {crewSize} × {days} day{days === 1 ? "" : "s"} × {money(labourRate)}</span>
          <span className="tabular-nums">{money(cost.labour)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Chemicals</span>
          <span className="tabular-nums">{money(cost.materials)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Travel</span>
          <span className="tabular-nums">{money(cost.travel)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-zinc-800 pt-1 font-semibold">
          <span>Cost</span>
          <span className="tabular-nums">{money(cost.total)}</span>
        </div>
      </div>

      {/* ---- the two directions ---- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 p-3">
          <p className="text-xs text-zinc-500">I want this margin</p>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="number" min="0" max="99" step="1"
              value={targetNet}
              onChange={(e) => setTargetNet(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-sm text-zinc-500">% net</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Quote</p>
          <p className="text-2xl font-bold tabular-nums text-[#b5c76a]">
            {suggested === null ? "—" : money(Math.ceil(suggested))}
          </p>
          {suggested === null && (
            <p className="text-xs text-amber-500">
              {targetNet}% plus {referralPct}% commission leaves nothing for cost.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 p-3">
          <p className="text-xs text-zinc-500">Or I am quoting</p>
          <Input
            type="number" min="0" step="50"
            value={price}
            placeholder={suggested === null ? "" : String(Math.ceil(suggested))}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1"
          />
          <dl className="mt-2 space-y-0.5 text-xs">
            <Row label="Gross" value={money(outcome.gross)}
              pct={outcome.grossPct} />
            {referralPct > 0 && (
              <Row label={`Referral ${referralPct}%`} value={`− ${money(outcome.referral)}`} />
            )}
            <Row label="Net" value={money(outcome.net)} pct={outcome.netPct} strong
              negative={outcome.net < 0} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Row({
  label, value, pct, strong, negative,
}: {
  label: string; value: string; pct?: number | null; strong?: boolean; negative?: boolean;
}) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-zinc-800 pt-1 font-semibold" : ""}`}>
      <span className="text-zinc-500">{label}</span>
      <span className={`tabular-nums ${negative ? "text-red-400" : strong ? "text-[#b5c76a]" : "text-zinc-300"}`}>
        {value}
        {pct != null && <span className="ml-1 text-zinc-500">{pct.toFixed(1)}%</span>}
      </span>
    </div>
  );
}
