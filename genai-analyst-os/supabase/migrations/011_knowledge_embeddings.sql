alter table public.knowledge_chunks
  add column if not exists embedding vector(384);

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

create index if not exists knowledge_chunks_content_fts_idx
  on public.knowledge_chunks
  using gin (to_tsvector('english', coalesce(content, '')));

create or replace function public.refresh_knowledge_chunk_embeddings(
  p_item_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  -- Intentionally a no-op for projects that have pgvector but not pgai.
  -- Embeddings can be backfilled later from the application layer if needed.
  perform 1
  from public.knowledge_chunks
  where item_id = p_item_id
  limit 1;
end;
$$;

create or replace function public.search_knowledge_chunks_core(
  p_user_id uuid,
  p_notebook_id uuid,
  p_query text,
  p_query_embedding vector(384) default null,
  p_limit integer default 8
)
returns table (
  chunk_id uuid,
  item_id uuid,
  content text,
  semantic_score double precision,
  retrieval_mode text
)
language sql
security definer
as $$
  with query_input as (
    select
      nullif(trim(coalesce(p_query, '')), '') as q,
      p_query_embedding as query_embedding
  ),
  semantic_ranked as (
    select
      kc.id as chunk_id,
      kc.item_id,
      kc.content,
      1 - (kc.embedding <=> qi.query_embedding) as semantic_score,
      'semantic'::text as retrieval_mode
    from public.knowledge_chunks kc
    cross join query_input qi
    where qi.query_embedding is not null
      and kc.user_id = p_user_id
      and kc.notebook_id = p_notebook_id
      and kc.embedding is not null
    order by kc.embedding <=> qi.query_embedding
    limit greatest(1, least(coalesce(p_limit, 8), 20))
  ),
  lexical_ranked as (
    select
      kc.id as chunk_id,
      kc.item_id,
      kc.content,
      ts_rank_cd(
        to_tsvector('english', coalesce(kc.content, '')),
        websearch_to_tsquery('english', qi.q)
      ) as lexical_score
    from public.knowledge_chunks kc
    cross join query_input qi
    where qi.q is not null
      and kc.user_id = p_user_id
      and kc.notebook_id = p_notebook_id
      and to_tsvector('english', coalesce(kc.content, '')) @@ websearch_to_tsquery('english', qi.q)
  ),
  ranked as (
    select * from semantic_ranked
    union all
    select
      lr.chunk_id,
      lr.item_id,
      lr.content,
      lr.lexical_score as semantic_score,
      'lexical'::text as retrieval_mode
    from lexical_ranked lr
    where not exists (select 1 from semantic_ranked)
  )
  select
    ranked.chunk_id,
    ranked.item_id,
    ranked.content,
    ranked.semantic_score,
    ranked.retrieval_mode
  from ranked
  order by ranked.semantic_score desc, ranked.chunk_id
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

create or replace function public.search_knowledge_chunks(
  p_user_id uuid,
  p_notebook_id uuid,
  p_query text,
  p_query_embedding double precision[] default null,
  p_limit integer default 8
)
returns table (
  chunk_id uuid,
  item_id uuid,
  content text,
  semantic_score double precision,
  retrieval_mode text
)
language sql
security definer
as $$
  select *
  from public.search_knowledge_chunks_core(
    p_user_id,
    p_notebook_id,
    p_query,
    case
      when p_query_embedding is null then null
      else ('[' || array_to_string(p_query_embedding, ',') || ']')::vector(384)
    end,
    p_limit
  );
$$;

comment on function public.refresh_knowledge_chunk_embeddings(uuid) is
  'No-op compatibility hook for knowledge ingestion when pgai is unavailable. Embeddings are populated from the application layer.';

comment on function public.search_knowledge_chunks_core(uuid, uuid, text, vector, integer) is
  'Core hybrid retrieval over notebook chunks. Uses pgvector semantic search when p_query_embedding is supplied; otherwise falls back to PostgreSQL full-text search.';

comment on function public.search_knowledge_chunks(uuid, uuid, text, double precision[], integer) is
  'RPC-safe hybrid retrieval wrapper. Accepts a numeric embedding array from the application layer, converts it to vector(384), and falls back to PostgreSQL full-text search when no embedding is supplied.';
