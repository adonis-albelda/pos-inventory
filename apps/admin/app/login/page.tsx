import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Full-bleed shop banner behind the sign-in card. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/banner.png)" }}
      />
      <div aria-hidden className="absolute inset-0 bg-ink/55" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-md bg-primary font-display text-heading-sm font-bold text-white">
            A
          </span>
          <div>
            <h1 className="text-heading-md font-semibold tracking-tight text-white">
              DOUBLE A
            </h1>
            <p className="text-caption text-white/75">Admin dashboard</p>
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

        <p className="mt-4 text-center text-caption text-white/70">
          Cashiers sign in on a terminal with a PIN, not here.
        </p>

        <p className="mt-8 text-center text-caption text-white/60">
          This software is powered by{" "}
          <a
            href="https://doubleadigitalsolutions.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/80 underline decoration-white/25 underline-offset-2 transition-colors hover:text-white hover:decoration-white/50"
          >
            Double A Digital Solutions
          </a>
          .
        </p>
      </div>
    </main>
  );
}
