"use client";

import { useActionState } from "react";
import { Building2, Lock, Mail, UserRound } from "lucide-react";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { createCompany } from "../../actions";

export function CreateCompanyForm() {
  const [state, action, pending] = useActionState(createCompany, EMPTY_FORM_STATE);

  return (
    <form action={action} className="space-y-5">
      <Field label="Company name">
        <Input icon={Building2} name="name" required />
      </Field>
      <Field label="Admin name">
        <Input icon={UserRound} name="admin_name" required />
      </Field>
      <Field label="Admin email">
        <Input icon={Mail} name="admin_email" type="email" required />
      </Field>
      <Field label="Admin password" hint="They will be asked to change it on first sign-in.">
        <Input
          icon={Lock}
          name="admin_password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </Field>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <Button type="submit" loading={pending}>
        Create company
      </Button>
    </form>
  );
}
