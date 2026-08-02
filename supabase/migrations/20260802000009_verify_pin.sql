-- Cashier unlock verifies against live pin_hash — never against a local copy.
-- Hashes stay server-side (column still revoked); the device sends the PIN and
-- gets a boolean. Same salt string admin / seed use: double-a-pin:{id}:{pin}.

create or replace function public.verify_pin(p_user_id uuid, p_pin text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  stored text;
  candidate text;
begin
  if public.current_app_role() is distinct from 'device'
     and public.current_app_role() is distinct from 'admin' then
    return false;
  end if;

  if p_pin is null or length(p_pin) < 4 or length(p_pin) > 6 or p_pin !~ '^\d+$' then
    return false;
  end if;

  select u.pin_hash
    into stored
    from public.users u
   where u.id = p_user_id
     and u.is_active
     and u.role in ('cashier', 'admin');

  if stored is null then
    return false;
  end if;

  candidate := encode(
    sha256(convert_to('double-a-pin:' || p_user_id::text || ':' || p_pin, 'UTF8')),
    'hex'
  );

  return candidate = stored;
end;
$$;

grant execute on function public.verify_pin(uuid, text) to authenticated;

comment on function public.verify_pin(uuid, text) is
  'Live cashier unlock check. Device/admin session only; never exposes pin_hash.';
