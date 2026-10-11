"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { RATE_SOAP_PHENYL, RATE_OTHER, isSoapOrPhenyl } from "@/lib/manufacturing-cost";
import { saveProduction } from "./actions";

export type ProductOption = { id: string; name: string };

export function ProductionEntryForm({
  products,
  currency,
}: {
  products: ProductOption[];
  currency: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveProduction, undefined);

  // Refreshing is a side effect; clearing the inputs is not done here. The
  // fields carry their own state and are remounted by the savedAt key below,
  // which resets them without setting state from inside an effect.
  useEffect(() => {
    if (state?.saved) router.refresh();
  }, [state?.savedAt, state?.saved, router]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <Fields
        key={state?.savedAt ?? 0}
        products={products}
        currency={currency}
        pending={pending}
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {state?.error && <span className="text-red-400">{state.error}</span>}
        {state?.saved && <span className="text-[#b5c76a]">Recorded</span>}
      </div>
      <p className="text-xs text-zinc-500">
        The rate follows the product: ₹{RATE_SOAP_PHENYL}/L for soap oil &amp; phenyl, ₹
        {RATE_OTHER}/L for every other liquid. It is saved with the entry, so changing the
        rate later will not rewrite what is already recorded.
      </p>
    </form>
  );
}

function Fields({
  products,
  currency,
  pending,
}: {
  products: ProductOption[];
  currency: string;
  pending: boolean;
}) {
  const [productId, setProductId] = useState("");
  const [litres, setLitres] = useState("");

  const product = products.find((p) => p.id === productId) ?? null;
  // Shown before saving, so nobody has to remember which rate a product takes.
  const preview = useMemo(() => {
    const l = Number(litres);
    if (!product || !Number.isFinite(l) || l <= 0) return null;
    const rate = isSoapOrPhenyl(product.name) ? RATE_SOAP_PHENYL : RATE_OTHER;
    return { rate, amount: l * rate };
  }, [product, litres]);

  const money = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

  return (
    <>
      <input type="hidden" name="product_name" value={product?.name ?? ""} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="template_id">Product *</Label>
          <Select
            id="template_id"
            name="template_id"
            required
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="" disabled>
              Select…
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="litres">Litres made *</Label>
          <Input
            id="litres"
            name="litres"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={litres}
            onChange={(e) => setLitres(e.target.value)}
            placeholder="e.g. 500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Note</Label>
          <Input id="notes" name="notes" placeholder="optional" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !product}>
          {pending ? "Saving…" : "Record production"}
        </Button>
        {preview && (
          <span className="text-sm text-zinc-400">
            {litres} L × ₹{preview.rate}/L ={" "}
            <span className="font-medium text-[#b5c76a]">{money(preview.amount)}</span>
          </span>
        )}
      </div>
    </>
  );
}
