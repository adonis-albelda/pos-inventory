"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Check,
  Info,
  KeyRound,
  Lock,
  Mail,
  Shield,
  Smartphone,
  UserRound,
} from "lucide-react";
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

function successMessage(role: UserRole): string {
  if (role === "admin") {
    return "Saved. They can sign in to this dashboard with that email and password.";
  }
  if (role === "device") {
    return "Saved. Use this password on the POS when connecting the terminal.";
  }
  return "Saved. Terminals see a new PIN on the next unlock.";
}

function roleDescription(role: UserRole): string {
  if (role === "admin") {
    return "Admins sign in to this dashboard with email and password. They can also unlock a terminal with a PIN if you set one later. Changing a PIN never changes this Auth password.";
  }
  if (role === "device") {
    return "Terminals enroll once with this Auth email and password. That session stays on the device — cashiers then unlock with their own PIN, not this password.";
  }
  return "Cashiers unlock with a PIN against the live server. They have no dashboard login. Disabling sales still lets them unlock, but they cannot complete a sale.";
}

export function UserForm({ user, onDone }: { user?: User; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveCashier, EMPTY_FORM_STATE);
  const [role, setRole] = useState<UserRole>(user?.role ?? "cashier");

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state.ok, onDone]);

  const RoleIcon =
    role === "admin" ? Shield : role === "device" ? Smartphone : UserRound;

  return (
    <form action={action} className="space-y-5">
      {user ? <input type="hidden" name="id" value={user.id} /> : null}

      <div className="flex items-start gap-3 rounded-md border border-border bg-primary-tint px-4 py-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <RoleIcon size={18} strokeWidth={2} />
        </span>
        <p className="text-caption leading-relaxed text-ink-muted">
          {roleDescription(role)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field label="Role" hint="Controls dashboard access, PIN unlock, and terminal enrollment.">
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

        {role === "admin" || role === "device" ? (
          <Field
            label={user ? "New password" : "Password"}
            hint={
              user
                ? "Leave empty to keep the current password. Prefer Reset password in the table for a forced change."
                : role === "admin"
                  ? "Dashboard login — not a cashier PIN."
                  : "POS enrollment password — not a cashier PIN."
            }
          >
            <Input
              icon={Lock}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required={!user}
            />
          </Field>
        ) : null}
      </div>

      {role !== "device" ? (
        <Field
          label="Sales"
          hint="Off = can still unlock a terminal, but cannot complete a sale."
        >
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border border-border bg-surface px-3 text-body">
            <input
              type="checkbox"
              name="can_sell"
              value="true"
              defaultChecked={user?.canSell ?? true}
              className="size-4 accent-primary"
            />
            Allow this person to complete sales
          </label>
        </Field>
      ) : (
        <input type="hidden" name="can_sell" value="true" />
      )}

      {role === "admin" || role === "device" ? (
        <Field
          label="Password policy"
          hint="When checked, they must pick a new password right after signing in."
        >
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border border-border bg-surface px-3 text-body">
            <input
              type="checkbox"
              name="must_change_password"
              value="true"
              defaultChecked={user?.mustChangePassword ?? !user}
              className="size-4 accent-primary"
            />
            Require password change after next login
          </label>
        </Field>
      ) : null}

      <p className="flex items-start gap-2 text-caption text-ink-muted">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Changes reach terminals on their next Sync or Refresh. PIN and Auth
          password stay on separate paths.
        </span>
      </p>

      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.ok ? <SuccessNote>{successMessage(role)}</SuccessNote> : null}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row">
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
