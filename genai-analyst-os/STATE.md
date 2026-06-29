# Agent State Specification

This project uses **Postgres as the pipeline state store** rather than an in-memory LangGraph `AgentState` TypedDict. Each Edge Function reads the state it needs from Postgres at startup and writes its outputs back to Postgres on completion. There is no shared in-memory object between nodes.

The tables below define the canonical pipeline state. The Python `src/` layer uses a `PipelineState` dataclass as a local equivalent for eval harnesses and scripts.

---

## Pipeline State (Postgres Tables)

### Crawl-time state

| Table | Key fields | Set by | Read by |
|-------|-----------|--------|---------|
| `user_sources` | `user_id, url, rss_url, source_tier` | User (settings page) | `crawler` |
| `articles` | `url UNIQUE, full_text, tldr_bullets, topic_tags, depth_score, embedding, published_at` | `summarise` | `rank`, `ideas`, feed API |
| `user_feed_items` | `user_id, article_id, blend_score, feed_date` + UNIQUE constraint | `rank` | `ideas`, feed API |
| `daily_ideas` | `user_id, idea_date, angle_title, format, hook_sentence, source_article_ids, rationale, position` | `ideas` | feed API, create page |

### Preference state (mutated by feedback loop)

| Table | Key fields | Set by | Read by |
|-------|-----------|--------|---------|
| `user_profiles` | `plan, is_admin, style_seed, topic_weights jsonb, stripe_customer_id` | `feedback`, `stripe-webhook`, onboarding | `rank` (topic_weights), `ideas` (style_seed), every enforcement check (plan, is_admin) |
| `user_feedback` | `user_id, article_id, signal` | `feedback` | `feedback` (recomputes topic_weights from full history) |

### Crawl observability state

| Table | Key fields | Set by | Read by |
|-------|-----------|--------|---------|
| `crawl_runs` | `id, started_at, completed_at, status, articles_fetched, articles_new, articles_failed, users_ranked, users_ideas_generated, error_log jsonb` | `crawler` (on start + on complete) | monitoring alert (degraded-crawl detection), admin dashboard |

**`crawl_runs` field details:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | `uuid` PK | |
| `started_at` | `timestamptz` | Written at crawler startup — presence of an open row (no `completed_at`) detects a hung crawl |
| `completed_at` | `timestamptz` | Nullable; written on pipeline completion |
| `status` | `text` | `running` \| `completed` \| `degraded` \| `failed` |
| `articles_fetched` | `integer` | Total article URLs seen across all sources |
| `articles_new` | `integer` | Articles not previously in `articles` table |
| `articles_failed` | `integer` | Articles where summarise returned null or errored |
| `users_ranked` | `integer` | Users who received ≥1 new feed item |
| `users_ideas_generated` | `integer` | Users who received 5 new daily ideas |
| `error_log` | `jsonb` | Array of `{ source_id, error, stage }` objects for partial failures |

**Status transitions:**
- `running` → `completed`: all users ranked and ideas generated with 0 failed articles
- `running` → `degraded`: completed but `articles_failed > 0` OR `users_ranked < 50% of active users`
- `running` → `failed`: crawler Edge Function threw an unhandled exception before completing rank/ideas

**Monitoring rule** (from technical_design.md): alert if no `crawl_runs` row with `completed_at IS NOT NULL AND started_at > NOW() - INTERVAL '24 hours'` exists by 04:00 UTC.

### Billing state

| Table | Key fields | Set by | Read by |
|-------|-----------|--------|---------|
| `processed_stripe_events` | `event_id` | `stripe-webhook` | `stripe-webhook` (idempotency check) |

### User-generated content state

| Table | Key fields | Set by | Read by |
|-------|-----------|--------|---------|
| `drafts` | `user_id, idea_id, format, pov_bullets, content, updated_at` | Next.js draft/stream API route | drafts history page |

---

## Python PipelineState (eval harness only)

Used in `src/evals/` to simulate the pipeline locally without a live Supabase connection.

```python
from dataclasses import dataclass, field
from typing import Literal

@dataclass
class PipelineState:
    # --- crawl phase ---
    user_id: str = ""
    sources: list[dict] = field(default_factory=list)        # UserSource dicts
    raw_articles: list[dict] = field(default_factory=list)   # RawArticle dicts (from crawl)
    summaries: list[dict] = field(default_factory=list)      # SummaryResult dicts
    embeddings: list[list[float]] = field(default_factory=list)  # vector(384) per article

    # --- rank phase ---
    topic_weights: dict[str, float] = field(default_factory=dict)  # user's current weights
    feed_items: list[dict] = field(default_factory=list)     # { article_id, blend_score }

    # --- ideas phase ---
    style_seed: str = "practitioner"
    daily_ideas: list[dict] = field(default_factory=list)    # IdeaAngle dicts

    # --- draft phase ---
    selected_angle: dict | None = None                        # IdeaAngle
    pov_bullets: list[str] = field(default_factory=list)
    draft_format: Literal["substack", "linkedin"] = "substack"
    draft_content: str = ""                                   # assembled after stream

    # --- pipeline control ---
    errors: list[dict] = field(default_factory=list)         # { node, message, skipped }
    mock_mode: bool = False
```

---

## State Transitions

| Node | Reads | Writes | Notes |
|------|-------|--------|-------|
| `crawler` | `user_sources` (all users) | `crawl_runs` (INSERT on start, UPDATE status/counts on complete) + triggers `summarise` | Opens `crawl_runs` row before first source fetch; closes it after ideas node finishes |
| `summarise` | RawArticle payload from crawler | `articles` (INSERT) | Skips if `url` already in articles |
| `rank` | `articles` (today's new), `user_profiles.topic_weights` | `user_feed_items` (INSERT ON CONFLICT DO NOTHING) | Runs per user |
| `ideas` | `user_feed_items` (top 10 per user), `user_profiles.style_seed` | `daily_ideas` (INSERT 5 rows) | Skips if today's ideas already exist |
| `feedback` | `user_feedback` (all rows for user), `articles.topic_tags` | `user_feedback` (INSERT), `user_profiles.topic_weights` (UPDATE) | Transactional — both writes or neither |
| `stripe-webhook` | `processed_stripe_events` | `processed_stripe_events` (INSERT), `user_profiles.plan` (UPDATE) | Transactional |
| `generate_draft` | `daily_ideas`, `articles`, `user_profiles.style_seed` + `plan` | `drafts` (INSERT on stream completion) | Streams to client; DB write is post-stream |

---

## State Invariants

These must hold at all times; enforced by Postgres constraints:

1. `articles.url` is UNIQUE — no duplicate articles in the global catalogue
2. `user_feed_items (user_id, article_id, feed_date)` is UNIQUE — no duplicate feed cards per day
3. `user_profiles.topic_weights` values are all in `[0.0, 1.0]` — enforced by `feedback` node clamping before UPDATE
4. `daily_ideas.position` for a given `(user_id, idea_date)` is always `{1, 2, 3, 4, 5}` — never partial (delete-and-reinsert on partial failure)
5. `processed_stripe_events.event_id` is UNIQUE — Stripe events processed exactly once
