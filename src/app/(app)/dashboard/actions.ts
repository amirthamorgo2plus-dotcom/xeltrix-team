"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser, getMyMembership, isAdminOrManager } from "@/lib/data";

// Add a new image-based quote of the day. Admin/manager only.
// The daily_quotes RLS (daily_quotes_write_admin) enforces this server-side too.
export async function addQuoteImage(imageUrl: string, caption: string | null) {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");

  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) throw new Error("Admins only");

  const supabase = await createClient();
  const { error } = await supabase.from("daily_quotes").insert({
    team_id: m.team_id,
    image_url: imageUrl,
    body: caption && caption.trim() ? caption.trim() : null,
    active: true,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

// Deactivate the current image quote (reverts the card to the text fallback).
export async function removeQuoteImage(id: string) {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");

  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) throw new Error("Admins only");

  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_quotes")
    .update({ active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}
