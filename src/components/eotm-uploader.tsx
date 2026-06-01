"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { setEotm } from "@/app/(app)/dashboard/eotm-actions";

// Admin control under the Employee of the Month card. Uploads an image to the
// `employee-of-month` bucket and saves its URL (+ optional name) in settings.
export function EotmUploader({
  hasImage,
  currentCaption,
}: {
  hasImage: boolean;
  currentCaption: string | null;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(currentCaption ?? "");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const compressed = await imageCompression(file, {
        maxWidthOrHeight: 1280,
        maxSizeMB: 0.5,
        useWebWorker: true,
      });

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const ext = compressed.type === "image/png" ? "png" : "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("employee-of-month")
        .upload(path, compressed, { contentType: compressed.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from("employee-of-month")
        .getPublicUrl(path);

      const res = await setEotm(pub.publicUrl, name);
      if (res.error) throw new Error(res.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-zinc-500">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (optional)"
        className="h-8 w-40 rounded-md border border-zinc-300 bg-transparent px-2 dark:border-zinc-700"
      />
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
            ? "Uploading…"
            : hasImage
              ? "Replace photo"
              : "Upload photo"}
        </span>
      </label>
      {hasImage && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            start(async () => {
              await setEotm(null, null);
              router.refresh();
            })
          }
        >
          Remove
        </Button>
      )}
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
