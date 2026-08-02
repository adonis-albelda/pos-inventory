"use client";

import { useState, useTransition } from "react";
import {
  Pencil,
  Shield,
  Smartphone,
  UserCheck,
  UserRound,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@double-a/shared-types";
import { Badge, IconButton, Table, Td, Th } from "@/components/ui";
import { ConfirmDialog, Sheet } from "@/components/overlay";
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
  const [editing, setEditing] = useState<User | null>(null);
  const [toggling, setToggling] = useState<User | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmToggle() {
    if (!toggling) return;
    const form = new FormData();
    form.set("id", toggling.id);
    form.set("is_active", String(!toggling.isActive));
    startTransition(async () => {
      await toggleCashierActive(form);
      setToggling(null);
    });
  }

  return (
    <>
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
            const RoleIcon = ROLE_ICONS[user.role] ?? UserRound;

            return (
              <tr key={user.id} className={user.isActive ? "" : "opacity-60"}>
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
                      icon={Pencil}
                      label="Edit person"
                      onClick={() => setEditing(user)}
                    />
                    <IconButton
                      icon={user.isActive ? UserX : UserCheck}
                      label={user.isActive ? "Deactivate" : "Reactivate"}
                      tone={user.isActive ? "danger" : "neutral"}
                      onClick={() => setToggling(user)}
                    />
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : "Edit person"}
        description="Changes reach terminals on their next sync."
        wide
      >
        {editing ? (
          <UserForm key={editing.id} user={editing} onDone={() => setEditing(null)} />
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        onConfirm={confirmToggle}
        pending={pending}
        title={toggling?.isActive ? "Deactivate person?" : "Reactivate person?"}
        description={
          toggling?.isActive
            ? `${toggling.name} will no longer unlock a terminal or sign in (live check).`
            : `${toggling?.name ?? "This person"} will be able to sign in again.`
        }
        confirmLabel={toggling?.isActive ? "Deactivate" : "Reactivate"}
      />
    </>
  );
}
