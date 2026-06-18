import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";

// Server Actions in this route inherit this — gives the sync time to paginate Zoho
export const maxDuration = 60;

import { getMyMembership, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SyncNowButton,
  DisconnectButton,
  ZohoOrgPicker,
  ClearSyncedDataButton,
  ConnectZoho,
} from "./client-buttons";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const m = await getMyMembership();
  const canManage = isAdminOrManager(m?.role);

  const supabase = await createClient();
  const { data: integration } = m
    ? await supabase
        .from("integrations")
        .select("id, provider, expires_at, connected_at, last_synced_at, last_sync_error, config")
        .eq("team_id", m.team_id)
        .eq("provider", "zoho_books")
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-zinc-500">External systems that sync with Xeltrix Team.</p>
      </div>

      {sp.connected === "1" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          Zoho Books connected. First sync will run within 24h, or click <strong>Sync now</strong> below.
        </div>
      )}
      {sp.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          Connection failed: {sp.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Zoho Books
            </span>
            {integration ? <Badge tone="success">Connected</Badge> : <Badge tone="muted">Not connected</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pulls customers (as leads), items (as templates), and invoices (as won opportunities).
            Pushes opportunities marked &quot;won&quot; back to Zoho as draft invoices.
            Sync runs daily at 11:00 PM IST.
          </p>

          {integration && (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-zinc-500">Organization</dt>
              <dd className="font-mono text-xs">{integration.config?.organization_id ?? "—"}</dd>
              <dt className="text-zinc-500">Connected at</dt>
              <dd>{integration.connected_at ? format(new Date(integration.connected_at), "dd MMM, HH:mm") : "—"}</dd>
              <dt className="text-zinc-500">Last sync</dt>
              <dd>
                {integration.last_synced_at
                  ? format(new Date(integration.last_synced_at), "dd MMM, HH:mm")
                  : "Never"}
              </dd>
              {integration.last_sync_error && (
                <>
                  <dt className="text-zinc-500">Last error</dt>
                  <dd className="text-red-600 text-xs">{integration.last_sync_error}</dd>
                </>
              )}
            </dl>
          )}

          {canManage ? (
            <div className="flex flex-col gap-3">
              {integration ? (
                <>
                  <SyncNowButton />
                  <div className="flex flex-wrap items-start gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    <ZohoOrgPicker
                      current={
                        (integration.config as { organization_id?: string } | null)
                          ?.organization_id
                      }
                    />
                    <ClearSyncedDataButton />
                    <DisconnectButton />
                  </div>
                  <p className="text-xs text-zinc-500">
                    Wrong company&apos;s data showing? Your Zoho login may have several
                    organizations. Use <strong>Change Zoho organization</strong> to pick the
                    right one, <strong>Clear synced data</strong> to remove the wrong rows, then{" "}
                    <strong>Sync now</strong>.
                  </p>
                </>
              ) : (
                <ConnectZoho />
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Only admins/managers can connect integrations.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
