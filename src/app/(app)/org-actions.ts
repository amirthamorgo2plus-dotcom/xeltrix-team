"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_TEAM_COOKIE, getMyMemberships } from "@/lib/data";

// Switch the active organization. Only allows orgs the user actually belongs to.
export async function setActiveTeam(teamId: string) {
  const mems = await getMyMemberships();
  if (!mems.some((m) => m.team_id === teamId)) {
    throw new Error("You're not a member of that organization.");
  }
  (await cookies()).set(ACTIVE_TEAM_COOKIE, teamId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
