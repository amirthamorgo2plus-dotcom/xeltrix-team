"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { setPaymentQr } from "./actions";

// Admin control: upload the company payment QR image to the `payment-qr`
// bucket and save its URL in team settings. Replace or remove the current one.
export function QrUploader({ hasQr }: { hasQr: boolean }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      // QR codes need sharp edges — keep resolution high, light compression.
      const compressed = await imageCompression(file, {
        maxWidthOrHeight: 1400,
        maxSizeMB: 0.6,
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
        .from("payment-qr")
        .upload(path, compressed, { contentType: compressed.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from("payment-qr")
        .getPublicUrl(path);

      const res = await setPaymentQr(pub.publicUrl);
      if (res.error) throw new Error(res.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
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
            : hasQr
              ? "Replace QR image"
              : "Upload QR image"}
        </span>
      </label>
      {hasQr && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            start(async () => {
              await setPaymentQr(null);
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
