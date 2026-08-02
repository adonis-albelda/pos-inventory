"use client";

import { useActionState } from "react";
import { LogIn, Lock, Mail } from "lucide-react";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { signIn, type LoginState } from "./actions";

const INITIAL: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email">
        <Input
          icon={Mail}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@business.com"
          required
        />
      </Field>
      <Field label="Password">
        <Input
          icon={Lock}
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </Field>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <Button type="submit" className="w-full" loading={pending} icon={LogIn}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
