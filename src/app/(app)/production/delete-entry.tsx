"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteProduction } from "./actions";

export function DeleteEntry({ id, canDelete }: { id: string; canDelete: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canDelete) return null;

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={busy}
        title="Delete this entry"
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await deleteProduction(id);
          setBusy(false);
          if (res.error) {
            setError(res.error);
            return;
          }
          router.refresh();
        }}
        className="text-zinc-500 hover:text-red-400 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </span>
  );
}
