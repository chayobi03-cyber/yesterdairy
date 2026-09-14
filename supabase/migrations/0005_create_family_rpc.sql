-- createFamily previously did INSERT ... RETURNING id against `families`,
-- but the SELECT policy for reading back the row requires an existing
-- family_members row for the caller -- which doesn't exist yet at that
-- point (chicken-and-egg). Postgres surfaces this as the same generic
-- "new row violates row-level security policy" error as a WITH CHECK
-- failure, which is what made it so confusing.
--
-- Wrapping both inserts in one SECURITY DEFINER function sidesteps RLS
-- entirely for this operation (atomic too: no risk of an orphaned family
-- row if the family_members insert fails).
create or replace function create_family(family_name text, member_role text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family_id uuid;
begin
  if member_role not in ('parent', 'child') then
    raise exception 'invalid role: %', member_role;
  end if;

  insert into families (name) values (family_name) returning id into new_family_id;
  insert into family_members (family_id, user_id, role) values (new_family_id, auth.uid(), member_role);

  return new_family_id;
end;
$$;

grant execute on function create_family(text, text) to authenticated;
