"use client";

import { useState, useTransition } from "react";
import { ImagePlus } from "lucide-react";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { addQuoteImage, removeQuoteImage } from "@/app/(app)/dashboard/actions";

// Compress on the main thread, but never let it wedge the upload: if it throws
// or takes longer than 15s, fall back to the original file. Guarantees the
// returned promise always settles so the button can't stick on "Uploading...".
async function compressWithFallback(file: File): Promise<File> {
  const timeout = new Promise<File>((resolve) =>
    setTimeout(() => resolve(file), 15_000),
  );
  const compress = imageCompression(file, {
    maxWidthOrHeight: 1280,
    maxSizeMB: 0.5,
    useWebWorker: false,
  }).catch(() => file);
  return Promise.race([compress, timeout]);
}

// Admin-only control rendered under the quote card. Uploads an image to the
// `quote-images` bucket, then records it as the latest quote of the day.
export function QuoteImageUploader({ currentId }: { currentId: string | null }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      // Compress on the main thread. With useWebWorker:true the library loads
      // its own code from a CDN via importScripts() inside the worker, which can
      // hang forever behind a CSP/proxy — leaving this await unsettled and the
      // button stuck on "Uploading...". Main-thread compression has no such
      // dependency; if it still fails or is slow, fall back to the original file
      // so the upload always proceeds.
      const compressed = await compressWithFallback(file);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const ext = (compressed.type.split("/")[1] || "jpg").replace(
        "jpeg",
        "jpg",
      );
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("quote-images")
        .upload(path, compressed, { contentType: compressed.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from("quote-images")
        .getPublicUrl(path);

      start(() => addQuoteImage(pub.publicUrl, null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-1 text-xs text-zinc-500">
      <label className="cursor-pointer">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-transparent px-3 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          <ImagePlus className="h-3.5 w-3.5" />
          {uploading
            ? "Uploading..."
            : currentId
              ? "Replace quote image"
              : "Upload quote image"}
        </span>
      </label>
      {currentId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => start(() => removeQuoteImage(currentId))}
        >
          Remove
        </Button>
      )}
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
