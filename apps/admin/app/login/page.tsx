import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { LoginForm } from "./login-form";

const FEATURES = [
  "Real-time sales tracking across every terminal",
  "Inventory that updates itself as stock moves",
  "Cashier accounts, PIN unlock, and shift history",
  "Bluetooth printer support for instant receipts",
  "Custom receipt layout, footer, and branding",
  "Voice search to find and add products hands-free",
  "Reports and margins, always up to date",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen">
      {/* Left — brand panel with feature highlights, 60% wide. Hidden below lg: the form is what matters on a phone. */}
      <div className="relative hidden w-3/5 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-primary-dark p-12 lg:flex">
        <div className="motion-safe:animate-feature-in flex items-center gap-3">
          {/* White tile behind the mark — the logo's own colour reads as almost invisible directly on the teal gradient. */}
          <div className="flex size-11 items-center justify-center rounded-xl bg-white shadow-sm">
            <Image src="/logo.png" alt="" width={28} height={28} className="size-7 object-contain" />
          </div>
          <span className="font-display text-heading-sm font-bold text-white">POSPro</span>
        </div>

        <div className="max-w-md space-y-8">
          <h2 className="motion-safe:animate-feature-in text-heading-lg font-bold leading-tight text-white">
            Run your store smarter, from the counter to the back office.
          </h2>
          <ul className="space-y-4">
            {FEATURES.map((feature, index) => (
              <li
                key={feature}
                className="motion-safe:animate-feature-in flex items-start gap-3"
                style={{ animationDelay: `${120 + index * 90}ms` }}
              >
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-white/80" />
                <span className="text-body-lg text-white/90">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-caption text-white/60">Copyright © 2026 POSPro - All Rights Reserved.</p>
      </div>

      {/* Right — the form, 40% wide, a proper elevated card instead of sitting bare on the paper. */}
      <div className="flex flex-1 items-center justify-center bg-paper px-6 py-12 lg:w-2/5 lg:flex-none">
        <div className="w-full max-w-sm">
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
