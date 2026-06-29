# Requirements — GenAI Analyst OS

## 1. Functional Requirements

| ID | Requirement | Trigger | Output |
|----|-------------|---------|--------|
| FR-01 | User onboarding: accept 5–10 source URLs, 1–11 GenAI subdomain interests, and a writing-style preference (technical / practitioner / business / beginner-friendly) | User action (settings page) | `user_profiles` row created/updated in Supabase with `topic_weights` jsonb and `style_seed` |
| FR-02 | Scheduled crawler: fetch RSS/HTML from all sources for all users, deduplicate against `articles` table, and write new articles to `user_feed_items` | `pg_cron` at 02:00 UTC (autonomous, no user trigger) | New rows in `articles` and `user_feed_items`; existing articles skipped |
| FR-03 | Article summarisation: for each new article, call Claude and produce `tldr_bullets[]` (2–4 bullets), `topic_tags[]`, and `depth_score` (1–5); generate embedding via Supabase's built-in `gte-small` model (`pgai.embed('gte-small', text)`) — no external embedding API required | Invoked by crawler after each new article is persisted | `articles` row updated with summary fields and `embedding vector(384)` (gte-small output dimension) |
| FR-04 | Feed ranking: compute a blend score per article per user (`0.35 × recency + 0.45 × pgvector cosine similarity + 0.20 × source tier`) and surface the top-N ranked cards | Post-crawl Edge Function | `user_feed_items.blend_score` populated; feed API returns ranked list |
| FR-05 | Like/dislike feedback: record user signal and asynchronously update `topic_weights` in `user_profiles`; next crawl uses updated weights for relevance scoring | User clicks like or dislike on a feed card | `user_feedback` row inserted; `topic_weights` updated via Edge Function |
| FR-06 | Daily idea generation: after crawl completes, call Claude with the top-ranked articles and return exactly 5 angle objects, each containing `angle_title`, `format` (Substack \| LinkedIn), `hook_sentence`, `source_article_ids[]`, and `rationale` | Post-crawl Edge Function (autonomous) | 5 rows inserted into `daily_ideas` table; available on the feed page above the article list |
| FR-07 | Draft generation: given a selected angle, user-supplied POV bullets, and linked source articles, stream a full draft via Claude — Substack: 800–1200 words; LinkedIn: 900–1200 characters | User clicks "Write this" and submits POV notes | Streaming text delivered to TipTap editor; `drafts` row persisted on completion |
| FR-08 | Live character count: display a live character counter for LinkedIn drafts in the TipTap editor, visually warning at 900 chars and capping display at 1200 | User typing in TipTap with format=LinkedIn | Real-time counter in editor UI |
| FR-09 | Draft history: list all past drafts for the user, filterable by format, with the ability to reopen any draft in the editor | User visits drafts history page | Paginated list from `drafts` table; draft content reloaded into TipTap on selection |
| FR-10 | Monetisation enforcement: Free plan limited to 5 source URLs, 20 articles/day, 3 drafts/month, and 3 of 5 daily angles (angles 4–5 shown blurred with an upgrade CTA); Pro plan shows all 5 unblurred; users with `is_admin=true` on `user_profiles` always see all 5 unblurred regardless of plan | Stripe webhook on subscription events; enforced at API route level and in feed UI | `user_profiles.plan` updated; blurred angle cards rendered client-side based on `plan` and `is_admin` fields; API routes return 403 with upgrade prompt when hard limits exceeded |
| FR-11 | Source management: user can add, remove, and reorder source URLs; system auto-detects RSS feed URL from a given site URL using: (1) `<link rel="alternate" type="application/rss+xml">` from page `<head>`, then (2) path pattern probing in order: `/feed`, `/rss`, `/feed.xml`, `/rss.xml`, then (3) homepage HTML scrape for `<article>` tags as direct-scrape fallback; resolved `rss_url` stored in `user_sources` so detection runs once per source only | User action (settings page) | `user_sources` rows created/deleted with `rss_url` populated; crawler uses stored `rss_url` directly on subsequent runs |
| FR-12 | Mock/offline mode: when `MOCK_LLM=true`, all LLM calls in the Python tooling layer return canned responses without hitting any external API | Environment variable set at startup | System operates end-to-end for local development and CI without API keys |

---

## 2. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Latency | First token of a streaming draft must appear in the TipTap editor within 2 seconds of the user submitting their POV notes |
| NFR-02 | Latency | Feed page must load with ranked article cards within 1.5 seconds (data already computed by crawl; no LLM call at page-load time) |
| NFR-03 | Throughput | The post-crawl summarisation pipeline must process 200 articles in under 5 minutes using concurrent Claude calls (≤10 parallel requests) |
| NFR-04 | Uptime / Dev | With `MOCK_LLM=true` the full Python tooling layer must run without any external API key, enabling CI and local development without credentials |
| NFR-05 | Cost guardrails | Per-user daily LLM cost must not exceed $0.05 on the Free plan; summarisation uses `claude-haiku-4-5-20251001` (cheap tier); idea generation and draft generation use `claude-sonnet-4-6` (primary tier) |
| NFR-06 | Security | API keys must only be read from environment variables; no key or PII (email, draft content) may appear in application logs or error messages |
| NFR-07 | Security | All Supabase queries use Row Level Security (RLS); no API route may return data belonging to a different user_id |
| NFR-08 | Scalability | Architecture must support multiple users from day one; all data is user-scoped (`user_id` foreign key on every table); Stripe billing tier enforced server-side |

---

## 3. Constraints

- **Local/offline development**: `MOCK_LLM=true` must allow full Python tooling layer execution with no API key required.
- **LLM layer**: Python 3.11+, LiteLLM for multi-provider abstraction; primary provider is Anthropic.
- **Backend**: Supabase (Postgres + pgvector + Auth + Edge Functions + pg_cron) — no custom backend server required for production; Python scripts used for local tooling and batch jobs only.
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + TipTap editor; deployed to Vercel.
- **Persistence**: All application state in Supabase Postgres; `articles.embedding` stored as `vector(384)` using pgvector + Supabase's built-in `gte-small` model via `pgai.embed()` — no external embedding API or OpenAI key required.
- **No Docker**: Deploy targets (Vercel + Supabase Cloud) deploy from Git; no Dockerfile needed.
- **Python tooling layer**: LangGraph available for any multi-step agentic workflows in Python scripts; SQLite used for local state in Python tooling only (not application persistence).

---

## 4. Out of Scope

- **Mobile app**: No iOS/Android native client; responsive web only.
- **Social publishing API integration**: The system generates draft text; it does not post directly to Substack or LinkedIn — the user copies and pastes.
- **Real-time collaborative editing**: TipTap editor is single-user only; no multiplayer or shared draft sessions.
- **Custom LLM fine-tuning**: All generation uses off-the-shelf Claude models; no fine-tuning or model hosting.
- **Multi-language support**: UI and content generation are English-only in this version.

---

## 5. Acceptance Criteria

**AC-01 — Feed populated after crawl**
- *Given* a user with 3 source URLs and topic interests configured,
- *When* the pg_cron crawler runs (or is triggered manually),
- *Then* the feed page displays at least 1 ranked article card with TL;DR bullets, topic tags, and a depth badge, and `user_feed_items` contains new rows with non-null `blend_score`.

**AC-02 — Preference learning updates ranking**
- *Given* a user who has liked 3 articles tagged "agents" and disliked 2 tagged "hardware",
- *When* the next crawl completes,
- *Then* articles tagged "agents" appear with higher blend scores than equivalent articles tagged "hardware" for that user, and `user_profiles.topic_weights` reflects the updated preference signal.

**AC-03 — Draft streamed and persisted**
- *Given* a user on the Pro plan who selects a daily idea angle and enters 2 POV bullets,
- *When* they click "Write this" and submit,
- *Then* streaming text appears in the TipTap editor within 2 seconds, the completed draft is 800–1200 words (Substack) or ≤1200 characters (LinkedIn), and a `drafts` row exists in Supabase with the correct `user_id`, `format`, and `content`.
