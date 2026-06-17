import "server-only";
import { getUser } from "@/lib/data";

// Super-admins (you) provision organizations. Identified by an email allowlist
// in the SUPERADMIN_EMAILS env var (comma-separated). Separate from per-org
// admin/manager roles.
export async function isSuperAdmin(): Promise<boolean> {
  const user = await getUser();
  if (!user?.email) return false;
  const allow = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(user.email.toLowerCase());
}
