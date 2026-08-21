import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { LoginForm } from "./login-form";
import { RotatingTagline } from "./rotating-tagline";

const TAGLINES = [
  "Run your store smarter, from the counter to the back office.",
  "One system for every terminal, every shift, every sale.",
  "Sell offline. Sync when you're ready. Never lose a sale.",
  "Know your margins the moment a sale is rung up.",
  "Stock, suppliers, and cashiers — one dashboard.",
];

const FEATURES = [
  "Real-time sales tracking across every terminal",
  "Inventory that updates itself as stock moves",
  "Cashier accounts, PIN unlock, and shift history",
  "Bluetooth printer support for instant receipts",
  "Custom receipt layout, footer, and branding",
  "Voice search to find and add products hands-free",
  "Reports and margins, always up to date",
  "Purchase orders and supplier payment terms",
  "Customer accounts with delivery tracking",
  "Expense logging and true net profit, not just gross",
  "Runs the floor even when the internet doesn't",
];

/** Deterministic scatter (index run through a modulo, not Math.random()) —
 * same particle field every render, no hydration-mismatch risk, still reads
 * as organic since 97 and 100 share no factors. */
const PARTICLES = Array.from({ length: 48 }, (_, i) => ({
  left: (i * 97) % 100,
  size: 3 + (i % 4),
  duration: 6 + (i % 7),
  delay: -((i * 3) % 10),
}));

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="relative flex min-h-screen bg-paper">
      {/* Left — brand panel with feature highlights, 60% wide. Hidden below lg: the form is what matters on a phone.
          Straight edge, flat bg-primary — the wave-seam experiment is retired. */}
      <div className="relative hidden w-[55%] flex-col justify-between overflow-hidden bg-primary p-12 lg:flex">
        {/* Soft floating accents — flat color alone read a little bare next to
            the elevated card on the right, this gives the panel its own depth. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 -left-24 size-72 rounded-full bg-accent/20 blur-3xl"
        />

        {/* Same drifting-dot field as the right column, white against the
            green instead of primary against paper. */}
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
                backgroundColor: "#ffffff",
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

        <div className="relative space-y-4 pb-0">
          <div className="motion-safe:animate-feature-in flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-white shadow-sm">
              <Image src="/logo.png" alt="" width={28} height={28} className="size-7 object-contain" />
            </div>
            <span className="font-display text-heading-sm font-bold text-white">POSPro</span>
          </div>
          <div className="max-w-md space-y-14">
            <RotatingTagline lines={TAGLINES} />
            <div className="relative max-w-md space-y-3 mt-4">
              <ul className="space-y-3">
                {FEATURES.map((feature, index) => (
                  <li
                    key={feature}
                    className="motion-safe:animate-feature-in flex items-start gap-3"
                    style={{ animationDelay: `${120 + index * 90}ms` }}
                  >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                      <CheckCircle2 className="size-3.5 text-white" />
                    </span>
                    <span className="text-body-lg text-white/90">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="relative text-caption text-white/60">
          Copyright © 2026 POSPro - All Rights Reserved.
        </p>
      </div>

      {/* Right — the form, 45% wide, a proper elevated card instead of sitting bare on the paper. */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-paper px-6 py-12 lg:w-[45%] lg:flex-none">
        {/* Slow-drifting dots, hidden entirely under prefers-reduced-motion
            rather than shown frozen mid-flight. */}
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
            <h2 className="text-heading-lg font-bold text-ink">Sign in</h2>
            <p className="mt-2 text-body text-ink-muted">
              Everything your store needs to sell and track inventory.
            </p>

            <div className="mt-8">
              <LoginForm next={next ?? "/"} />
            </div>

            <p className="mt-6 text-center text-caption text-ink-muted">
              Cashiers sign in on a terminal with a PIN, not here.
            </p>
          </div>

          <p className="mt-8 text-center text-caption text-ink-muted">
            Copyright © 2026 POSPro - All Rights Reserved.
          </p>
        </div>
      </div>
    </main>
  );
}
