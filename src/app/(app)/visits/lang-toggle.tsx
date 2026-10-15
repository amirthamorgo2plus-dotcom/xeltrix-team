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
            // min-h-8 and wider padding: this is the control a Tamil-reading
            // field worker needs first, and at 24px it was the smallest thing
            // on the page.
            className={
              "inline-flex min-h-8 items-center rounded px-3 text-xs " +
              (current === l
                ? "bg-emerald-500/15 font-medium text-emerald-700 dark:text-emerald-300"
                : "text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800")
            }
          >
            {LANG_LABEL[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
