import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HolidayForm } from "./holiday-form";
import { DeleteHolidayButton } from "./delete-button";
import { EmptyState } from "@/components/empty-state";

export default async function HolidaysPage() {
  const m = await getMyMembership();
  const canEdit = isAdminOrManager(m?.role);

  const supabase = await createClient();
  const { data: holidays } = await supabase
    .from("holidays")
    .select("id, date, name, working_allowed, tentative")
    .order("date");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Holidays</h1>
        <p className="text-sm text-zinc-500">
          Closed days for the team. Working an off-day earns comp-off.
        </p>
      </div>

      {canEdit && <HolidayForm />}

      <Card>
        <CardHeader>
          <CardTitle>2026 Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          {!holidays || holidays.length === 0 ? (
            <EmptyState
              title="No holidays yet"
              hint="Run bootstrap_xeltrix() in the Supabase SQL Editor to seed them."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Day</th>
                  <th className="pb-2 pr-4">Holiday</th>
                  <th className="pb-2 pr-4">Status</th>
                  {canEdit && <th className="pb-2">Action</th>}
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => {
                  const d = parseISO(h.date);
                  return (
                    <tr key={h.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="py-2 pr-4">{format(d, "dd MMM yyyy")}</td>
                      <td className="py-2 pr-4 text-zinc-500">{format(d, "EEEE")}</td>
                      <td className="py-2 pr-4 font-medium">{h.name}</td>
                      <td className="py-2 pr-4">
                        {h.tentative ? (
                          <Badge tone="warning">Tentative</Badge>
                        ) : h.working_allowed ? (
                          <Badge tone="info">Working day</Badge>
                        ) : (
                          <Badge tone="muted">Closed</Badge>
                        )}
                      </td>
                      {canEdit && (
                        <td className="py-2">
                          <DeleteHolidayButton id={h.id} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
