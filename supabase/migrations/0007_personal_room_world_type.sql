-- Each family member picks their own growth-world visual (not a single
-- family-wide choice), shown on their personal "room" page.
alter table profiles add column world_type text not null default 'tree'
  check (world_type in ('tree', 'constellation', 'planet'));
