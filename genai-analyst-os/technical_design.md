# Technical Design — GenAI Analyst OS

---

## Architecture Overview

The system has two runtime environments: an **autonomous overnight pipeline** (Supabase backend, no user interaction) and an **interactive frontend** (Next.js on Vercel, user-facing).

```
═══════════════════════════════════════════════════════════════════════
  OVERNIGHT PIPELINE  (Supabase, 02:00 UTC)
═══════════════════════════════════════════════════════════════════════

  [pg_cron]
      │  HTTP POST /functions/v1/crawler
      ▼
  [crawler Edge Function]  ──── fetch RSS/HTML ────▶  [External Sources]
      │
      ├─ deduplicate against articles.url (UNIQUE)
      │
      ├─ for each new article:
      │      │
      │      ▼
      │  [summarise Edge Function]
      │      │  claude-haiku-4-5  (cheap tier)
      │      │  → tldr_bullets[], topic_tags[], depth_score
      │      │
      │      ▼
      │  [pgai.embed('gte-small', full_text)]  ← Supabase built-in, no API key
      │      │  → vector(384)
      │      │
      │      ▼
      │  INSERT INTO articles  (url UNIQUE → dedup)
      │
      ├─ for each user × article:
      │      │
      │      ▼
      │  [rank Edge Function]
      │      │  blend_score = 0.35×recency + 0.45×cosine_sim + 0.20×source_tier
      │      │  cosine_sim via pgvector: articles.embedding <=> user_topic_vector
      │      │
      │      ▼
      │  INSERT INTO user_feed_items
      │  ON CONFLICT (user_id, article_id, feed_date) DO NOTHING  ← idempotent
      │
      └─ [ideas Edge Function]
             │  claude-sonnet-4-6  (primary tier)
             │  → 5 angle JSON objects (Zod-validated)
             ▼
         INSERT INTO daily_ideas (position 1–5)

  [feedback Edge Function]  ◀── async POST from frontend (like/dislike)
      │  UPDATE user_profiles SET topic_weights = ...
      └─ (runs on demand, not on schedule)

═══════════════════════════════════════════════════════════════════════
  INTERACTIVE FRONTEND  (Next.js 14, Vercel)
═══════════════════════════════════════════════════════════════════════

  [app/feed/page.tsx]                      [app/create/page.tsx]
  ┌─────────────────────────────┐          ┌──────────────────────────────┐
  │  Daily Idea Cards (×5)      │          │  Angle context (pre-loaded)  │
  │  [blurred if pos>3 & free]  │          │  POV bullet input            │
  │─────────────────────────────│  "Write  │  [TipTap editor]             │
  │  Ranked Feed Cards          │  this"▶  │   streaming text             │
  │  TL;DR │ tags │ depth badge │          │   LinkedIn char counter      │
  │  👍 👎  controls            │          │  Save → drafts table         │
  │─────────────────────────────│          └──────────────────────────────┘
  │  Topic weight sidebar       │
  └─────────────────────────────┘
        │                                          │
        │ Supabase JS client                       │ Next.js API Route
        ▼                                          ▼
  [Supabase RLS queries]            [app/api/draft/stream/route.ts]
  SELECT user_feed_items                    │  Vercel AI SDK  streamText()
  ORDER BY blend_score DESC                 │  claude-sonnet-4-6
                                            ▼
                                   [Anthropic API]  - - - (LangSmith optional) - - ▶

═══════════════════════════════════════════════════════════════════════
  PERSISTENCE  (Supabase Postgres)
═══════════════════════════════════════════════════════════════════════

  user_profiles  ──┐
  user_sources   ──┤
  articles       ──┼──  pgvector extension  (vector(384), gte-small)
  user_feed_items──┤
  user_feedback  ──┤
  daily_ideas    ──┤
  drafts         ──┘
                    All tables: RLS enabled, user_id-scoped policies
```

**Note on the Python tooling layer:** `src/llm/provider.py` and `src/` are used for local batch scripts, eval harnesses, and mock-mode testing only. They are not part of the production request path. Production LLM calls go through Supabase Edge Functions (Deno) and the Next.js API route using the Anthropic SDK directly.

---

## Pipeline State Machine

Rather than a LangGraph state machine (which would require a persistent Python process), this pipeline is orchestrated as a **directed chain of Supabase Edge Functions** with Postgres as the shared state store. Each function is stateless; state lives entirely in the database.

### Pipeline Nodes (Edge Functions)

| Node | Function name | Trigger | Responsibility |
|------|--------------|---------|----------------|
| 1 | `crawler` | pg_cron HTTP POST at 02:00 UTC | Fetch RSS/HTML for all `user_sources`; resolve URLs; deduplicate against `articles.url`; enqueue new articles for summarisation |
| 2 | `summarise` | Called by crawler per new article | POST article text to Claude Haiku; parse structured response into `tldr_bullets`, `topic_tags`, `depth_score`; call `pgai.embed()` for vector; INSERT into `articles` |
| 3 | `rank` | Called by crawler after all articles inserted | For each user, compute blend score for all today's new articles using pgvector cosine similarity against user's `topic_weights` vector; INSERT into `user_feed_items ON CONFLICT DO NOTHING` |
| 4 | `ideas` | Called by crawler after rank completes | Fetch each user's top-10 feed articles; POST to Claude Sonnet with structured output schema; INSERT 5 `daily_ideas` rows with `position` 1–5 |
| 5 | `feedback` | HTTP POST from Next.js frontend (like/dislike action) | INSERT `user_feedback`; recompute `topic_weights` jsonb from all feedback signals; UPDATE `user_profiles` |
| 6 | `stripe-webhook` | Stripe HTTP webhook | Verify Stripe signature; UPDATE `user_profiles.plan` and `stripe_customer_id` on subscription events |

### Pipeline Flow

```
crawler
  └─▶ summarise (×N articles, concurrent)
        └─▶ [pgai.embed — SQL, not HTTP]
              └─▶ INSERT articles
                    └─▶ rank (×M users)
                          └─▶ INSERT user_feed_items
                                └─▶ ideas (×M users)
                                      └─▶ INSERT daily_ideas
```

### Conditional Routing

- **crawler → summarise**: skip if `articles.url` already exists (dedup check before HTTP call)
- **rank → user**: skip users with 0 new feed items (no sources matched today's crawl)
- **ideas → user**: skip if user already has `daily_ideas` rows for today's date (idempotent re-run safety)
- **feedback handler**: if `topic_weights` jsonb update produces any weight outside `[0.0, 1.0]`, clamp before write

### Implicit State (Postgres columns used as pipeline state)

| State field | Table.column | Set by | Read by |
|-------------|-------------|--------|---------|
| Article seen | `articles.url UNIQUE` | `summarise` | `crawler` dedup check |
| Feed computed | `user_feed_items.feed_date` | `rank` | `ideas`, frontend feed query |
| Ideas ready | `daily_ideas.idea_date` | `ideas` | Frontend feed page |
| Preferences | `user_profiles.topic_weights` | `feedback` | `rank` (cosine query) |
| Plan tier | `user_profiles.plan` | `stripe-webhook` | All enforcement checks |

---

## Tool Signatures

These are the logical tool interfaces. In production they are implemented inside Edge Functions (Deno/TypeScript); in the Python tooling layer (`src/`) they are Python equivalents used for local scripts and evals.

```python
def crawl_sources(user_id: str) -> list[RawArticle]:
    """Fetch RSS/HTML for all user_sources belonging to user_id; return new unseen articles."""

def resolve_rss_url(site_url: str) -> str | None:
    """Probe site_url for RSS via <link rel=alternate>, /feed, /rss, /feed.xml, /rss.xml, then <article> scrape; return resolved feed URL or None."""

def summarise_article(
    article_text: str,
    title: str,
) -> SummaryResult:
    """Call Claude Haiku and return tldr_bullets (2–4), topic_tags[], and depth_score (1–5)."""

def generate_embedding(text: str) -> list[float]:
    """Call pgai.embed('gte-small', text) and return a 384-dimensional float vector."""

def score_article(
    article_id: str,
    user_id: str,
    recency_score: float,
    cosine_similarity: float,
    source_tier: int,
) -> float:
    """Compute blend_score = 0.35×recency + 0.45×cosine_similarity + 0.20×(source_tier/3)."""

def generate_daily_ideas(
    user_id: str,
    top_articles: list[ArticleSummary],
    style_seed: str,
) -> list[IdeaAngle]:
    """Call Claude Sonnet with structured output schema; return exactly 5 IdeaAngle objects."""

def generate_draft(
    angle: IdeaAngle,
    pov_bullets: list[str],
    source_articles: list[ArticleSummary],
    format: Literal["substack", "linkedin"],
    style_seed: str,
) -> AsyncGenerator[str, None]:
    """Stream a Claude Sonnet draft: 800–1200 words for substack, ≤1200 chars for linkedin."""

def update_topic_weights(
    user_id: str,
    signal: Literal["like", "dislike"],
    article_tags: list[str],
) -> dict[str, float]:
    """Recompute topic_weights jsonb from all user feedback signals; return updated weights clamped to [0.0, 1.0]."""
```

### Return Type Schemas

```python
class RawArticle(TypedDict):
    url: str
    title: str
    full_text: str
    published_at: str  # ISO 8601
    source_id: str

class SummaryResult(TypedDict):
    tldr_bullets: list[str]   # 2–4 items
    topic_tags: list[str]     # values from 11-subdomain taxonomy
    depth_score: int          # 1–5

class IdeaAngle(TypedDict):
    angle_title: str
    format: Literal["substack", "linkedin"]
    hook_sentence: str
    source_article_ids: list[str]
    rationale: str
    position: int             # 1–5

class ArticleSummary(TypedDict):
    id: str
    title: str
    tldr_bullets: list[str]
    topic_tags: list[str]
    depth_score: int
    published_at: str
```

---

## API Endpoints

These are the Next.js API routes (App Router, `app/api/`). Supabase Edge Functions have their own internal HTTP interface but are not publicly exposed directly — they are called by pg_cron or by these Next.js routes as intermediaries.

### `POST /api/feedback`
**Auth:** Supabase JWT (Bearer token)  
**Input:**
```json
{ "article_id": "uuid", "signal": "like" | "dislike" }
```
**Output:**
```json
{ "ok": true, "updated_weights": { "agents": 0.82, "evals": 0.71, ... } }
```
**Side effects:** INSERTs `user_feedback`; triggers `feedback` Edge Function to UPDATE `user_profiles.topic_weights`

---

### `POST /api/draft/stream`
**Auth:** Supabase JWT  
**Input:**
```json
{
  "idea_id": "uuid",
  "pov_bullets": ["string", "string"],
  "format": "substack" | "linkedin"
}
```
**Output:** `text/event-stream` — Vercel AI SDK streaming response; each SSE event is a text delta chunk  
**Side effects:** On stream completion, INSERTs a `drafts` row with full content

---

### `POST /api/sources`
**Auth:** Supabase JWT  
**Input:**
```json
{ "url": "https://example.com" }
```
**Output:**
```json
{ "id": "uuid", "url": "...", "rss_url": "..." | null, "source_tier": 2 }
```
**Side effects:** Runs RSS detection; INSERTs `user_sources`; returns 409 if URL already added; returns 403 if Free user already has 5 sources

---

### `DELETE /api/sources/[id]`
**Auth:** Supabase JWT  
**Output:** `204 No Content`  
**Side effects:** DELETEs `user_sources` row (RLS prevents deleting another user's source)

---

### `GET /api/feed`
**Auth:** Supabase JWT  
**Query params:** `date` (ISO date, defaults to today), `limit` (default 20), `offset`  
**Output:**
```json
{
  "items": [{ "article": {...}, "blend_score": 0.87, "feed_date": "2026-06-29" }],
  "total": 34
}
```

---

### `GET /api/ideas`
**Auth:** Supabase JWT  
**Query params:** `date` (defaults to today)  
**Output:**
```json
{
  "ideas": [{ "id": "uuid", "angle_title": "...", "format": "substack", "hook_sentence": "...", "position": 1, "blurred": false }]
}
```
**Blur logic:** Server sets `blurred: true` for `position > 3` when `plan = 'free' AND is_admin = false`

---

### `POST /api/stripe/webhook`
**Auth:** Stripe-Signature header (HMAC verified with `STRIPE_WEBHOOK_SECRET`)  
**Input:** Raw Stripe event body  
**Output:** `200 OK` (Stripe requires fast ack)  
**Side effects:** On `customer.subscription.created/updated/deleted` → UPDATE `user_profiles.plan`

---

### `GET /api/health`
**Auth:** None  
**Output:**
```json
{ "status": "ok", "timestamp": "2026-06-29T08:00:00Z" }
```

---

## Multi-Provider LLM Configuration

`src/llm/provider.py` is used exclusively in the **Python tooling layer** (local scripts, eval harnesses, batch jobs). Production LLM calls use the Anthropic SDK directly inside Supabase Edge Functions and the Next.js API route.

### Tier assignments

| Operation | Location | Tier | Model | Rationale |
|-----------|----------|------|-------|-----------|
| Article summarisation | `summarise` Edge Fn | **cheap** | `claude-haiku-4-5-20251001` | High volume (up to 200/crawl); task is well-defined extraction, not reasoning; Haiku keeps total crawl LLM cost under $0.05/user/day |
| Daily idea generation | `ideas` Edge Fn | **primary** | `claude-sonnet-4-6` | Low volume (1 call per user per day); quality matters — ideas must be genuinely useful angles, not generic summaries; structured JSON output reliability is higher on Sonnet |
| Draft generation | `app/api/draft/stream` | **primary** | `claude-sonnet-4-6` | Single call per draft; user is waiting and will evaluate quality; voice matching and 800–1200 word coherence requires Sonnet-level capability |
| Python evals / mock mode | `src/llm/provider.py` | configurable | any | `MOCK_LLM=true` bypasses all API calls; `LLM_PROVIDER` env var switches provider; primary/cheap tiers mirror production assignments |

### Cost envelope (Free plan, worst case)

```
Summarisation:  20 articles × ~500 tokens × Haiku rate ≈ $0.002
Ideas:           1 call × ~2000 tokens × Sonnet rate  ≈ $0.006
Draft:           3/month ÷ 30 × ~1500 tokens × Sonnet ≈ $0.001/day
────────────────────────────────────────────────────────────────
Total per user/day (Free):  ≈ $0.009  (well within $0.05 guardrail)
```

---

## Key Technical Risks

### Risk 1 — Supabase Edge Function cold-start timeout during large crawls
**Problem:** A user with 10 sources × 20 articles = 200 articles to summarise in one Edge Function invocation. Supabase Edge Functions have a 150-second wall-clock limit. At ~0.5s per Haiku call with 10-way concurrency, 200 articles takes ~10 seconds — well within limits — but a slow source or network hiccup can cascade.  
**Mitigation:** The crawler fans out summarisation as concurrent promises (10 at a time using `Promise.allSettled` with a concurrency limiter), not serially. Failed summarisations are logged but do not abort the crawl — the article is inserted with `tldr_bullets = null` and re-summarised on the next crawl via a `WHERE tldr_bullets IS NULL` backfill query. The `UNIQUE(url)` constraint on `articles` ensures the backfill is safe to re-run.

### Risk 2 — pgvector cosine similarity returning stale results after topic_weights change
**Problem:** The relevance component of the blend score uses a vector built from the user's current `topic_weights`. If a user's weights change significantly between crawls (via likes/dislikes), today's `user_feed_items.blend_score` values are stale — the re-ranked order is not reflected until tomorrow's crawl rewrites the feed.  
**Mitigation:** Accept this as a known limitation for v1 — the feed refreshes daily, and the product narrative frames it as "tomorrow's feed will be smarter." For P1, add a lightweight re-rank endpoint that recomputes blend scores on-demand when the user loads the feed after giving feedback, without re-running the full crawl.

### Risk 3 — Stripe webhook replay / double plan upgrade
**Problem:** Stripe delivers webhooks at-least-once. A `customer.subscription.created` event replayed after network retry could trigger a second UPDATE to `user_profiles.plan`, which is harmless for idempotent updates but could cause issues if the handler has side effects (e.g. triggering a welcome email twice).  
**Mitigation:** Store `stripe_event_id` in a `processed_stripe_events` table and check for existence before processing. Handler becomes: `IF NOT EXISTS (SELECT 1 FROM processed_stripe_events WHERE id = event.id) THEN process + insert; ELSE return 200 immediately`. Stripe recommends this exact pattern.
