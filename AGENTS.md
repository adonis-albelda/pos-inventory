# Project Context — DOUBLE A POS & Inventory System

Read this file fully before making changes. It defines the architecture, business rules,
and conventions this project must follow. If a change conflicts with something here,
flag it explicitly rather than silently deviating.

---

## What this project is

A POS and inventory system made of two apps in one Turborepo monorepo, sharing one
Supabase (Postgres) backend:

- **`apps/admin`** — Next.js web dashboard. Always-online. Used by the business owner/managers
  to manage products, prices, inventory, users, and view sales history/reports.
- **`apps/mobile`** — React Native (Expo) POS app. Used by cashiers on the shop floor.
  Designed to work fully offline, with a local SQLite database, synced to Supabase
  **manually** via a button — never automatically.

**Golden rule: Supabase is the single source of truth for everything** — products, prices,
inventory levels, sales history, users. The mobile app's local SQLite database is a
disposable working copy, not a second source of truth.

---

## Monorepo structure

```
apps/
  admin/     Next.js — online-only dashboard
  mobile/    React Native (Expo) — offline-capable POS
packages/
  supabase/         Shared Supabase client + generated DB types
  shared-types/      Shared TS interfaces (Product, Sale, SaleItem, InventoryMovement, User)
  ui/                Shared UI primitives where feasible (design tokens, cross-platform where possible)
  config-eslint/
  config-typescript/
```

**Rules for where code goes:**
- If it's a TypeScript type, a Supabase query, or a business-logic function with no
  platform dependency → belongs in `packages/`, imported by both apps.
- If it's Next.js-specific (server components, API routes, `app/` router conventions) →
  stays in `apps/admin`.
- If it's React Native/Expo-specific (native modules, `expo-sqlite`, printer integration) →
  stays in `apps/mobile`.
- Never duplicate a type or a Supabase query definition across both apps — that's what
  `packages/shared-types` and `packages/supabase` are for. Type drift between the two apps
  is the #1 risk in this project, since mobile writes the same tables admin reads.

**Package manager:** pnpm workspaces. Use `pnpm --filter <app> <command>` to run a command
scoped to one app (e.g., `pnpm --filter mobile start`).

**Known gotcha:** Metro (React Native's bundler) does not resolve monorepo packages by
default. `apps/mobile/metro.config.js` must be configured to watch the workspace root and
resolve `node_modules` from the repo root, not just its own folder.

---

## Business logic rules (do not "fix" these — they are intentional)

### 1. Sync is manual, one button, two steps, in order
The mobile app has exactly one sync action:
1. **Push** — upload local `sales`/`sale_items` where `sync_status = 'pending'` to Supabase.
   If this fails, stop — do not proceed to pull.
2. **Pull** — fetch products/users/inventory from Supabase where `updated_at > last_synced_at`,
   overwrite local rows, update `last_synced_at`.

There is no auto-sync on reconnect, no background sync, no real-time subscriptions on mobile.
The UI must always show a "Last synced: X ago" indicator.

Alongside it there is a second, pull-only **Refresh** action (`runPullOnly`), for taking a
price or product change mid-shift without sending sales. It skips the push step deliberately;
pending sales stay pending and still go out on the next Sync. Sync remains the only way sales
leave the device. Both live in the `SyncBar`, which sits on the **Sync tab**, and Refresh is
repeated on the unlock screen — a terminal locked with a stale PIN hash has no other way to
catch up.

The *state* is not on a tab. `StoreHeader` sits above the tabs on every POS screen and carries
"Last synced: X ago", the pending count, and the same teal/amber/terracotta colouring the bar
uses, as a chip that taps through to the Sync tab. A cashier must never have to go looking to
find out this terminal is behind. The chip navigates and does not itself sync: there is still
exactly one button that sends sales.

A pull always finishes with `StoreHeader` and the Sync tab still mounted and focused. Writing to
SQLite is therefore only half the job: any component holding master data in state must re-read
it. `useSync()` exposes `dataVersion`, bumped after every successful pull — put it in the
dependency list beside the load function. `useFocusEffect` alone is not enough, since focus
never changes.

One exception to "only what changed since `last_synced_at`": the category tree is fetched whole
every pull and replaces the local `categories` table outright. A `updated_at >` query cannot
return a row that was deleted, so incremental pulls would leave retired categories on the device
forever. The table is a few dozen rows; correctness is worth the round trip.

### 2. Inventory is event-sourced, not directly edited
The mobile app never writes directly to a `stock_quantity` field. Offline sales are recorded
as individual events (`sale_items` rows with client-generated UUIDs). The **local, on-device
"available stock"** shown to the cashier is a computed estimate:

```
estimated_stock = last_synced_stock_quantity - sum(pending local sales for that product)
```

This is a display estimate only, not a value ever written back to Supabase directly. Actual
inventory decrements happen server-side in Supabase (via a Postgres trigger/function) when
sale data is pushed. Oversell (two offline devices selling the last unit) is an accepted,
known tradeoff of this design — handled by post-sync flagging, not prevented.

### 3. IDs are client-generated UUIDs for anything created offline
`sales` and related records generate their `id` on-device (UUID) at creation time, not via
Supabase's `gen_random_uuid()` default. This is required so offline-created records never
collide with each other or the server on sync, and so a sale is fully valid before it's ever
synced.

### 4. Nothing about completing a sale or printing a receipt should ever wait on network state
Both must work identically offline and online, with zero perceptible difference to the cashier.

### 5. Admin app has no offline mode
`apps/admin` assumes constant connectivity. Do not add offline handling, local caching, or
sync logic there — that complexity belongs only to `apps/mobile`.

### 6. Supplier cost is snapshotted on every sale line
`products.cost_price` is what the supplier charges today. Every `sale_items` row carries its
own `unit_cost`, written at the moment of sale. Reporting always reads `sale_items.unit_cost`,
never joins back to the product — a supplier raising their price must not rewrite last
quarter's profit. Cost is pulled to the POS so the attendant can see the floor before
discounting; it is never written from the device.

### 7. Counter discounts are free, logged, and reportable
An attendant may override the selling price of any cart line to any amount, including below
cost. There is no PIN gate and no hard cap. Every override is recorded as the gap between
`sale_items.list_price` (the shelf price) and `sale_items.unit_price` (what was charged), and
surfaces in the discount audit report. Selling below cost is called out as a warning on the
POS and as a flag on the report — never blocked.

### 8. Stock only ever moves through `inventory_movements`
`products.stock_quantity` has exactly one writer: the `apply_inventory_movement()` trigger.
CSV import, product forms, and the POS never write it. Opening stock, restocks, adjustments,
and sale decrements all insert a movement row.

### 9. Categories are a tree; `products.category` is a derived path
The real link is `products.category_id`. A Postgres trigger keeps `products.category` filled
with the flattened path (e.g. `Plumbing / Pipes`) so receipts, CSV exports, and the POS never
have to walk the tree. Apps write `category_id` only.

### 10. Who the shop is lives in `store_settings` — one row, admin-owned
Name, logo, address, phone and receipt footer are a single row keyed on a boolean pinned to
`true`, edited only under admin's Settings page. The POS pulls it whole on every sync, like the
category tree, and never writes it. Nothing on a device may hardcode the shop name: read it
through `useStoreSettings()`, which falls back to `DEFAULT_STORE_SETTINGS` before the first pull.
The logo is a public URL in the `store-logos` bucket, so a terminal that has never been online
shows the initial instead — a header must not wait on a fetch. Filtering by category is done on ids —
the path text on a product survives the category being deleted.

### 10. Customer details on a sale are optional, free text, and snapshotted
`sales.customer_name`, `customer_address` and `customer_contact` are nullable and null on most
sales. They exist for a delivery or a contractor's account, are typed at the counter, and are
never a required step before completing a sale. There is deliberately no customer table: a
foreign key would put a server-owned row in the middle of a sale a device creates offline, and
snapshotted text keeps a printed receipt readable the same way in a year. Normalise with
`normaliseCustomerDetails()` (trim, blank to null, cap at `CUSTOMER_FIELD_MAX_LENGTH`) before
writing, so the server's length check never rejects a pushed batch.

---

## Commands

```
pnpm install                    # install all workspace dependencies
pnpm dev                        # run all apps in dev mode (turbo)
pnpm --filter admin dev         # run only the Next.js admin app
pnpm --filter mobile start      # run only the Expo mobile app
pnpm build                      # build all apps (turbo)
pnpm lint                       # lint all packages/apps
pnpm type-check                 # type-check all packages/apps
```

---

## Design & UX

See `design-system.md` for full visual/interaction guidelines. In short:
- Admin (web) can be denser, richer in hover/interaction states.
- Mobile (POS) needs large tap targets, high contrast for shop-floor lighting, and an
  optimistic/instant feel — never block the UI on a network call.
- Follow the token system in `design-system.md` exactly rather than defaulting to generic
  component-library styling.
