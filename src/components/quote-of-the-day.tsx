import { Quote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { QuoteImageCard } from "@/components/quote-image-card";
import { QuoteImageUploader } from "@/components/quote-image-uploader";

type QuoteRow = {
  id: string;
  body: string | null;
  author: string | null;
  image_url: string | null;
};

// Same text quote for everyone on the same day, rotating across the pool.
// Used only as a fallback before any admin has uploaded an image.
function indexForToday(poolSize: number): number {
  if (poolSize <= 0) return 0;
  const now = new Date();
  const dayKey = Math.floor(now.getTime() / (24 * 60 * 60 * 1000));
  return ((dayKey % poolSize) + poolSize) % poolSize;
}

export async function QuoteOfTheDay() {
  const supabase = await createClient();
  const membership = await getMyMembership();
  const isAdmin = isAdminOrManager(membership?.role);

  // Primary: the most recently uploaded active image.
  const { data: imageRows } = await supabase
    .from("daily_quotes")
    .select("id, body, author, image_url")
    .eq("active", true)
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const latestImage = (imageRows?.[0] ?? null) as QuoteRow | null;

  if (latestImage?.image_url) {
    return (
      <div className="flex flex-col gap-2">
        <QuoteImageCard
          imageUrl={latestImage.image_url}
          caption={latestImage.body}
        />
        {isAdmin && <QuoteImageUploader currentId={latestImage.id} />}
      </div>
    );
  }

  // Fallback: rotating text quote until an image is uploaded.
  const { data } = await supabase
    .from("daily_quotes")
    .select("id, body, author, image_url")
    .eq("active", true)
    .order("id");

  const pool = ((data ?? []) as QuoteRow[]).filter((q) => q.body);
  const today = pool.length > 0 ? pool[indexForToday(pool.length)] : null;

  if (!today && !isAdmin) return null;

  return (
    <div className="flex flex-col gap-2">
      {today && (
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
          </div>
        </Card>
      )}
      {isAdmin && <QuoteImageUploader currentId={null} />}
    </div>
  );
}
