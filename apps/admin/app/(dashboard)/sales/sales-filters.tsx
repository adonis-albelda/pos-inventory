"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import type { User } from "@double-a/shared-types";
import { Button, Field, Input, Select } from "@/components/ui";

export function SalesFilters({
  users,
  devices,
}: {
  users: User[];
  devices: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function apply(formData: FormData) {
    const next = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value) next.set(key, value);
    }
    router.push(`/sales?${next.toString()}` as Route);
  }

  return (
    <form action={apply} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Field label="From">
          <Input type="date" name="from" defaultValue={params.get("from") ?? ""} />
        </Field>
        <Field label="To">
          <Input type="date" name="to" defaultValue={params.get("to") ?? ""} />
        </Field>
        <Field label="Cashier">
          <Select name="userId" defaultValue={params.get("userId") ?? ""}>
            <option value="">Everyone</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Terminal">
          <Select name="deviceId" defaultValue={params.get("deviceId") ?? ""}>
            <option value="">All terminals</option>
            {devices.map((device) => (
              <option key={device} value={device}>
                {device}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="State">
          <Select name="status" defaultValue={params.get("status") ?? ""}>
            <option value="">Any</option>
            <option value="completed">Completed</option>
            <option value="voided">Voided</option>
            <option value="refunded">Refunded</option>
          </Select>
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="submit" icon={Search} className="w-full sm:w-auto">
          Apply
        </Button>
        <Button
          type="button"
          variant="secondary"
          icon={X}
          className="w-full sm:w-auto"
          onClick={() => router.push("/sales")}
        >
          Clear
        </Button>
      </div>
    </form>
  );
}
