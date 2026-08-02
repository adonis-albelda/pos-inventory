# Supabase setup

Postgres here is the single source of truth for both apps. Run these once per environment.

## 1. Create the project

Create a project at [supabase.com](https://supabase.com), then copy the URL and anon key into
`.env.local` files (see `.env.example` at the repo root).

## 2. Apply migrations

With the CLI:

```bash
pnpm dlx supabase link --project-ref <your-project-ref>
pnpm dlx supabase db push
```

Without the CLI, paste each file in `supabase/migrations/` into the SQL editor, in filename
order:

1. `20260801000001_init.sql` — tables, indexes, `updated_at` triggers
2. `20260801000002_inventory.sql` — stock triggers, oversold/reconciliation views, `adjust_stock()`
3. `20260801000003_rls.sql` — row level security, role helpers, `cashier_pins()`
4. `20260801000004_hardware.sql` — nested categories, supplier cost, units, barcode, bulk price, reorder point, sale-line list/cost prices
5. `20260801000005_reports.sql` — profit, top products, discounts, cashier/device, valuation, dead stock, reorder view
6. `20260801000006_sale_customer.sql` — optional customer name, address and contact on a sale
7. later migrations — store settings, customers/paid/delivery/markup, `verify_pin()`, expenses

## 3. Create the auth users

Auth users cannot be created from SQL, so make these two in **Authentication - Users**, with
_Auto Confirm User_ ticked:

| Email                     | What it is                                                  |
| ------------------------- | ----------------------------------------------------------- |
| your own email            | logs into `apps/admin`                                      |
| `terminal-1@shop.local`   | what `apps/mobile` signs in as, once, during device setup    |

Every device authenticates once and never again — the session is persisted on device, so later
syncs need no login. Add one auth user per extra terminal.

Cashiers are **not** auth users. They are rows in `public.users` with role `cashier` and a
PIN hash. Unlock calls live `verify_pin()` — the device never stores hashes for login.

## 4. Run the seeders

`supabase/seeds/01_accounts.sql` links those auth users to `public.users` rows and creates two
demo cashiers with a PIN. Edit the two email literals at the top to match what you just created,
then run both files in order — SQL editor, or:

```bash
psql "<connection string from Project Settings - Database>" \
  -v ON_ERROR_STOP=1 \
  -f supabase/seeds/01_accounts.sql \
  -f supabase/seeds/02_catalog.sql
```

1. `01_accounts.sql` — admin, terminal, two cashiers with PIN `1234`
2. `02_catalog.sql` — nested hardware categories, ~30 hardware products with supplier cost, and opening stock (optional)

Both are idempotent, so re-running changes nothing. `01_accounts.sql` aborts with a readable
error if the auth users are missing, rather than leaving you to find out at the login screen.
Re-running `02_catalog.sql` against a database that still has the old grocery demo soft-retires
those SKUs so they no longer show on the POS.

The demo PIN is shared across both cashiers, which defeats the point of knowing who rang up a
sale — set a real one per cashier from the dashboard before this touches a real shop.

## 5. Regenerate types after any schema change

```bash
SUPABASE_PROJECT_ID=<your-project-ref> pnpm db:types
```

Both apps import those types from `packages/supabase`, so regenerating is what keeps admin and
mobile from drifting apart.
