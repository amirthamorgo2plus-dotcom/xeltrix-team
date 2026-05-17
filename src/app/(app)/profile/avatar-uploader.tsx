"use client";

import { useState, useTransition } from "react";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { saveAvatarUrl } from "./actions";

export function AvatarUploader({ currentUrl }: { currentUrl: string | null }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const compressed = await imageCompression(file, {
        maxWidthOrHeight: 512,
        maxSizeMB: 0.2,
        useWebWorker: true,
      });

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const ext = compressed.type === "image/png" ? "png" : "jpg";
      const path = `${user.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { upsert: true, contentType: compressed.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      start(() => saveAvatarUrl(url));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <label className="cursor-pointer">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <span className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-transparent px-3 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          {uploading ? "Uploading..." : "Choose photo"}
        </span>
      </label>
      {currentUrl && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => start(() => saveAvatarUrl(null))}
        >
          Remove
        </Button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
