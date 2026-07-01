-- Reading List rename brought a real new capability: saving a YouTube video
-- as its own source type (transcript-backed), not just a generic URL note.

alter table public.knowledge_items
  drop constraint if exists knowledge_items_source_type_check;

alter table public.knowledge_items
  add constraint knowledge_items_source_type_check
  check (source_type in ('url', 'note', 'youtube'));
