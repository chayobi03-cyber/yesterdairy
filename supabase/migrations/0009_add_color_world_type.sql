-- Adds "색모음집" (color collection) as a fourth growth-world option.
alter table profiles drop constraint profiles_world_type_check;
alter table profiles add constraint profiles_world_type_check
  check (world_type in ('tree', 'constellation', 'planet', 'color'));
