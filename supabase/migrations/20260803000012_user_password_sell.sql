-- Password-change gate for dashboard admins, and a sell switch for floor staff.
-- Disabled selling still allows unlock/PIN; only completing a sale is blocked.

alter table public.users
  add column if not exists must_change_password boolean not null default false;

alter table public.users
  add column if not exists can_sell boolean not null default true;

-- Authenticated clients may read the new columns (same pattern as is_active).
revoke all on public.users from authenticated;
grant select (
  id, name, email, role, is_active, can_sell, must_change_password,
  created_at, updated_at
) on public.users to authenticated;
grant insert, update, delete on public.users to authenticated;

-- Return type changed — must drop before recreate.
drop function if exists public.current_app_user();

create function public.current_app_user()
returns table (
  id uuid,
  name text,
  email text,
  role text,
  is_active boolean,
  can_sell boolean,
  must_change_password boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.name,
    u.email,
    u.role,
    u.is_active,
    u.can_sell,
    u.must_change_password,
    u.created_at,
    u.updated_at
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.is_active
  limit 1;
$$;

revoke all on function public.current_app_user() from public;
grant execute on function public.current_app_user() to authenticated;
grant execute on function public.current_app_user() to service_role;

-- Clear the gate after the signed-in user changes their own password.
create or replace function public.clear_must_change_password()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
     set must_change_password = false
   where auth_user_id = auth.uid()
     and is_active;
end;
$$;

revoke all on function public.clear_must_change_password() from public;
grant execute on function public.clear_must_change_password() to authenticated;
grant execute on function public.clear_must_change_password() to service_role;
