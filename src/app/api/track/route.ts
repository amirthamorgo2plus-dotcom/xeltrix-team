import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

// Fire-and-forget page-view counter. POST { path }. No auth (public analytics).
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { path?: unknown } | null;
    const path = body?.path;
    if (typeof path !== "string" || path.length === 0 || path.length > 512) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await adminClient().rpc("increment_page_view", { p_path: path });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
