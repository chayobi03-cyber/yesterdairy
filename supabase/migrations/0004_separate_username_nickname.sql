-- Split "login id" from "display nickname". Previously login_identities.
-- display_name doubled as both the login credential and the name shown in
-- the family feed, so renaming yourself would change your login id too.

alter table login_identities rename column display_name to username;

-- nickname changes should no longer touch the login id
drop trigger if exists on_profile_name_updated on profiles;
drop function if exists sync_login_identity_name();

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_username text := coalesce(new.raw_user_meta_data ->> 'username', 'family_' || substr(new.id::text, 1, 8));
  chosen_nickname text := coalesce(new.raw_user_meta_data ->> 'name', chosen_username);
begin
  insert into public.profiles (id, name) values (new.id, chosen_nickname);
  insert into public.login_identities (username, email, user_id) values (chosen_username, new.email, new.id);
  return new;
end;
$$;
