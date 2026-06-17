import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Use only in trusted server code
// (provisioning, admin actions) after authorizing the caller.
export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
