-- Seed 1 of 2 — accounts.
--
-- Run this before 02_catalog.sql, in the Supabase SQL editor or via psql.
-- Safe to run more than once: every statement is idempotent.
--
-- PREREQUISITE. Auth users cannot be created from SQL, so create these two in
-- Authentication - Users first, with "Auto Confirm User" ticked:
--   * your own email          -> logs into apps/admin
--   * terminal-1@shop.local   -> what apps/mobile signs in as during setup
-- Then edit the two email literals below to match, and run.
--
-- Cashiers are different: they are not auth users at all. They are rows here
-- with a PIN hash, unlocked entirely offline. Section 3 creates two of them.

-- ---------------------------------------------------------------------------
-- 1. Admin — the dashboard login
-- ---------------------------------------------------------------------------
insert into public.users (name, email, role, auth_user_id, is_active)
select 'Nom Albelda',                     -- EDIT: display name
       au.email,
       'admin',
       au.id,
       true
  from auth.users au
 where au.email = 'robertoalbeldac@gmail.com'       -- EDIT: must match the auth user
on conflict (email) do update
   set name         = excluded.name,
       role         = 'admin',
       auth_user_id = excluded.auth_user_id,
       is_active    = true;

-- ---------------------------------------------------------------------------
-- 2. Terminal — one row per POS device, role 'device'.
--    RLS only lets 'device' and 'admin' push sales, so a terminal without a
--    row here can authenticate and still have every sync rejected.
-- ---------------------------------------------------------------------------
insert into public.users (name, email, role, auth_user_id, is_active)
select 'Counter 1',                            -- EDIT: display name
       au.email,
       'device',
       au.id,
       true
  from auth.users au
 where au.email = 'terminal-1@shop.local'      -- EDIT: must match the auth user
on conflict (email) do update
   set name         = excluded.name,
       role         = 'device',
       auth_user_id = excluded.auth_user_id,
       is_active    = true;

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

  if not exists (
    select 1 from public.users where role = 'device' and auth_user_id is not null
  ) then
    raise exception
      'No terminal linked. Create the auth user in Authentication - Users, then set the email in section 2.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Cashiers — no auth account, just a PIN hash for the offline shift lock.
--    email is required by the schema but never used to authenticate, so a
--    .local placeholder is fine.
-- ---------------------------------------------------------------------------
insert into public.users (name, email, role, is_active)
values ('Maria Santos', 'maria@shop.local', 'cashier', true),
       ('Jun Reyes',    'jun@shop.local',   'cashier', true)
on conflict (email) do update
   set name      = excluded.name,
       role      = 'cashier',
       is_active = true;

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
-- 4. Verify
-- ---------------------------------------------------------------------------
select role,
       name,
       email,
       auth_user_id is not null as can_log_in,
       pin_hash is not null     as has_pin
  from public.users
 order by role, name;
