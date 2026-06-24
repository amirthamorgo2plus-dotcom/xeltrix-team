import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTeamSettings, getMyMembership } from "@/lib/data";
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

const CATEGORIES = [
  { prefix: "A-",  label: "Assets",           color: "#a78bfa" },
  { prefix: "R-",  label: "Traded",            color: "#38bdf8" },
  { prefix: "PM-", label: "Packing Materials", color: "#fb923c" },
  { prefix: "RM-", label: "Raw Materials",     color: "#facc15" },
  { prefix: "X-",  label: "Xeltrix Products",  color: "#b5c76a" },
] as const;

type CategoryKey = typeof CATEGORIES[number]["prefix"] | "all";

function categoryOf(name: string): typeof CATEGORIES[number]["prefix"] | null {
  for (const c of CATEGORIES) {
    if (name.toUpperCase().startsWith(c.prefix)) return c.prefix;
  }
  return null;
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: StatusFilter; cat?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status: StatusFilter =
    sp.status === "active" || sp.status === "inactive" ? sp.status : "all";
  const cat: CategoryKey =
    (CATEGORIES.find((c) => c.prefix === sp.cat)?.prefix) ?? "all";
  const sort = resolveSort(sp.sort, { withNewest: false });

  const settings = await getTeamSettings();
  const currency = settings?.currency || "INR";

  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";

  const supabase = await createClient();
  let query = supabase
    .from("opportunity_templates")
    .select("id, name, sku, rate, unit, active, zoho_item_id")
    .eq("team_id", teamId)
    .order(sort.column, { ascending: sort.ascending });

  if (q) {
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  }
  if (status === "active") query = query.eq("active", true);
  if (status === "inactive") query = query.eq("active", false);

  const { data: rawTemplates } = await query.limit(500);

  // Category filter applied in-memory (prefix on name)
  const templates = cat === "all"
    ? (rawTemplates ?? [])
    : (rawTemplates ?? []).filter((t) => categoryOf(t.name) === cat);

  function buildParams(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { q: q || undefined, status: status !== "all" ? status : undefined, cat: cat !== "all" ? cat : undefined, sort: sort.key !== "name_asc" ? sort.key : undefined, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return params.size ? `?${params}` : "";
  }

  function statusChip(value: StatusFilter, label: string) {
    const isActive = status === value;
    return (
      <Link
        key={value}
        href={`/templates${buildParams({ status: value !== "all" ? value : undefined })}`}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          isActive
            ? "border-[#b5c76a]/40 bg-[#b5c76a]/10 text-[#b5c76a]"
            : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
        }`}
      >
        {label}
      </Link>
    );
  }

  function catChip(prefix: CategoryKey, label: string, color: string) {
    const isActive = cat === prefix;
    return (
      <Link
        key={prefix}
        href={`/templates${buildParams({ cat: prefix !== "all" ? prefix : undefined })}`}
        className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        style={isActive
          ? { borderColor: `${color}50`, background: `${color}18`, color }
          : { borderColor: "#3f3f46", color: "#a1a1aa" }}
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
            <CardTitle>{templates.length} product{templates.length === 1 ? "" : "s"}{cat !== "all" ? ` · ${CATEGORIES.find(c => c.prefix === cat)?.label}` : ""}</CardTitle>
            <SortControl
              current={sort.key}
              basePath="/templates"
              withNewest={false}
              params={{
                q: q || undefined,
                status: status !== "all" ? status : undefined,
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <form className="mb-4 flex gap-2" action="/templates">
            {status !== "all" && <input type="hidden" name="status" value={status} />}
            {cat !== "all" && <input type="hidden" name="cat" value={cat} />}
            {sort.key !== "name_asc" && <input type="hidden" name="sort" value={sort.key} />}
            <Input name="q" defaultValue={q} placeholder="Search by name or SKU…" className="max-w-sm" />
            <button type="submit" className="inline-flex h-10 items-center rounded-md bg-zinc-800 px-4 text-sm font-medium text-zinc-50 hover:bg-zinc-700">
              Search
            </button>
            {(q || status !== "all" || cat !== "all") && (
              <a href="/templates" className="inline-flex h-10 items-center rounded-md border border-zinc-700 px-4 text-sm text-zinc-400 hover:bg-zinc-800">
                Clear
              </a>
            )}
          </form>

          {/* Category filter */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500 shrink-0">Category:</span>
            {catChip("all", "All", "#a1a1aa")}
            {CATEGORIES.map((c) => catChip(c.prefix, c.label, c.color))}
          </div>

          {/* Status filter */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500 shrink-0">Status:</span>
            {statusChip("all", "All")}
            {statusChip("active", "Active")}
            {statusChip("inactive", "Inactive")}
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
