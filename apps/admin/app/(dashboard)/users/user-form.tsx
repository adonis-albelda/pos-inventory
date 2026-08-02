"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Info, KeyRound, Lock, Mail, UserRound } from "lucide-react";
import type { User, UserRole } from "@double-a/shared-types";
import {
  Button,
  ErrorNote,
  Field,
  Input,
  Select,
  SuccessNote,
} from "@/components/ui";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { saveCashier } from "./actions";

export function UserForm({ user, onDone }: { user?: User; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveCashier, EMPTY_FORM_STATE);
  const [role, setRole] = useState<UserRole>(user?.role ?? "cashier");

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="space-y-4">
      {user ? <input type="hidden" name="id" value={user.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Name">
          <Input icon={UserRound} name="name" defaultValue={user?.name} required />
        </Field>
        <Field label="Email">
          <Input
            icon={Mail}
            name="email"
            type="email"
            defaultValue={user?.email}
            required
          />
        </Field>
        <Field label="Role">
          <Select
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            <option value="cashier">Cashier</option>
            <option value="admin">Admin</option>
            <option value="device">Terminal</option>
          </Select>
        </Field>

        {role === "cashier" ? (
          <Field
            label={user ? "New PIN" : "PIN"}
            hint={user ? "Leave empty to keep the current PIN." : "4 to 6 digits."}
          >
            <Input
              icon={KeyRound}
              name="pin"
              inputMode="numeric"
              pattern="\d{4,6}"
              maxLength={6}
              autoComplete="off"
            />
          </Field>
        ) : null}

        {role === "device" ? (
          <Field
            label={user ? "New password" : "Password"}
            hint={
              user
                ? "Auth password for POS enrollment. Leave empty to keep the current one."
                : "Used when connecting this terminal on the POS — not a cashier PIN."
            }
          >
            <Input
              icon={Lock}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
            />
          </Field>
        ) : null}
      </div>

      <p className="flex items-start gap-2 text-caption text-ink-muted">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Cashiers unlock with a PIN against the live server. Terminals enroll
          with an Auth email and password — changing a cashier PIN never changes
          a terminal password. Admins sign in to this dashboard with email and
          password.
        </span>
      </p>

      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.ok ? (
        <SuccessNote>
          {role === "device"
            ? "Saved. Use this password on the POS when connecting the terminal."
            : "Saved. Terminals see a new PIN on the next unlock."}
        </SuccessNote>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="submit" loading={pending} icon={Check} className="w-full sm:w-auto">
          {pending ? "Saving..." : user ? "Save changes" : "Add person"}
        </Button>
        {onDone ? (
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
