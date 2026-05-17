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

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({
    full_name: String(formData.get("full_name") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    timezone: String(formData.get("timezone") ?? "Asia/Kolkata"),
  }).eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { ok: true };
}

export async function saveAvatarUrl(url: string | null) {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}
