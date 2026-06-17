"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { setActiveTeam } from "@/app/(app)/org-actions";

export function OrgSwitcher({
  teams,
  current,
}: {
  teams: { team_id: string; name: string }[];
  current: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (teams.length === 0) return null;

  // Single org: just show its name (no switcher needed).
  if (teams.length === 1) {
    return (
      <span className="hidden items-center gap-1.5 text-sm text-zinc-500 sm:inline-flex">
        <Building2 className="h-3.5 w-3.5" />
        <span className="max-w-[12rem] truncate">{teams[0].name}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Building2 className="hidden h-3.5 w-3.5 text-zinc-500 sm:block" />
      <select
        value={current}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setActiveTeam(e.target.value);
            router.refresh();
          })
        }
        className="h-8 max-w-[12rem] rounded-md border border-zinc-300 bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50 dark:border-zinc-700"
        aria-label="Switch organization"
      >
        {teams.map((t) => (
          <option key={t.team_id} value={t.team_id}>
            {t.name}
          </option>
        ))}
      </select>
    </span>
  );
}
