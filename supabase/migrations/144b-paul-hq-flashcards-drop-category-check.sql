-- 144b: drop the category CHECK constraint from migration 144.
--
-- Why: the original CHECK restricted category to the 9 Atlas topics
-- ('cli','git','web','database','ai','security','code','infra','atlas').
-- A future Paul-curated card with a legitimate category like
-- 'finance', 'legal', 'tax', or 'contracts' would fail to insert —
-- exactly the categories Paul actually cares about as a CFO+GC.
--
-- Enforcement belongs in the app layer (the Flashcards UI derives
-- its filter chip list dynamically from rendered cards), not the DB.
--
-- Rollback: recreate the original constraint
--   alter table public.paul_hq_flashcards
--     add constraint paul_hq_flashcards_category_check
--     check (category is null or category in (
--       'cli','git','web','database','ai','security','code','infra','atlas'
--     ));

begin;

alter table public.paul_hq_flashcards
  drop constraint if exists paul_hq_flashcards_category_check;

commit;
