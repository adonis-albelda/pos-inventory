-- Seed 1 of 2 — accounts.
--
-- Run this before 02_catalog.sql, in the Supabase SQL editor or via psql.
-- Safe to run more than once: every statement is idempotent.
--
-- PREREQUISITE. Auth users cannot be created from SQL, so create these in
-- Authentication - Users first, with "Auto Confirm User" ticked:
--   * your own email          -> logs into apps/admin as the shop admin
--   * terminal-1@shop.local   -> terminal account; admin picks it during POS setup
--   * superadmin email        -> or run `pnpm create-superadmin` instead
-- Then edit the email literals below to match, and run.
--
-- Tenancy: the companies migration wraps the existing shop as company 1.
-- These inserts attach to that first company. Superadmin has company_id null.
--
-- Cashiers are different: they are not auth users at all. They are
-- public.users rows with a PIN hash; unlock calls live verify_pin().
-- Section 3 creates two of them.

-- ---------------------------------------------------------------------------
-- 1. Admin — the dashboard login (company 1)
-- ---------------------------------------------------------------------------
insert into public.users (name, email, role, auth_user_id, is_active, company_id)
select 'Nom Albelda',                     -- EDIT: display name
       au.email,
       'admin',
       au.id,
       true,
       (select id from public.companies order by created_at asc limit 1)
  from auth.users au
 where au.email = 'robertoalbeldac@gmail.com'       -- EDIT: must match the auth user
on conflict (auth_user_id) do update
   set name         = excluded.name,
       role         = 'admin',
       auth_user_id = excluded.auth_user_id,
       is_active    = true,
       company_id   = coalesce(public.users.company_id, excluded.company_id);

-- ---------------------------------------------------------------------------
-- 2. Terminal — optional. One row per POS device, role 'device'.
--    RLS lets 'device' and 'admin' push sales, and POS setup accepts either, so
--    a shop can enroll a tablet on the admin login above and skip this. Create a
--    device account when terminals should not hold the admin password.
-- ---------------------------------------------------------------------------
insert into public.users (name, email, role, auth_user_id, is_active, company_id)
select 'Counter 1',                            -- EDIT: display name
       au.email,
       'device',
       au.id,
       true,
       (select id from public.companies order by created_at asc limit 1)
  from auth.users au
 where au.email = 'terminal-1@shop.local'      -- EDIT: must match the auth user
on conflict (auth_user_id) do update
   set name         = excluded.name,
       role         = 'device',
       auth_user_id = excluded.auth_user_id,
       is_active    = true,
       company_id   = coalesce(public.users.company_id, excluded.company_id);

-- Fail loudly here rather than at a login screen later. current_app_role()
-- resolves through auth_user_id, so a row with a null one can never log in.
do $$
begin
  if not exists (
    select 1 from public.users where role = 'admin' and auth_user_id is not null
  ) then
    raise exception
      'No admin linked. Create the auth user in Authentication - Users, then set the email in section 1.';
  end if;

  -- Not fatal: POS setup also accepts the admin login.
  if not exists (
    select 1 from public.users where role = 'device' and auth_user_id is not null
  ) then
    raise notice
      'No terminal account linked. Terminals will enroll with the admin login until you create one (section 2).';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Cashiers — no auth account, just a PIN hash for live verify_pin unlock.
--    email is required by the schema but never used to authenticate, so a
--    .local placeholder is fine.
-- ---------------------------------------------------------------------------
insert into public.users (name, email, role, is_active, company_id)
select v.name, v.email, 'cashier', true,
       (select id from public.companies order by created_at asc limit 1)
  from (values
          ('Maria Santos', 'maria@shop.local'),
          ('Jun Reyes',    'jun@shop.local')
       ) as v(name, email)
 where not exists (
   select 1 from public.users u where lower(u.email) = lower(v.email)
 );

-- The hash must match pinHashInput() in packages/shared-types/src/auth.ts:
-- sha256('double-a-pin:<user id>:<pin>'), lowercase hex. The id is part of the
-- input, which is why this cannot be a precomputed literal.
--
-- sha256(bytea) is core Postgres 11+, so this needs no extension.
-- Guarded on pin_hash is null so re-running never overwrites a PIN that was
-- changed from the dashboard afterwards.
update public.users
   set pin_hash = encode(
         sha256(convert_to('double-a-pin:' || id::text || ':' || '1234', 'UTF8')),
         'hex'
       )
 where role = 'cashier'
   and pin_hash is null
   and email in ('maria@shop.local', 'jun@shop.local');

-- ---------------------------------------------------------------------------
-- 4. Superadmin — prefer `pnpm create-superadmin` (creates Auth + this row).
--    SQL below is only if the Auth user already exists and you want to link it
--    by hand. Does not overwrite the shop admin.
-- ---------------------------------------------------------------------------
insert into public.users (name, email, role, auth_user_id, is_active, company_id)
select 'Platform',                             -- EDIT: display name
       au.email,
       'superadmin',
       au.id,
       true,
       null
  from auth.users au
 where au.email = 'superadmin@doubleadigitalsolutions.com'  -- EDIT: must match the auth user
on conflict (auth_user_id) do update
   set name         = excluded.name,
       role         = 'superadmin',
       auth_user_id = excluded.auth_user_id,
       is_active    = true,
       company_id   = null;

-- ---------------------------------------------------------------------------
-- 5. Verify
-- ---------------------------------------------------------------------------
select role,
       name,
       email,
       company_id is not null as has_company,
       auth_user_id is not null as can_log_in,
       pin_hash is not null     as has_pin
  from public.users
 order by role, name;
