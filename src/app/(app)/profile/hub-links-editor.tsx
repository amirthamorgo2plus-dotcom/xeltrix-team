"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { setHubLinks } from "@/app/(app)/hub/actions";
import { HUB_CATEGORIES, type HubCategory, type HubLink } from "@/app/(app)/hub/links";

type Row = { id: number; link: HubLink };

function blankLink(): HubLink {
  return {
    key: "",
    name: "",
    description: "",
    url: "",
    category: "My apps",
    emoji: "🔗",
    check: false,
    internal: false,
  };
}

export function HubLinksEditor({ initialLinks }: { initialLinks: HubLink[] }) {
  const counter = useRef(initialLinks.length);
  const [rows, setRows] = useState<Row[]>(() =>
    initialLinks.map((link, i) => ({ id: i, link }))
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function update(id: number, patch: Partial<HubLink>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, link: { ...r.link, ...patch } } : r)));
    setMsg(null);
  }
  function addRow() {
    setRows((rs) => [...rs, { id: counter.current++, link: blankLink() }]);
    setMsg(null);
  }
  function removeRow(id: number) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setMsg(null);
  }

  function save() {
    // Drop rows with no name; key auto-derives from name if blank.
    const links: HubLink[] = rows
      .map((r) => r.link)
      .filter((l) => l.name.trim())
      .map((l, i) => ({
        ...l,
        key: l.key || `${l.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${i}`,
      }));
    startTransition(async () => {
      const res = await setHubLinks(links);
      setMsg(
        res.error
          ? { ok: false, text: res.error }
          : { ok: true, text: `Saved ${links.length} link${links.length === 1 ? "" : "s"}.` }
      );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-zinc-500">
        These are the cards on the{" "}
        <a href="/hub" className="underline">Command Center</a>. Tick <strong>Live status</strong>{" "}
        only for sites you own (it shows an online/offline dot). Leave it off for third-party sites
        like JustDial/YouTube. Tick <strong>Internal</strong> for pages inside this app.
      </p>

      <div className="flex flex-col gap-3">
        {rows.length === 0 && (
          <p className="text-sm text-zinc-500">No links yet — add one below.</p>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
              <div className="sm:col-span-1">
                <Label className="text-xs text-zinc-500">Icon</Label>
                <Input
                  value={r.link.emoji}
                  onChange={(e) => update(r.id, { emoji: e.target.value })}
                  className="text-center"
                  maxLength={4}
                />
              </div>
              <div className="sm:col-span-3">
                <Label className="text-xs text-zinc-500">Name</Label>
                <Input
                  value={r.link.name}
                  onChange={(e) => update(r.id, { name: e.target.value })}
                  placeholder="e.g. JustDial"
                />
              </div>
              <div className="sm:col-span-5">
                <Label className="text-xs text-zinc-500">URL</Label>
                <Input
                  value={r.link.url}
                  onChange={(e) => update(r.id, { url: e.target.value })}
                  placeholder="https://…  (or /page for internal)"
                />
              </div>
              <div className="sm:col-span-3">
                <Label className="text-xs text-zinc-500">Category</Label>
                <Select
                  value={r.link.category}
                  onChange={(e) => update(r.id, { category: e.target.value as HubCategory })}
                >
                  {HUB_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-8">
                <Label className="text-xs text-zinc-500">Description</Label>
                <Input
                  value={r.link.description}
                  onChange={(e) => update(r.id, { description: e.target.value })}
                  placeholder="Short note shown on the card"
                />
              </div>
              <div className="flex items-end gap-4 sm:col-span-4">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={!!r.link.check}
                    onChange={(e) => update(r.id, { check: e.target.checked })}
                  />
                  Live status
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={!!r.link.internal}
                    onChange={(e) => update(r.id, { internal: e.target.checked })}
                  />
                  Internal
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto text-red-600"
                  onClick={() => removeRow(r.id)}
                  aria-label="Remove link"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={addRow}>
          <Plus className="h-4 w-4" /> Add link
        </Button>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save links"}
        </Button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
