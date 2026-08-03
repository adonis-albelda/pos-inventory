"use client";

import { useActionState } from "react";
import { Check, Lock } from "lucide-react";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { changeOwnPassword, type ChangePasswordState } from "./actions";

const EMPTY: ChangePasswordState = { error: null };

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, EMPTY);

  return (
    <form action={action} className="mt-5 space-y-4">
      <Field label="New password">
        <Input
          icon={Lock}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </Field>
      <Field label="Confirm password">
        <Input
          icon={Lock}
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </Field>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <Button type="submit" loading={pending} icon={Check} className="w-full">
        {pending ? "Saving..." : "Save and continue"}
      </Button>
    </form>
  );
}
