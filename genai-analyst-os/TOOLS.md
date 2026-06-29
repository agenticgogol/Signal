# Tools Specification

All tools are implemented twice: once as Deno/TypeScript inside Supabase Edge Functions (production), and once as Python in `src/tools/` (local evals and scripts). The signatures below define the logical interface shared by both implementations.

---

## crawl_sources

- **Description**: Fetch RSS/HTML content from all sources belonging to a user and return new article objects not yet seen in the `articles` table.
- **Input schema**:
  | Param | Type | Required | Description |
  |-------|------|----------|-------------|
  | `user_id` | `string (uuid)` | required | The user whose sources to crawl |
  | `sources` | `UserSource[]` | required | Pre-fetched list of `user_sources` rows (url, rss_url, source_tier) |
- **Output schema**:
  ```
  RawArticle[]
  {
    url: string           // canonical article URL
    title: string
    full_text: string     // cleaned body text, HTML stripped
    published_at: string  // ISO 8601 from feed <pubDate> or <updated>
    source_id: string     // uuid of the user_sources row
  }
  ```
- **Mock behaviour**: Returns 3 hardcoded `RawArticle` objects from `data/mock_articles.json` regardless of `user_id` or sources input.
- **Error cases**:
  - Source fetch times out (>10s): skip that source, log `{ source_id, error: "timeout" }`, continue
  - RSS parse fails: skip that source, log error, continue
  - All sources fail: return `[]` (empty array) — rank and ideas nodes handle empty gracefully
- **Side effects**: Makes HTTP requests to external RSS/HTML URLs. No DB writes (writes happen in `summarise_article`).

---

## resolve_rss_url

- **Description**: Probe a site URL to discover its RSS or Atom feed URL, caching the result in `user_sources.rss_url` so detection runs only once per source.
- **Input schema**:
  | Param | Type | Required | Description |
  |-------|------|----------|-------------|
  | `site_url` | `string` | required | The original URL the user entered (may be a homepage or article URL) |
- **Output schema**:
  ```
  {
    rss_url: string | null  // resolved feed URL, or null if no feed found
    method: "link_tag" | "path_probe" | "article_scrape" | "not_found"
  }
  ```
- **Mock behaviour**: Returns `{ rss_url: "https://example.com/feed", method: "path_probe" }`.
- **Error cases**:
  - Fetch of site_url fails: return `{ rss_url: null, method: "not_found" }`
  - All 4 path probes return non-200: fall through to article scrape
  - Article scrape finds no `<article>` tags: return `{ rss_url: null, method: "not_found" }`
- **Side effects**: Makes up to 6 HTTP requests (1 homepage + 4 path probes, short-circuit on first hit). No DB writes — caller is responsible for updating `user_sources.rss_url`.

---

## summarise_article

- **Description**: Call Claude Haiku to extract structured metadata from an article's full text: TL;DR bullets, topic tags from the 11-subdomain taxonomy, and a depth score.
- **Input schema**:
  | Param | Type | Required | Description |
  |-------|------|----------|-------------|
  | `article_text` | `string` | required | Cleaned full body text of the article (HTML stripped) |
  | `title` | `string` | required | Article title for context |
- **Output schema**:
  ```
  SummaryResult {
    tldr_bullets: string[]  // 2–4 concise bullets summarising key points
    topic_tags: string[]    // subset of: agents, evals, fine-tuning, rag, multimodal,
                            //   reasoning, infrastructure, safety, hardware, products, research
    depth_score: number     // integer 1–5 (1=news/hype, 5=deep technical)
  }
  ```
- **Mock behaviour**: Returns `{ tldr_bullets: ["Mock bullet 1", "Mock bullet 2"], topic_tags: ["agents"], depth_score: 3 }`.
- **Error cases**:
  - Claude returns malformed JSON: retry once with a stricter prompt; if still malformed return `null` (caller inserts article with `tldr_bullets = NULL`)
  - Claude API 429/5xx: return `null` — caller continues crawl without this article's summary
- **Side effects**: One Anthropic API call (cheap tier). No DB writes — caller is responsible for INSERT into `articles`.

---

## embed_article

> **⚠ This is NOT an HTTP tool.** It executes via `pgai.embed('gte-small', text)` inside the same Postgres transaction as the `articles` INSERT. Never wrap this in a `fetch()` call or invoke it as a separate async step — doing so breaks transactional atomicity and introduces a race where an article row exists without an embedding.

- **Description**: Generate a 384-dimensional semantic embedding for an article using Supabase's built-in gte-small model. Executes as a SQL expression inside the INSERT transaction — not a network call.
- **Input schema**:
  | Param | Type | Required | Description |
  |-------|------|----------|-------------|
  | `text` | `string` | required | Text to embed; use `title || ' ' || full_text`, truncated to 400 tokens if needed |
- **Output schema**:
  ```
  number[]  // float array of length 384; stored as vector(384) in articles.embedding
  ```
- **Mock behaviour**: Returns an array of 384 zeros (`Array(384).fill(0.0)`).
- **Error cases**:
  - `pgai` extension not enabled: throws `PgAiNotAvailableError`; caller inserts article with `embedding = NULL` and logs
  - Text exceeds gte-small token limit (~512 tokens): truncate to first 400 tokens before calling
- **Side effects**: Executes `SELECT pgai.embed('gte-small', $text)` as a SQL expression — a Postgres built-in with no external HTTP. Requires `pgai` and `pgvector` extensions enabled on the Supabase project.

---

## score_article

- **Description**: Compute a normalised blend score for a (user, article) pair combining recency, semantic relevance, and source tier.
- **Input schema**:
  | Param | Type | Required | Description |
  |-------|------|----------|-------------|
  | `article_id` | `string (uuid)` | required | |
  | `user_id` | `string (uuid)` | required | |
  | `published_at` | `string` | required | ISO 8601 timestamp for recency calculation |
  | `cosine_similarity` | `number` | required | pgvector cosine similarity result (0.0–1.0) |
  | `source_tier` | `number` | required | Integer 1–3 |
- **Output schema**:
  ```
  number  // blend_score in range [0.0, 1.0]
  ```
  Formula: `0.35 × recency_score + 0.45 × cosine_similarity + 0.20 × (source_tier / 3)`
  where `recency_score = exp(-hours_since_published / 72)` (half-life ≈ 3 days)
- **Mock behaviour**: Returns `0.75`.
- **Error cases**:
  - `cosine_similarity` is NaN (article has no embedding): use `cosine_similarity = 0.0` and reweight to `0.55 × recency + 0.45 × source_tier/3`
- **Side effects**: None — pure computation.

---

## generate_daily_ideas

- **Description**: Call Claude Sonnet with structured output to generate exactly 5 content angle ideas for a user based on their top-ranked articles for the day.
- **Input schema**:
  | Param | Type | Required | Description |
  |-------|------|----------|-------------|
  | `user_id` | `string (uuid)` | required | |
  | `top_articles` | `ArticleSummary[]` | required | Top 10 ranked articles with title, tldr_bullets, topic_tags, depth_score |
  | `style_seed` | `string` | required | `technical` \| `practitioner` \| `business` \| `beginner-friendly` |
- **Output schema**:
  ```
  IdeaAngle[] (exactly 5 items) {
    angle_title: string         // punchy title for the angle
    format: "substack" | "linkedin"
    hook_sentence: string       // opening sentence to grab attention
    source_article_ids: string[] // uuid[] of articles grounding this angle
    rationale: string           // 1–2 sentences: why this angle matters now
    position: number            // 1–5 assigned by caller after generation
  }
  ```
- **Mock behaviour**: Returns 5 hardcoded `IdeaAngle` objects from `data/mock_user_profiles.json`.
- **Error cases**:
  - Claude returns fewer than 5 valid objects: retry once; if still < 5 return `[]` (caller skips idea insertion for this user today)
  - Zod schema validation fails on any object: attempt to salvage valid objects; if < 5 valid retry once
- **Side effects**: One Anthropic API call (primary tier, claude-sonnet-4-6). No DB writes — caller inserts into `daily_ideas`.

---

## generate_draft

- **Description**: Stream a full content draft from Claude Sonnet given an angle, user POV bullets, and linked source articles. Substack: 800–1200 words. LinkedIn: ≤1200 characters.
- **Input schema**:
  | Param | Type | Required | Description |
  |-------|------|----------|-------------|
  | `angle` | `IdeaAngle` | required | The selected daily idea angle |
  | `pov_bullets` | `string[]` | required | 1–3 user-supplied POV notes |
  | `source_articles` | `ArticleSummary[]` | required | Full summaries of articles linked to the angle |
  | `format` | `"substack" \| "linkedin"` | required | Determines word/char target and system prompt variant |
  | `style_seed` | `string` | required | User's writing style preference |
- **Output schema**:
  ```
  AsyncGenerator<string>  // text chunks; caller assembles and writes to TipTap
  ```
  On stream completion, caller persists full assembled text to `drafts` table.
- **Mock behaviour**: Yields 5 short strings from `_MOCK_RESPONSE` split by sentence, then stops.
- **Error cases**:
  - Stream interrupted mid-response: surface error in TipTap UI; do NOT save partial draft to DB
  - Claude API 429: return HTTP 429 to client with `Retry-After` header; client shows retry prompt
  - Free plan draft limit exceeded (3/month): return HTTP 403 before calling Claude
- **Side effects**: One Anthropic API call (primary tier, streaming). Caller writes to `drafts` table on completion.

---

## update_topic_weights

> **⚠ Transactional — use `supabase.rpc()` only.** Both the `user_feedback` INSERT and the `user_profiles.topic_weights` UPDATE must execute inside a single Postgres function (`update_feedback_and_weights`). Never issue two separate Supabase client calls with application-level rollback logic — a network interruption between calls leaves the table in an inconsistent state and fails silently.

- **Description**: Record a feedback signal and atomically recompute a user's `topic_weights` from their full feedback history inside a single Postgres transaction.
- **Invocation pattern**:
  ```ts
  // Correct — single RPC wrapping both writes in one transaction
  const { data, error } = await supabase.rpc('update_feedback_and_weights', {
    p_user_id: userId,
    p_article_id: articleId,
    p_signal: signal,           // 'like' | 'dislike'
    p_article_tags: articleTags // string[]
  })

  // WRONG — two client calls is not transactional
  // await supabase.from('user_feedback').insert(...)
  // await supabase.from('user_profiles').update(...)
  ```
- **Input schema**:
  | Param | Type | Required | Description |
  |-------|------|----------|-------------|
  | `user_id` | `string (uuid)` | required | |
  | `article_id` | `string (uuid)` | required | The article being liked or disliked |
  | `signal` | `"like" \| "dislike"` | required | The new feedback signal |
  | `article_tags` | `string[]` | required | `topic_tags` from the article |
- **Output schema**:
  ```
  Record<string, number>  // updated topic_weights, all values clamped to [0.0, 1.0]
  ```
- **Mock behaviour**: Returns the input weights unchanged.
- **Error cases**:
  - `user_id` not found: Postgres function raises exception; RPC returns error; Edge Function returns 404
  - Recomputed weights all zero (no positive signals yet): function returns equal weights `{ tag: 0.5 }` for all 11 tags
  - DB error mid-transaction: Postgres rolls back both the INSERT and UPDATE atomically; RPC returns error; no partial state written
- **Side effects**: Executes Postgres function `update_feedback_and_weights` — atomically INSERTs `user_feedback` row and UPDATEs `user_profiles.topic_weights`. Defined in `supabase/migrations/001_schema.sql`.
