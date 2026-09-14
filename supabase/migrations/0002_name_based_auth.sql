-- Family members sign up/log in with a display name + password, never an
-- email address. Under the hood we still use Supabase's email/password
-- auth (a random placeholder email is generated at signup), but:
--   1. email_confirmed_at is auto-set so login never blocks on confirmation,
--      regardless of the dashboard "Confirm email" toggle.
--   2. profiles is populated from signup metadata via trigger, so it no
--      longer depends on an active session existing right after signUp().
--   3. login_identities maps a display name -> the placeholder email, so
--      the client can look up the email before calling signInWithPassword.

create table login_identities (
  display_name text primary key,
  email text not null,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table login_identities enable row level security;

create policy "anyone can look up an identity to log in" on login_identities
  for select using (true);

create or replace function auto_confirm_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;

create trigger on_auth_user_before_insert
  before insert on auth.users
  for each row execute function auto_confirm_email();

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_name text := coalesce(new.raw_user_meta_data ->> 'name', 'family');
begin
  insert into public.profiles (id, name) values (new.id, chosen_name);
  insert into public.login_identities (display_name, email, user_id) values (chosen_name, new.email, new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
