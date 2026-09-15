-- Extends 오늘의 색 with a daily "mission" color to hunt for (deterministic
-- by date, not random -- see lib/color-names.ts) and records how close the
-- captured color got. Existing rows (captured before this existed) keep
-- these columns null; the UI treats a null mission_hex as "no mission that
-- day" rather than backfilling one, since the mission is meant to be found
-- live, not assigned after the fact.
alter table daily_colors
  add column mission_hex text check (mission_hex ~ '^#[0-9a-fA-F]{6}$'),
  add column mission_name text,
  add column name text,
  add column match_percent smallint check (match_percent between 0 and 100);
