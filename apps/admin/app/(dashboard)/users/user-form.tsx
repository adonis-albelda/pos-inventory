"use client";

import { useActionState } from "react";
import { Check, Info, KeyRound, Mail, UserRound } from "lucide-react";
import type { User } from "@double-a/shared-types";
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
          <Select name="role" defaultValue={user?.role ?? "cashier"}>
            <option value="cashier">Cashier</option>
            <option value="admin">Admin</option>
            <option value="device">Terminal</option>
          </Select>
        </Field>
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
      </div>

      <p className="flex items-start gap-2 text-caption text-ink-muted">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Cashiers unlock a terminal with this PIN, with no connection needed. Admins
          sign in to this dashboard with an email and password instead. A terminal is
          enrolled once during setup.
        </span>
      </p>

      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.ok ? (
        <SuccessNote>Saved. Terminals pick this up on their next sync.</SuccessNote>
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
