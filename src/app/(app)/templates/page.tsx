import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTeamSettings } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { SortControl, resolveSort } from "@/components/sort-control";

function fmtMoney(v: number | null, currency = "INR") {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(v);
}

type StatusFilter = "all" | "active" | "inactive";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: StatusFilter; sort?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status: StatusFilter =
    sp.status === "active" || sp.status === "inactive" ? sp.status : "all";
  const sort = resolveSort(sp.sort, { withNewest: false });

  const settings = await getTeamSettings();
  const currency = settings?.currency || "INR";

  const supabase = await createClient();
  let query = supabase
    .from("opportunity_templates")
    .select("id, name, sku, rate, unit, active, zoho_item_id")
    .order(sort.column, { ascending: sort.ascending });

  if (q) {
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  }
  if (status === "active") query = query.eq("active", true);
  if (status === "inactive") query = query.eq("active", false);

  const { data: templates } = await query.limit(500);

  function chip(value: StatusFilter, label: string) {
    const isActive = status === value;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value !== "all") params.set("status", value);
    if (sort.key !== "name_asc") params.set("sort", sort.key);
    const href = `/templates${params.size ? `?${params}` : ""}`;
    return (
      <Link
        key={value}
        href={href}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          isActive
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900"
        }`}
      >
        {label}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-sm text-zinc-500">
          Products and services synced from Zoho Books Items. Use these as a catalog when creating opportunities.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{templates?.length ?? 0} products</CardTitle>
            <SortControl current={sort.key} withNewest={false} />
          </div>
        </CardHeader>
        <CardContent>
          <form className="mb-3 flex gap-2" action="/templates">
            {status !== "all" && (
              <input type="hidden" name="status" value={status} />
            )}
            {sort.key !== "name_asc" && (
              <input type="hidden" name="sort" value={sort.key} />
            )}
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search by name or SKU…"
              className="max-w-sm"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Search
            </button>
            {(q || status !== "all") && (
              <a
                href="/templates"
                className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Clear
              </a>
            )}
          </form>

          <div className="mb-4 flex flex-wrap gap-2">
            {chip("all", "All")}
            {chip("active", "Active only")}
            {chip("inactive", "Inactive only")}
          </div>

          {!templates || templates.length === 0 ? (
            <EmptyState
              title={q ? `No templates matching "${q}"` : "No templates yet"}
              hint={q ? "Try a different search or filter." : "Connect Zoho Books and sync to populate."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">SKU</th>
                    <th className="pb-2 pr-4 text-right">Rate</th>
                    <th className="pb-2 pr-4">Unit</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="py-2 pr-4 font-medium">{t.name}</td>
                      <td className="py-2 pr-4 text-zinc-500">{t.sku || "—"}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{fmtMoney(t.rate, currency)}</td>
                      <td className="py-2 pr-4 text-zinc-500">{t.unit || "—"}</td>
                      <td className="py-2">
                        {t.active ? (
                          <Badge tone="success">Active</Badge>
                        ) : (
                          <Badge tone="muted">Inactive</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
