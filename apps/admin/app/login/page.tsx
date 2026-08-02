import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-md bg-primary font-display text-heading-sm font-bold text-white">
            A
          </span>
          <div>
            <h1 className="text-heading-md font-semibold tracking-tight">DOUBLE A</h1>
            <p className="text-caption text-ink-muted">Admin dashboard</p>
          </div>
        </div>

        <div className="mt-6 rounded-md border border-border bg-surface p-6 shadow-xs">
          <h2 className="text-body-lg font-semibold">Sign in</h2>
          <p className="mt-1 text-caption text-ink-muted">
            Manage products, inventory and sales.
          </p>
          <div className="mt-5">
            <LoginForm next={next ?? "/"} />
          </div>
        </div>

        <p className="mt-4 text-center text-caption text-ink-muted">
          Cashiers sign in on a terminal with a PIN, not here.
        </p>
      </div>
    </main>
  );
}
