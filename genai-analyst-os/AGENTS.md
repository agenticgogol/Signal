# Agent: GenAI Analyst Pipeline

## Role

The GenAI Analyst Pipeline is an autonomous multi-step agent that runs overnight (02:00 UTC) on behalf of every registered user. It ingests articles from user-configured RSS sources, enriches each article with AI-generated summaries and semantic embeddings, ranks the articles against each user's evolving topic preferences, and generates five personalised content angle ideas ready for the user to act on in the morning. The pipeline serves GenAI practitioners and content creators who want a pre-curated, ranked feed and a set of publishing-ready angles without any manual effort. It cannot write final drafts autonomously (that requires explicit user input via POV bullets), cannot modify user preferences without an explicit like/dislike signal, and cannot publish content to any external platform.

---

## Agentic Patterns Used

- **Scheduled background agent**: pg_cron fires an HTTP POST to the `crawler` Edge Function at 02:00 UTC every day — the entire pipeline runs with zero user interaction, completing before users wake up.
- **LLM-as-summariser**: The `summarise` node calls Claude Haiku once per new article to extract structured fields (TL;DR bullets, topic tags, depth score) that are cached in Postgres and reused by all downstream nodes and users without additional LLM calls.
- **Preference learning loop**: Every like/dislike signal from the frontend triggers the `feedback` Edge Function, which recomputes `topic_weights` in `user_profiles`; the updated weights flow into the pgvector cosine similarity query in the next `rank` run.
- **Structured output**: The `ideas` node sends the top-10 articles to Claude Sonnet with a Zod-validated JSON schema, enforcing that exactly 5 `IdeaAngle` objects are returned with all required fields populated.
- **Streaming content generation**: The `generate_draft` tool (invoked from the Next.js API route, not the overnight pipeline) uses the Vercel AI SDK `streamText()` to stream a Claude Sonnet draft token-by-token into the TipTap editor.

---

## Node Responsibilities

### crawler
- **Trigger**: HTTP POST from pg_cron at 02:00 UTC
- **Input**: All rows in `user_sources` (url, rss_url, source_tier, user_id)
- **Tools invoked**: `crawl_sources`, `resolve_rss_url` (only on first-time sources with no `rss_url`)
- **Action**: INSERT a `crawl_runs` row with `status = 'running'` and `started_at = NOW()` before processing any source. For each source, fetch the RSS feed URL (already resolved and cached in `rss_url`). Parse feed entries, extract article URLs and metadata. Check each URL against `articles.url` (UNIQUE constraint) to identify new articles. For new articles, fetch full text from the original URL. Fan out to `summarise` with concurrency limit of 10 using `Promise.allSettled`. On pipeline completion, UPDATE `crawl_runs` with `status`, `completed_at`, `articles_fetched`, `articles_new`, `articles_failed`, `users_ranked`, `users_ideas_generated`, and `error_log`.
- **Output**: New rows in `articles` (written by `summarise`); triggers `rank` and `ideas` on completion
- **LLM tier**: none
- **On failure**: Logs the failed source URL and HTTP status; continues processing remaining sources. A total crawl failure is retried once after 5 minutes via pg_cron retry config. Partial failures do not block the `rank` or `ideas` nodes — they run on whatever articles were successfully summarised.

### summarise
- **Trigger**: Called by `crawler` for each new article (concurrent, max 10 in flight)
- **Input**: `{ article_text: string, title: string, url: string, source_id: uuid }`
- **Tools invoked**: `summarise_article`, `embed_article` (SQL, inside same INSERT transaction)
- **Action**: POST article text to Claude Haiku with a structured extraction prompt. Parse the response into `tldr_bullets` (2–4 items), `topic_tags` (values from the 11-subdomain taxonomy), and `depth_score` (1–5 integer). Then call `pgai.embed('gte-small', full_text)` inside a Supabase SQL function to generate a `vector(384)` embedding — this is a SQL call, not an HTTP call, so it runs in the same transaction as the INSERT.
- **Output**: INSERT into `articles` with all enriched fields; if INSERT fails on UNIQUE conflict the article already exists — skip silently
- **LLM tier**: cheap (claude-haiku-4-5-20251001)
- **On failure**: If Claude call fails, INSERT article with `tldr_bullets = NULL`. A backfill query (`WHERE tldr_bullets IS NULL`) at the start of each crawl re-attempts summarisation for articles that failed previously. If embedding fails, the article row is still inserted but excluded from `rank` cosine scoring for that crawl (blend score falls back to `0.55×recency + 0.45×source_tier`).

### rank
- **Trigger**: Called by `crawler` after all `summarise` tasks settle
- **Input**: Today's new `article_id` list; all `user_profiles` rows (user_id, topic_weights)
- **Tools invoked**: `score_article` (called per user × article pair; cosine similarity computed in SQL)
- **Action**: For each user, build a query vector from their `topic_weights` jsonb by projecting subdomain weights onto the 384-dimensional gte-small embedding space. Execute a pgvector cosine similarity query (`articles.embedding <=> user_topic_vector`) for each new article. Compute blend score: `0.35 × recency_score + 0.45 × cosine_similarity + 0.20 × (source_tier / 3)`. Upsert results into `user_feed_items`.
- **Output**: INSERT INTO `user_feed_items (user_id, article_id, blend_score, feed_date)` ON CONFLICT `(user_id, article_id, feed_date)` DO NOTHING
- **LLM tier**: none (pure SQL + pgvector)
- **On failure**: If a user's `topic_weights` is malformed, skip that user and log the user_id. Other users are unaffected. A monitoring alert fires if fewer than 50% of active users receive feed items.

### ideas
- **Trigger**: Called by `crawler` after `rank` completes for all users
- **Input**: Per user: top-10 `user_feed_items` for today (ordered by `blend_score DESC`) with their `articles` join; user's `style_seed`
- **Tools invoked**: `generate_daily_ideas`
- **Action**: Check if `daily_ideas` already has rows for this user and today's date — if so, skip (idempotent re-run safety). Otherwise, construct a prompt with article titles, TL;DR bullets, and topic tags for the top-10 articles. Call Claude Sonnet with the `IdeaAngle` Zod schema as structured output. Validate that exactly 5 objects are returned with all required fields. Assign `position` 1–5 in the order returned.
- **Output**: INSERT 5 rows into `daily_ideas (user_id, idea_date, angle_title, format, hook_sentence, source_article_ids, rationale, position)`
- **LLM tier**: primary (claude-sonnet-4-6)
- **On failure**: If Claude returns fewer than 5 valid angles (schema validation fails), retry once with a simplified prompt. If the second attempt also fails, skip idea generation for that user today and log the failure. The feed still loads correctly — the ideas section shows a "no ideas today" empty state rather than crashing.

### feedback
- **Trigger**: HTTP POST from Next.js `/api/feedback` route on user like/dislike
- **Input**: `{ user_id: uuid, article_id: uuid, signal: "like" | "dislike" }`
- **Tools invoked**: `update_topic_weights` (via `supabase.rpc('update_feedback_and_weights', {...})`)
- **Action**: INSERT into `user_feedback`. Fetch all feedback rows for this user. Recompute `topic_weights` by aggregating tag signals: for each tag on liked articles add +0.1, for disliked articles subtract 0.05. Normalise all weights to `[0.0, 1.0]` by clamping.
- **Output**: UPDATE `user_profiles SET topic_weights = { ... }` with the recomputed weights
- **LLM tier**: none
- **On failure**: If the UPDATE fails, return a 500 to the caller. The `user_feedback` INSERT is done in the same transaction — roll back both to keep `topic_weights` and `user_feedback` consistent.

### stripe-webhook
- **Trigger**: HTTP POST from Stripe on subscription lifecycle events
- **Input**: Raw Stripe event body + `Stripe-Signature` header
- **Tools invoked**: none (direct Postgres writes via service role client)
- **Action**: Verify HMAC signature using `STRIPE_WEBHOOK_SECRET`. Check `processed_stripe_events` table for this `event.id` — if present, return 200 immediately (idempotent). Otherwise, extract `customer_id` and `plan` from the event. Map Stripe subscription status to `free` or `pro`.
- **Output**: INSERT into `processed_stripe_events`; UPDATE `user_profiles SET plan = ..., stripe_customer_id = ...`
- **LLM tier**: none
- **On failure**: Return 400 if signature verification fails (Stripe will not retry invalid signatures). Return 500 for DB errors (Stripe will retry with exponential backoff for up to 3 days).

---

## Decision Rules

1. **crawler → summarise**: For each fetched article URL, if `SELECT 1 FROM articles WHERE url = $url` returns a row, skip — do not call `summarise`. Otherwise call `summarise`.
2. **summarise → embed**: Always call `pgai.embed()` after a successful Claude response, in the same DB transaction as the article INSERT. If embedding fails, commit the article row anyway with `embedding = NULL`; flag for backfill.
3. **rank → skip user**: If a user has `topic_weights = NULL` or all weights are zero, use equal weights across all 11 subdomains (fallback to unweighted cosine similarity).
4. **ideas → skip user**: If `SELECT COUNT(*) FROM daily_ideas WHERE user_id = $id AND idea_date = TODAY` returns 5, skip (already generated today). If it returns 1–4, delete the partial rows and regenerate from scratch.
5. **ideas → retry**: If Claude Sonnet structured output returns fewer than 5 valid IdeaAngle objects, retry once. If the retry also fails, insert 0 rows and log — do not insert partial results.
6. **feedback → clamp**: After recomputing `topic_weights`, any value < 0.0 is set to 0.0, any value > 1.0 is set to 1.0 before the UPDATE.
7. **stripe-webhook → idempotent**: Always check `processed_stripe_events` before acting. Always INSERT into `processed_stripe_events` atomically with the plan UPDATE (single transaction).

---

## Constraints

- **Max concurrent summarise calls**: 10 (controlled by async concurrency limiter in crawler)
- **Max retries on summarise failure**: 1 (via next-crawl backfill, not same-run retry)
- **Max retries on ideas failure**: 1 (immediate same-run retry with simplified prompt)
- **Edge Function wall-clock limit**: 150 seconds (Supabase hard limit)
- **Hard stop conditions**:
  - Crawler aborts if Supabase DB connection fails at startup
  - Summarise node skips (does not abort crawl) if Claude API returns 429 or 5xx
  - Ideas node skips a user (does not abort) if Claude API fails twice consecutively
  - Stripe webhook returns 400 immediately on invalid signature — no processing

---

## Skills Registry

Reference: see `skills.md` for high-level agent capabilities.
