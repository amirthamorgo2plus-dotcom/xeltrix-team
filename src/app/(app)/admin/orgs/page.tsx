import { redirect } from "next/navigation";
import { format } from "date-fns";
import { isSuperAdmin } from "@/lib/super-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { OrgCreateForm } from "./org-create-form";
import { adminClient } from "@/lib/supabase/admin";

export default async function OrgsAdminPage() {
  if (!(await isSuperAdmin())) redirect("/dashboard");

  const sb = adminClient();
  const [{ data: teams }, { data: members }] = await Promise.all([
    sb.from("teams").select("id, name, created_at").order("created_at", { ascending: false }),
    sb.from("team_members").select("team_id, role").eq("active", true),
  ]);

  const counts = new Map<string, number>();
  const admins = new Map<string, number>();
  (members ?? []).forEach((m) => {
    counts.set(m.team_id, (counts.get(m.team_id) ?? 0) + 1);
    if (m.role === "admin" || m.role === "manager")
      admins.set(m.team_id, (admins.get(m.team_id) ?? 0) + 1);
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
                  <TH right>Members</TH>
                  <TH right>Admins/Mgrs</TH>
                  <TH right>Created</TH>
                </TR>
              </THead>
              <TBody>
                {teams.map((t) => (
                  <TR key={t.id}>
                    <TD className="font-medium">{t.name}</TD>
                    <TD right>{counts.get(t.id) ?? 0}</TD>
                    <TD right>{admins.get(t.id) ?? 0}</TD>
                    <TD right className="text-zinc-500">
                      {t.created_at ? format(new Date(t.created_at), "dd MMM yyyy") : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
