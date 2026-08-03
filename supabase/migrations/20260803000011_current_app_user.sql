-- current_app_user: resolve the signed-in public.users row without selecting
-- auth_user_id (revoked from authenticated). Same pattern as current_app_role().

create or replace function public.current_app_user()
returns table (
  id uuid,
  name text,
  email text,
  role text,
  is_active boolean,
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
