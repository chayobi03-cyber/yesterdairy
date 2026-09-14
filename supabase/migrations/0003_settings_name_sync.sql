-- Keep login_identities.display_name in sync whenever a user renames
-- themselves from Settings, so login-by-name keeps working.
create or replace function sync_login_identity_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update login_identities set display_name = new.name where user_id = new.id;
  return new;
end;
$$;

create trigger on_profile_name_updated
  after update of name on profiles
  for each row
  when (old.name is distinct from new.name)
  execute function sync_login_identity_name();
