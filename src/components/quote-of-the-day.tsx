import { Quote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

type QuoteRow = {
  id: string;
  body: string;
  author: string | null;
  image_url: string | null;
};

// Same quote for everyone on the same day, rotating across the pool.
function indexForToday(poolSize: number): number {
  if (poolSize <= 0) return 0;
  const now = new Date();
  // Day-of-epoch (UTC) → deterministic but rotates daily
  const dayKey = Math.floor(now.getTime() / (24 * 60 * 60 * 1000));
  return ((dayKey % poolSize) + poolSize) % poolSize;
}

export async function QuoteOfTheDay() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select("id, body, author, image_url")
    .eq("active", true)
    .order("id"); // stable order so the day-key picks the same one

  const pool: QuoteRow[] = (data ?? []) as QuoteRow[];
  if (pool.length === 0) return null;

  const today = pool[indexForToday(pool.length)];

  return (
    <Card className="overflow-hidden border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-emerald-950/20">
      <div className="flex items-start gap-4 p-5">
        <Quote
          className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
        <div className="flex-1">
          <p className="text-base font-medium leading-snug text-zinc-800 dark:text-zinc-100">
            &ldquo;{today.body}&rdquo;
          </p>
          {today.author && (
            <p className="mt-2 text-xs uppercase tracking-wider text-zinc-500">
              — {today.author}
            </p>
          )}
        </div>
        {today.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={today.image_url}
            alt=""
            className="hidden h-20 w-20 rounded-md object-cover sm:block"
          />
        )}
      </div>
    </Card>
  );
}
