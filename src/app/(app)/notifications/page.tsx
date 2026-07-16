import { format } from "date-fns";
import { ist } from "@/lib/ist";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { MarkAllRead } from "./mark-read";

export default async function NotificationsPage() {
  const user = await getUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <MarkAllRead />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent</CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.length === 0 ? (
            <EmptyState
              title="You're all caught up"
              hint="Notifications appear here when tasks come due or follow-ups need attention."
            />
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.map((n) => (
                <li
                  key={n.id}
                  className={`py-3 ${!n.read_at ? "font-medium" : "text-zinc-500"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div>{n.title}</div>
                      {n.body && <p className="text-sm text-zinc-500">{n.body}</p>}
                    </div>
                    <span className="text-xs text-zinc-400">
                      {format(ist(n.created_at), "dd MMM, HH:mm")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
