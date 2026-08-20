import { ChangePasswordForm } from "./change-password-form";

export default function ChangePasswordPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/banner.png)" }}
      />
      <div aria-hidden className="absolute inset-0 bg-ink/55" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-md bg-primary font-display text-heading-sm font-bold text-white">
            P
          </span>
          <div>
            <h1 className="text-heading-md font-semibold tracking-tight text-white">
              POSPro
            </h1>
            <p className="text-caption text-white/75">Admin dashboard</p>
          </div>
        </div>

        <div className="mt-6 rounded-md border border-border bg-surface p-6 shadow-xs">
          <h2 className="text-body-lg font-semibold">Choose a new password</h2>
          <p className="mt-1 text-caption text-ink-muted">
            Your account requires a password change before you can use the dashboard.
          </p>
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
