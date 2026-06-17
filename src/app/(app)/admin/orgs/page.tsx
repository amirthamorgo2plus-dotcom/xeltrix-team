import { redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSuperAdmin } from "@/lib/super-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { OrgCreateForm } from "./org-create-form";
import { OrgRowActions } from "./org-row-actions";
import { adminClient } from "@/lib/supabase/admin";

function fmtBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

type UserInfo = { email: string | null; lastSignIn: string | null };

// Map auth user id -> email + last_sign_in_at (paginated; small user base).
async function usersById(sb: SupabaseClient): Promise<Map<string, UserInfo>> {
  const map = new Map<string, UserInfo>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users)
      map.set(u.id, { email: u.email ?? null, lastSignIn: u.last_sign_in_at ?? null });
    if (data.users.length < 1000) break;
  }
  return map;
}

// Storage bytes per uploader (owner). Null if the storage schema isn't readable.
async function storageBytesByUser(
  sb: SupabaseClient
): Promise<Map<string, number> | null> {
  const { data, error } = await sb
    .schema("storage")
    .from("objects")
    .select("owner, metadata");
  if (error || !data) return null;
  const map = new Map<string, number>();
  for (const o of data as { owner: string | null; metadata: { size?: number } | null }[]) {
    if (!o.owner) continue;
    const size = Number(o.metadata?.size ?? 0);
    map.set(o.owner, (map.get(o.owner) ?? 0) + size);
  }
  return map;
}

export default async function OrgsAdminPage() {
  if (!(await isSuperAdmin())) redirect("/dashboard");

  const sb = adminClient();
  const [{ data: teams }, { data: members }, users, storageByUser] = await Promise.all([
    sb.from("teams").select("id, name, created_at").order("created_at", { ascending: false }),
    sb.from("team_members").select("team_id, role, user_id").eq("active", true),
    usersById(sb),
    storageBytesByUser(sb),
  ]);

  const counts = new Map<string, number>();
  const admins = new Map<string, number>();
  const lastLogin = new Map<string, number>(); // team -> latest sign-in (ms)
  const storage = new Map<string, number>(); // team -> bytes
  const adminEmails = new Map<string, string[]>(); // team -> admin/manager emails
  (members ?? []).forEach((m) => {
    counts.set(m.team_id, (counts.get(m.team_id) ?? 0) + 1);
    const info = users.get(m.user_id);
    if (m.role === "admin" || m.role === "manager") {
      admins.set(m.team_id, (admins.get(m.team_id) ?? 0) + 1);
      if (info?.email) {
        const arr = adminEmails.get(m.team_id) ?? [];
        arr.push(info.email);
        adminEmails.set(m.team_id, arr);
      }
    }
    if (info?.lastSignIn) {
      const ms = new Date(info.lastSignIn).getTime();
      if (ms > (lastLogin.get(m.team_id) ?? 0)) lastLogin.set(m.team_id, ms);
    }
    if (storageByUser) {
      const b = storageByUser.get(m.user_id) ?? 0;
      storage.set(m.team_id, (storage.get(m.team_id) ?? 0) + b);
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <p className="text-sm text-zinc-500">
          Super-admin only. Provision new organizations and their first admin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create organization</CardTitle>
        </CardHeader>
        <CardContent>
          <OrgCreateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All organizations ({teams?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!teams || teams.length === 0 ? (
            <EmptyState title="No organizations yet" />
          ) : (
            <Table>
              <THead>
                <TR hover={false}>
                  <TH>Organization</TH>
                  <TH>Admin</TH>
                  <TH right>Members</TH>
                  <TH right>Admins/Mgrs</TH>
                  <TH right>Last login</TH>
                  <TH right>Storage</TH>
                  <TH right>Created</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {teams.map((t) => {
                  const ll = lastLogin.get(t.id);
                  const emails = adminEmails.get(t.id) ?? [];
                  return (
                    <TR key={t.id}>
                      <TD className="font-medium">{t.name}</TD>
                      <TD className="text-zinc-500">
                        {emails.length === 0 ? (
                          "—"
                        ) : (
                          <>
                            {emails[0]}
                            {emails.length > 1 && (
                              <span className="text-zinc-400"> +{emails.length - 1}</span>
                            )}
                          </>
                        )}
                      </TD>
                      <TD right>{counts.get(t.id) ?? 0}</TD>
                      <TD right>{admins.get(t.id) ?? 0}</TD>
                      <TD right className="text-zinc-500">
                        {ll ? `${formatDistanceToNow(new Date(ll))} ago` : "never"}
                      </TD>
                      <TD right className="text-zinc-500">
                        {storageByUser ? fmtBytes(storage.get(t.id) ?? 0) : "—"}
                      </TD>
                      <TD right className="text-zinc-500">
                        {t.created_at ? format(new Date(t.created_at), "dd MMM yyyy") : "—"}
                      </TD>
                      <TD>
                        <OrgRowActions teamId={t.id} name={t.name} adminEmails={emails} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
