import Image from "next/image";
import { ChangePasswordForm } from "./change-password-form";

/** Same deterministic scatter as the login page — kept identical so the two
 * auth screens read as one visual system. */
const PARTICLES = Array.from({ length: 48 }, (_, i) => ({
  left: (i * 97) % 100,
  size: 3 + (i % 4),
  duration: 6 + (i % 7),
  delay: -((i * 3) % 10),
}));

export default function ChangePasswordPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-6 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden motion-safe:block">
        {PARTICLES.map((particle, index) => (
          <span
            key={index}
            style={{
              position: "absolute",
              left: `${particle.left}%`,
              bottom: -20,
              width: particle.size,
              height: particle.size,
              borderRadius: 9999,
              backgroundColor: "var(--color-primary)",
              opacity: 0,
              animationName: "particle-float",
              animationDuration: `${particle.duration}s`,
              animationDelay: `${particle.delay}s`,
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "infinite",
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary-soft">
            <Image src="/logo.png" alt="" width={28} height={28} className="size-7 object-contain" />
          </div>
          <div>
            <h1 className="text-heading-md font-bold text-ink">POSPro</h1>
            <p className="text-caption text-ink-muted">Admin dashboard</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-surface p-8 shadow-lg shadow-ink/5">
          <h2 className="text-heading-lg font-bold text-ink">Choose a new password</h2>
          <p className="mt-2 text-body text-ink-muted">
            Your account requires a password change before you can use the dashboard.
          </p>

          <div className="mt-8">
            <ChangePasswordForm />
          </div>
        </div>

        <p className="mt-8 text-center text-caption text-ink-muted">
          Copyright © 2026 POSPro - All Rights Reserved.
        </p>
      </div>
    </main>
  );
}
