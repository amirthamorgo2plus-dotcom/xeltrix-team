"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data";

export async function updateProfile(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const user = await getUser();
  if (!user) return { error: "Not signed in." };

  const full_name = String(formData.get("full_name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const timezone =
    String(formData.get("timezone") ?? "").trim() || "Asia/Kolkata";

  const supabase = await createClient();

  // UPSERT — creates the row if the profile is missing (e.g. user was added
  // before the handle_new_user trigger existed) and updates it otherwise.
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name,
        phone,
        timezone,
      },
      { onConflict: "id" }
    );

  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { ok: true };
}

export async function saveAvatarUrl(url: string | null) {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");

  const supabase = await createClient();
  // UPSERT here too, so an avatar can be set even if the row is brand new.
  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, avatar_url: url },
      { onConflict: "id" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}
