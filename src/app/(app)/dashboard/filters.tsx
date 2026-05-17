"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function DashboardFilters({
  defaultMonth,
  defaultMember,
  members,
}: {
  defaultMonth: string;
  defaultMember: string;
  members: { id: string; name: string }[];
}) {
  const router = useRouter();

  function update(next: { month?: string; member?: string }) {
    const params = new URLSearchParams();
    const month = next.month ?? defaultMonth;
    const member = next.member ?? defaultMember;
    if (month) params.set("month", month);
    if (member && member !== "all") params.set("member", member);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Month</label>
        <Input
          type="month"
          defaultValue={defaultMonth}
          onChange={(e) => update({ month: e.target.value })}
          className="h-9 w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Member</label>
        <Select
          defaultValue={defaultMember}
          onChange={(e) => update({ member: e.target.value })}
          className="h-9 w-48"
        >
          <option value="all">All members</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
