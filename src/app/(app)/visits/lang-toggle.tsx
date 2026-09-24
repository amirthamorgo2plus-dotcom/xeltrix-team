"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { setVisitsLang } from "./actions";
import { LANGS, LANG_LABEL, type Lang } from "./i18n";

// Two-way language switch for the Visits page. Writes a cookie server-side so
// the choice sticks on the rep's phone across sessions.
export function LangToggle({ current }: { current: Lang }) {
  const [pending, start] = useTransition();

  return (
    <div className="inline-flex items-center gap-1">
      <Languages className="h-4 w-4 text-zinc-400" />
      <div className="inline-flex rounded-md border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={current === l}
            disabled={pending || current === l}
            onClick={() => start(() => setVisitsLang(l))}
            className={
              current === l
                ? "rounded bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                : "rounded px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }
          >
            {LANG_LABEL[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
