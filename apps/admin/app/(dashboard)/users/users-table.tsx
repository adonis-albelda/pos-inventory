"use client";

import { Fragment, useState } from "react";
import {
  Pencil,
  Shield,
  Smartphone,
  UserCheck,
  UserRound,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@double-a/shared-types";
import { Badge, IconButton, Table, Td, Th } from "@/components/ui";
import { toggleCashierActive } from "./actions";
import { UserForm } from "./user-form";

const ROLE_LABELS: Record<string, string> = {
  cashier: "Cashier",
  admin: "Admin",
  device: "Terminal",
};

const ROLE_ICONS: Record<string, LucideIcon> = {
  cashier: UserRound,
  admin: Shield,
  device: Smartphone,
};

export function UsersTable({ users }: { users: User[] }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <Table>
      <thead>
        <tr>
          <Th>Name</Th>
          <Th>Email</Th>
          <Th>Role</Th>
          <Th>State</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {users.map((user) => {
          const isEditing = editing === user.id;
          const RoleIcon = ROLE_ICONS[user.role] ?? UserRound;

          return (
            <Fragment key={user.id}>
              <tr className={user.isActive ? "" : "opacity-60"}>
                <Td>
                  <span className="flex items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <RoleIcon size={14} strokeWidth={2} />
                    </span>
                    <span className="font-medium">{user.name}</span>
                  </span>
                </Td>
                <Td className="text-ink-muted">{user.email}</Td>
                <Td>{ROLE_LABELS[user.role] ?? user.role}</Td>
                <Td>
                  {user.isActive ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="neutral">Inactive</Badge>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <IconButton
                      icon={isEditing ? X : Pencil}
                      label={isEditing ? "Close editor" : "Edit person"}
                      onClick={() => setEditing(isEditing ? null : user.id)}
                    />
                    <form action={toggleCashierActive}>
                      <input type="hidden" name="id" value={user.id} />
                      <input type="hidden" name="is_active" value={String(!user.isActive)} />
                      <IconButton
                        icon={user.isActive ? UserX : UserCheck}
                        label={user.isActive ? "Deactivate" : "Reactivate"}
                        tone={user.isActive ? "danger" : "neutral"}
                        type="submit"
                      />
                    </form>
                  </div>
                </Td>
              </tr>
              {isEditing ? (
                <tr>
                  <Td colSpan={5} className="border-l-2 border-l-primary bg-paper">
                    <UserForm user={user} onDone={() => setEditing(null)} />
                  </Td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </Table>
  );
}
